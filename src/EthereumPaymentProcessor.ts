import { ethers } from "ethers";
import { CreatePaymentRequest, Payment } from "./types";
import axios from "axios";

export class EthereumPaymentProcessor {
  private payments: Map<string, Payment> = new Map();
  private provider: ethers.JsonRpcProvider;
  private pollingInterval: NodeJS.Timeout | null = null;
  
  private readonly MASTER_ADDRESS = process.env.MASTER_ADDRESS
  private readonly RPC_URL = process.env.RPC_URL
  private readonly POLLING_INTERVAL = 30000; // every 30 seconds
  private readonly GAS_LIMIT = 21000;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(this.RPC_URL);
    
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
    
    console.log(`Payment created: ${paymentId} - Address: ${wallet.address}`);
    
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
      
      console.log(`Checking ${pendingPayments.length} pending payments`);
      
      for (const payment of pendingPayments) {
        await this.checkPayment(payment);
      }
    }, this.POLLING_INTERVAL);
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
        console.log(`No data found for address ${payment.address}`);
        return;
      }

      const balanceWei = BigInt(response.data.result);
      const balanceEth = ethers.formatEther(balanceWei);
      const expectedAmount = parseFloat(payment.amount);
      
      console.log(`Address ${payment.address}: Balance ${balanceEth} ETH, Expected: ${expectedAmount} ETH`);
      
      if (parseFloat(balanceEth) >= expectedAmount && balanceWei > 0n) {
        console.log(`Payment received for ${payment.id}. Forwarding payment`);
        await this.forwardPayment(payment, balanceWei);
      }
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.log(`Rate limited for address ${payment.address}, will retry later`);
        } else {
          console.error(`Error checking payment ${payment.id}:`, error.message);
        }
      } else {
        console.error(`Error checking payment ${payment.id}:`);
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
      const gasCost = gasPrice * BigInt(this.GAS_LIMIT);
      
      const amountToSend = balanceWei - gasCost;
      
      if (amountToSend <= 0n) {
        console.error(`Insufficient ETH for gas fees. Balance: ${ethers.formatEther(balanceWei)}, Gas cost: ${ethers.formatEther(gasCost)}`);
        payment.status = 'failed';
        return;
      }
      
      const tx = await paymentWallet.sendTransaction({
        to: this.MASTER_ADDRESS,
        value: amountToSend,
        gasLimit: this.GAS_LIMIT,
        gasPrice: gasPrice
      });
      
      console.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        payment.status = 'completed';
        payment.completedAt = new Date();
        console.log(`Payment ${payment.id} forwarded successfully. TX: ${tx.hash}`);
      } else {
        payment.status = 'failed';
        console.error(`Transaction failed: ${tx.hash}`);
      }
      
    } catch (error) {
      console.error(`Error forwarding payment ${payment.id}:`, error);
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