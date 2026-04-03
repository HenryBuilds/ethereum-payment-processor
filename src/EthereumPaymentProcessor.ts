import { ethers } from "ethers";
import { CreatePaymentRequest, Payment, SafePayment, SUPPORTED_TOKENS, ERC20_ABI } from "./types";
import axios from "axios";
import logger from "./logger";
import { env } from "./env";
import {
  insertPayment,
  updatePayment,
  getPaymentById,
  getPaymentsByStatus,
  getExpiredPendingPayments,
} from "./database";
import { sendWebhookNotifications } from "./webhookService";

export class EthereumPaymentProcessor {
  private provider: ethers.JsonRpcProvider;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(env.RPC_URL);
    this.startPollingService();
  }

  async createPayment(request: CreatePaymentRequest): Promise<{ paymentId: string; address: string; amount: string; currency: string; expiresAt: string }> {
    const wallet = ethers.Wallet.createRandom();
    const paymentId = crypto.randomUUID();
    const currency = request.currency?.toUpperCase() || "ETH";

    if (currency !== "ETH" && !SUPPORTED_TOKENS[currency]) {
      throw new Error(`Unsupported currency: ${currency}. Supported: ETH, ${Object.keys(SUPPORTED_TOKENS).join(", ")}`);
    }

    const expiresAt = new Date(Date.now() + env.PAYMENT_TIMEOUT_MINUTES * 60 * 1000);

    const payment: Payment = {
      id: paymentId,
      orderId: request.orderId,
      merchantId: request.merchantId || null,
      address: wallet.address,
      privateKey: wallet.privateKey,
      amount: request.amount,
      currency,
      tokenAddress: currency !== "ETH" ? SUPPORTED_TOKENS[currency].address : null,
      status: "pending",
      receivedAmount: null,
      txHash: null,
      refundTxHash: null,
      gasUsed: null,
      gasCost: null,
      confirmations: 0,
      createdAt: new Date(),
      completedAt: null,
      expiresAt,
    };

    await insertPayment(payment);

    logger.info("Payment created", {
      paymentId,
      address: wallet.address,
      currency,
      amount: request.amount,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      paymentId,
      address: wallet.address,
      amount: request.amount,
      currency,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<Payment | null> {
    return getPaymentById(paymentId);
  }

  async cancelPayment(paymentId: string): Promise<SafePayment> {
    const payment = await getPaymentById(paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "pending") {
      throw new Error(`Cannot cancel payment with status: ${payment.status}`);
    }

    await updatePayment(paymentId, { status: "cancelled" });
    const updated = (await getPaymentById(paymentId))!;
    const { privateKey, ...safe } = updated;

    await sendWebhookNotifications("payment.cancelled", safe);
    logger.info("Payment cancelled", { paymentId });

    return safe;
  }

  async refundPayment(paymentId: string, toAddress: string): Promise<SafePayment> {
    const payment = await getPaymentById(paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "completed" && payment.status !== "partial") {
      throw new Error(`Cannot refund payment with status: ${payment.status}`);
    }

    try {
      const masterWallet = new ethers.Wallet(payment.privateKey, this.provider);

      if (payment.currency === "ETH") {
        const balance = await this.provider.getBalance(payment.address);
        if (balance <= 0n) {
          throw new Error("No balance remaining on payment address for refund. Manual refund from master address required.");
        }

        const feeData = await this.provider.getFeeData();
        if (!feeData.gasPrice) throw new Error("Could not retrieve gas price");

        const gasCost = feeData.gasPrice * BigInt(env.GAS_LIMIT);
        const refundAmount = balance - gasCost;

        if (refundAmount <= 0n) {
          throw new Error("Insufficient balance for gas fees on refund");
        }

        const tx = await masterWallet.sendTransaction({
          to: toAddress,
          value: refundAmount,
          gasLimit: env.GAS_LIMIT,
          gasPrice: feeData.gasPrice,
        });

        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error("Refund transaction failed");
        }

        await updatePayment(paymentId, {
          status: "refunded",
          refundTxHash: tx.hash,
        });
      } else {
        const token = SUPPORTED_TOKENS[payment.currency];
        const contract = new ethers.Contract(token.address, ERC20_ABI, masterWallet);
        const balance = await contract.balanceOf(payment.address);

        if (balance <= 0n) {
          throw new Error("No token balance on payment address for refund");
        }

        const tx = await contract.transfer(toAddress, balance);
        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error("Refund transaction failed");
        }

        await updatePayment(paymentId, {
          status: "refunded",
          refundTxHash: tx.hash,
        });
      }

      const updated = (await getPaymentById(paymentId))!;
      const { privateKey, ...safe } = updated;

      await sendWebhookNotifications("payment.refunded", safe);
      logger.info("Payment refunded", { paymentId, toAddress });

      return safe;
    } catch (error) {
      logger.error("Refund failed", { paymentId, error });
      throw error;
    }
  }

  private startPollingService(): void {
    this.pollingInterval = setInterval(async () => {
      await this.expireTimedOutPayments();

      const pendingPayments = await getPaymentsByStatus("pending");
      if (pendingPayments.length === 0) return;

      logger.info(`Checking ${pendingPayments.length} pending payments`);

      for (const payment of pendingPayments) {
        if (payment.currency === "ETH") {
          await this.checkEthPayment(payment);
        } else {
          await this.checkTokenPayment(payment);
        }
      }
    }, env.POLLING_INTERVAL);
  }

  private async expireTimedOutPayments(): Promise<void> {
    const expired = await getExpiredPendingPayments();
    for (const payment of expired) {
      await updatePayment(payment.id, { status: "expired" });
      const { privateKey, ...safe } = { ...payment, status: "expired" as const };
      await sendWebhookNotifications("payment.expired", safe);
      logger.info("Payment expired", { paymentId: payment.id });
    }
  }

  private async checkEthPayment(payment: Payment): Promise<void> {
    try {
      const apiKey = env.ETHERSCAN_API_KEY || "YourApiKeyToken";
      const response = await axios.get(
        `https://api.etherscan.io/api?module=account&action=balance&address=${payment.address}&tag=latest&apikey=${apiKey}`,
        {
          timeout: 10000,
          headers: { "User-Agent": "EthereumPaymentProcessor/2.0" },
        }
      );

      if (response.data.status !== "1") {
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

      if (balanceWei <= 0n) return;

      if (parseFloat(balanceEth) >= expectedAmount) {
        await this.handleFullPayment(payment, balanceWei);
      } else if (parseFloat(balanceEth) > 0) {
        await this.handlePartialPayment(payment, balanceEth);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          logger.warn("Rate limited by Etherscan", { address: payment.address });
        } else {
          logger.error("Error checking ETH payment", { paymentId: payment.id, message: error.message });
        }
      } else {
        logger.error("Error checking ETH payment", { paymentId: payment.id, error });
      }
    }
  }

  private async checkTokenPayment(payment: Payment): Promise<void> {
    try {
      if (!payment.tokenAddress) return;

      const token = SUPPORTED_TOKENS[payment.currency];
      const contract = new ethers.Contract(payment.tokenAddress, ERC20_ABI, this.provider);
      const balance: bigint = await contract.balanceOf(payment.address);

      const formattedBalance = ethers.formatUnits(balance, token.decimals);
      const expectedAmount = parseFloat(payment.amount);

      logger.debug("Token balance check", {
        address: payment.address,
        token: payment.currency,
        balance: formattedBalance,
        expected: expectedAmount,
      });

      if (balance <= 0n) return;

      if (parseFloat(formattedBalance) >= expectedAmount) {
        await this.handleFullTokenPayment(payment, balance);
      } else if (parseFloat(formattedBalance) > 0) {
        await this.handlePartialPayment(payment, formattedBalance);
      }
    } catch (error) {
      logger.error("Error checking token payment", {
        paymentId: payment.id,
        token: payment.currency,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private async handleFullPayment(payment: Payment, balanceWei: bigint): Promise<void> {
    if (env.REQUIRED_CONFIRMATIONS > 0) {
      if (payment.confirmations < env.REQUIRED_CONFIRMATIONS) {
        const newConfirmations = payment.confirmations + 1;
        await updatePayment(payment.id, {
          confirmations: newConfirmations,
          receivedAmount: ethers.formatEther(balanceWei),
        });
        logger.info(`Payment confirmation ${newConfirmations}/${env.REQUIRED_CONFIRMATIONS}`, {
          paymentId: payment.id,
        });
        if (newConfirmations < env.REQUIRED_CONFIRMATIONS) return;
      }
    }

    logger.info("Payment received, forwarding", { paymentId: payment.id });
    await this.forwardEthPayment(payment, balanceWei);
  }

  private async handleFullTokenPayment(payment: Payment, balance: bigint): Promise<void> {
    const token = SUPPORTED_TOKENS[payment.currency];
    const formattedBalance = ethers.formatUnits(balance, token.decimals);

    if (env.REQUIRED_CONFIRMATIONS > 0 && payment.confirmations < env.REQUIRED_CONFIRMATIONS) {
      const newConfirmations = payment.confirmations + 1;
      await updatePayment(payment.id, {
        confirmations: newConfirmations,
        receivedAmount: formattedBalance,
      });
      logger.info(`Token payment confirmation ${newConfirmations}/${env.REQUIRED_CONFIRMATIONS}`, {
        paymentId: payment.id,
      });
      if (newConfirmations < env.REQUIRED_CONFIRMATIONS) return;
    }

    logger.info("Token payment received, forwarding", {
      paymentId: payment.id,
      token: payment.currency,
    });
    await this.forwardTokenPayment(payment, balance);
  }

  private async handlePartialPayment(payment: Payment, receivedAmount: string): Promise<void> {
    if (payment.status !== "partial") {
      await updatePayment(payment.id, {
        status: "partial",
        receivedAmount,
      });
      const updated = (await getPaymentById(payment.id))!;
      const { privateKey, ...safe } = updated;
      await sendWebhookNotifications("payment.partial", safe);
      logger.warn("Partial payment detected", {
        paymentId: payment.id,
        received: receivedAmount,
        expected: payment.amount,
      });
    } else {
      await updatePayment(payment.id, { receivedAmount });
    }
  }

  private async forwardEthPayment(payment: Payment, balanceWei: bigint): Promise<void> {
    try {
      const paymentWallet = new ethers.Wallet(payment.privateKey, this.provider);

      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice) throw new Error("Could not retrieve gas price");

      const gasPrice = feeData.gasPrice;
      const gasCost = gasPrice * BigInt(env.GAS_LIMIT);
      const amountToSend = balanceWei - gasCost;

      if (amountToSend <= 0n) {
        logger.error("Insufficient ETH for gas fees", {
          balance: ethers.formatEther(balanceWei),
          gasCost: ethers.formatEther(gasCost),
        });
        await updatePayment(payment.id, { status: "failed" });
        const updated = (await getPaymentById(payment.id))!;
        const { privateKey, ...safe } = updated;
        await sendWebhookNotifications("payment.failed", safe);
        return;
      }

      const tx = await paymentWallet.sendTransaction({
        to: env.MASTER_ADDRESS,
        value: amountToSend,
        gasLimit: env.GAS_LIMIT,
        gasPrice,
      });

      logger.info("Transaction sent", { txHash: tx.hash });

      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        const gasUsed = receipt.gasUsed.toString();
        const totalGasCost = ethers.formatEther(receipt.gasUsed * gasPrice);

        await updatePayment(payment.id, {
          status: "completed",
          completedAt: new Date(),
          txHash: tx.hash,
          receivedAmount: ethers.formatEther(balanceWei),
          gasUsed,
          gasCost: totalGasCost,
        });

        const updated = (await getPaymentById(payment.id))!;
        const { privateKey, ...safe } = updated;
        await sendWebhookNotifications("payment.completed", safe);

        logger.info("Payment forwarded successfully", {
          paymentId: payment.id,
          txHash: tx.hash,
          gasCost: totalGasCost,
        });
      } else {
        await updatePayment(payment.id, { status: "failed" });
        const updated = (await getPaymentById(payment.id))!;
        const { privateKey, ...safe } = updated;
        await sendWebhookNotifications("payment.failed", safe);
        logger.error("Transaction failed", { txHash: tx.hash });
      }
    } catch (error) {
      logger.error("Error forwarding ETH payment", { paymentId: payment.id, error });
      await updatePayment(payment.id, { status: "failed" });
      const updated = (await getPaymentById(payment.id))!;
      const { privateKey, ...safe } = updated;
      await sendWebhookNotifications("payment.failed", safe);
    }
  }

  private async forwardTokenPayment(payment: Payment, balance: bigint): Promise<void> {
    try {
      if (!payment.tokenAddress) throw new Error("No token address");
      const token = SUPPORTED_TOKENS[payment.currency];

      const paymentWallet = new ethers.Wallet(payment.privateKey, this.provider);
      const contract = new ethers.Contract(payment.tokenAddress, ERC20_ABI, paymentWallet);

      const ethBalance = await this.provider.getBalance(payment.address);
      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice) throw new Error("Could not retrieve gas price");

      const erc20GasLimit = 65000;
      const gasCost = feeData.gasPrice * BigInt(erc20GasLimit);

      if (ethBalance < gasCost) {
        logger.warn("Payment address needs ETH for token transfer gas", {
          paymentId: payment.id,
          ethBalance: ethers.formatEther(ethBalance),
          requiredGas: ethers.formatEther(gasCost),
        });
        return;
      }

      const tx = await contract.transfer(env.MASTER_ADDRESS, balance);
      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        const gasUsed = receipt.gasUsed.toString();
        const totalGasCost = ethers.formatEther(receipt.gasUsed * feeData.gasPrice);

        await updatePayment(payment.id, {
          status: "completed",
          completedAt: new Date(),
          txHash: tx.hash,
          receivedAmount: ethers.formatUnits(balance, token.decimals),
          gasUsed,
          gasCost: totalGasCost,
        });

        const updated = (await getPaymentById(payment.id))!;
        const { privateKey, ...safe } = updated;
        await sendWebhookNotifications("payment.completed", safe);

        logger.info("Token payment forwarded", {
          paymentId: payment.id,
          token: payment.currency,
          txHash: tx.hash,
        });
      } else {
        await updatePayment(payment.id, { status: "failed" });
        const updated = (await getPaymentById(payment.id))!;
        const { privateKey, ...safe } = updated;
        await sendWebhookNotifications("payment.failed", safe);
      }
    } catch (error) {
      logger.error("Error forwarding token payment", { paymentId: payment.id, error });
      await updatePayment(payment.id, { status: "failed" });
      const updated = (await getPaymentById(payment.id))!;
      const { privateKey, ...safe } = updated;
      await sendWebhookNotifications("payment.failed", safe);
    }
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
