import express from "express";
import { EthereumPaymentProcessor } from "./EthereumPaymentProcessor";
import { CreatePaymentRequest } from "./types";

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
    console.error("Error creating payment:", error);
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
    console.error("Error retrieving payment status:", error);
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
    console.error("Error retrieving payments:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Ethereum Payment Processor running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down payment processor");
  paymentProcessor.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down payment processor");
  paymentProcessor.stop();
  process.exit(0);
});
