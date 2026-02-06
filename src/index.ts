import express from "express";
import { env } from "./env";
import { EthereumPaymentProcessor } from "./EthereumPaymentProcessor";
import { CreatePaymentRequest } from "./types";
import logger from "./logger";

const app = express();
app.use(express.json());

const paymentProcessor = new EthereumPaymentProcessor();

app.post("/payment/create", (req, res) => {
  try {
    const { amount, orderId } = req.body as CreatePaymentRequest;

    if (!amount || !orderId) {
      return res.status(400).json({
        error: "Amount and orderId are required",
      });
    }

    // Validierung des Betrags
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
      });
    }

    const payment = paymentProcessor.createPayment({ amount, orderId });

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    logger.error("Error creating payment", { error });
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.get("/payment/:paymentId/status", (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = paymentProcessor.getPaymentStatus(paymentId);

    if (!payment) {
      return res.status(404).json({
        error: "Payment not found",
      });
    }

    const { privateKey, ...safePayment } = payment;

    res.json({
      success: true,
      data: safePayment,
    });
  } catch (error) {
    logger.error("Error retrieving payment status", { error });
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.get("/payments", (req, res) => {
  try {
    const payments = paymentProcessor.getAllPayments().map((payment) => {
      const { privateKey, ...safePayment } = payment;
      return safePayment;
    });

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    logger.error("Error retrieving payments", { error });
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down payment processor");
  paymentProcessor.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Shutting down payment processor");
  paymentProcessor.stop();
  process.exit(0);
});
