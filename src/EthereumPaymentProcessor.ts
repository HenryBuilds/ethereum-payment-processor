import { ethers } from "ethers";
import { CreatePaymentRequest, Payment } from "./types";
import axios from "axios";
import logger from "./logger";
import { env } from "./env";

export class EthereumPaymentProcessor {
  private payments: Map<string, Payment> = new Map();
  private provider: ethers.JsonRpcProvider;
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(env.RPC_URL);
    
    this.startPollingService();
  }
  
  createPayment(paymentRequest: CreatePaymentRequest): { paymentId: string; address: string; amount: string } {
    const wallet = ethers.Wallet.createRandom();
    const paymentId = crypto.randomUUID();
    
    const payment: Payment = {
      id: paymentId,
      orderId: paymentRequest.orderId,
      address: wallet.address,
      privateKey: wallet.privateKey,
      amount: paymentRequest.amount,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.payments.set(paymentId, payment);
    
    logger.info("Payment created", { paymentId, address: wallet.address });
    
    return {
      paymentId,
      address: wallet.address,
      amount: paymentRequest.amount
    };
  }

  getPaymentStatus(paymentId: string): Payment | null {
    return this.payments.get(paymentId) || null;
  }

  private startPollingService(): void {
    this.pollingInterval = setInterval(async () => {
      const pendingPayments = Array.from(this.payments.values())
        .filter(payment => payment.status === 'pending');
      
      if (pendingPayments.length === 0) return;
      
      logger.info(`Checking ${pendingPayments.length} pending payments`);
      
      for (const payment of pendingPayments) {
        await this.checkPayment(payment);
      }
    }, env.POLLING_INTERVAL);
  }

  private async checkPayment(payment: Payment): Promise<void> {
    try {
      const response = await axios.get(
        `https://api.etherscan.io/api?module=account&action=balance&address=${payment.address}&tag=latest&apikey=YourApiKeyToken`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'EthereumPaymentProcessor/1.0'
          }
        }
      );

      if (response.data.status !== '1') {
        logger.warn("No data found for address", { address: payment.address });
        return;
      }

      const balanceWei = BigInt(response.data.result);
      const balanceEth = ethers.formatEther(balanceWei);
      const expectedAmount = parseFloat(payment.amount);
      
      logger.debug("Balance check", {
        address: payment.address,
        balance: balanceEth,
        expected: expectedAmount,
      });
      
      if (parseFloat(balanceEth) >= expectedAmount && balanceWei > 0n) {
        logger.info("Payment received, forwarding", { paymentId: payment.id });
        await this.forwardPayment(payment, balanceWei);
      }
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          logger.warn("Rate limited, will retry later", { address: payment.address });
        } else {
          logger.error("Error checking payment", { paymentId: payment.id, message: error.message });
        }
      } else {
        logger.error("Error checking payment", { paymentId: payment.id, error });
      }
    }
  }

  private async forwardPayment(payment: Payment, balanceWei: bigint): Promise<void> {
    try {
      const paymentWallet = new ethers.Wallet(payment.privateKey, this.provider);
      
      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice) {
        throw new Error('Could not retrieve gas price');
      }
      
      const gasPrice = feeData.gasPrice;
      const gasCost = gasPrice * BigInt(env.GAS_LIMIT);
      
      const amountToSend = balanceWei - gasCost;
      
      if (amountToSend <= 0n) {
        logger.error("Insufficient ETH for gas fees", {
          balance: ethers.formatEther(balanceWei),
          gasCost: ethers.formatEther(gasCost),
        });
        payment.status = 'failed';
        return;
      }
      
      const tx = await paymentWallet.sendTransaction({
        to: env.MASTER_ADDRESS,
        value: amountToSend,
        gasLimit: env.GAS_LIMIT,
        gasPrice: gasPrice
      });
      
      logger.info("Transaction sent", { txHash: tx.hash });
      
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        payment.status = 'completed';
        payment.completedAt = new Date();
        logger.info("Payment forwarded successfully", { paymentId: payment.id, txHash: tx.hash });
      } else {
        payment.status = 'failed';
        logger.error("Transaction failed", { txHash: tx.hash });
      }
      
    } catch (error) {
      logger.error("Error forwarding payment", { paymentId: payment.id, error });
      payment.status = 'failed';
    }
  }

  getAllPayments(): Payment[] {
    return Array.from(this.payments.values());
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}