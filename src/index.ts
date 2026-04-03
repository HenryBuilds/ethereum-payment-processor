import express from "express";
import cors from "cors";
import { env } from "./env";
import { EthereumPaymentProcessor } from "./EthereumPaymentProcessor";
import { CreatePaymentRequest, CreateMerchantRequest, RegisterWebhookRequest, SUPPORTED_TOKENS, SafePayment, AnalyticsSummary } from "./types";
import logger from "./logger";
import { initDatabase, closeDatabase, getAllPayments, insertMerchant, getMerchantById, getAllMerchants, insertWebhook, getAllWebhooks, getWebhooksByMerchant, deleteWebhook, getAnalytics } from "./database";
import { apiKeyAuth, rateLimiter, demoGuard } from "./middleware";
import { getEthPrice, ethToUsd, usdToEth } from "./priceService";

async function main() {
  await initDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(rateLimiter);
  app.use(apiKeyAuth);
  app.use(demoGuard);

  const paymentProcessor = new EthereumPaymentProcessor();

  // Health

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Payments

  app.post("/payment/create", async (req, res) => {
    try {
      const { amount, orderId, currency, merchantId } = req.body as CreatePaymentRequest;

      if (!amount || !orderId) {
        return res.status(400).json({ error: "Amount and orderId are required" });
      }

      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      if (currency && currency.toUpperCase() !== "ETH" && !SUPPORTED_TOKENS[currency.toUpperCase()]) {
        return res.status(400).json({
          error: `Unsupported currency. Supported: ETH, ${Object.keys(SUPPORTED_TOKENS).join(", ")}`,
        });
      }

      const payment = await paymentProcessor.createPayment({ amount, orderId, currency, merchantId });
      res.json({ success: true, data: payment });
    } catch (error) {
      logger.error("Error creating payment", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/payment/:paymentId/status", async (req, res) => {
    try {
      const payment = await paymentProcessor.getPaymentStatus(req.params.paymentId);

      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const { privateKey, ...safePayment } = payment;
      res.json({ success: true, data: safePayment });
    } catch (error) {
      logger.error("Error retrieving payment status", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/payment/:paymentId/cancel", async (req, res) => {
    try {
      const safe = await paymentProcessor.cancelPayment(req.params.paymentId);
      res.json({ success: true, data: safe });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = message.includes("not found") ? 404 : message.includes("Cannot cancel") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post("/payment/:paymentId/refund", async (req, res) => {
    try {
      const { toAddress } = req.body;
      if (!toAddress || !toAddress.startsWith("0x") || toAddress.length !== 42) {
        return res.status(400).json({ error: "Valid toAddress (0x..., 42 chars) is required" });
      }

      const safe = await paymentProcessor.refundPayment(req.params.paymentId, toAddress);
      res.json({ success: true, data: safe });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = message.includes("not found") ? 404 : message.includes("Cannot refund") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.get("/payments", async (req, res) => {
    try {
      const { status, currency, merchantId, from, to, page, limit } = req.query;

      const result = await getAllPayments({
        status: status as string,
        currency: currency as string,
        merchantId: merchantId as string,
        from: from as string,
        to: to as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      const safePayments: SafePayment[] = result.payments.map(({ privateKey, ...rest }) => rest);

      res.json({
        success: true,
        data: safePayments,
        pagination: {
          total: result.total,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
          pages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 50)),
        },
      });
    } catch (error) {
      logger.error("Error retrieving payments", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/payments/export", async (req, res) => {
    try {
      const { status, currency, merchantId, from, to, format } = req.query;
      const exportFormat = (format as string)?.toLowerCase() || "json";

      const result = await getAllPayments({
        status: status as string,
        currency: currency as string,
        merchantId: merchantId as string,
        from: from as string,
        to: to as string,
        limit: 10000,
      });

      const safePayments: SafePayment[] = result.payments.map(({ privateKey, ...rest }) => rest);

      if (exportFormat === "csv") {
        const headers = [
          "id", "orderId", "merchantId", "address", "amount", "currency",
          "status", "receivedAmount", "txHash", "gasCost", "confirmations",
          "createdAt", "completedAt", "expiresAt",
        ];

        const csvRows = [headers.join(",")];
        for (const p of safePayments) {
          csvRows.push([
            p.id, p.orderId, p.merchantId ?? "", p.address, p.amount, p.currency,
            p.status, p.receivedAmount ?? "", p.txHash ?? "", p.gasCost ?? "",
            p.confirmations, p.createdAt.toISOString(),
            p.completedAt?.toISOString() ?? "", p.expiresAt?.toISOString() ?? "",
          ].map((v) => `"${v}"`).join(","));
        }

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=payments.csv");
        res.send(csvRows.join("\n"));
      } else {
        res.json({ success: true, data: safePayments, total: result.total });
      }
    } catch (error) {
      logger.error("Error exporting payments", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Merchants

  app.post("/merchant/register", async (req, res) => {
    try {
      const { name, email } = req.body as CreateMerchantRequest;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const merchant = {
        id: crypto.randomUUID(),
        name,
        email: email || null,
        apiKey: `mk_${crypto.randomUUID().replace(/-/g, "")}`,
        createdAt: new Date(),
      };

      await insertMerchant(merchant);
      logger.info("Merchant registered", { merchantId: merchant.id, name });

      res.json({ success: true, data: merchant });
    } catch (error) {
      logger.error("Error registering merchant", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/merchants", async (_req, res) => {
    try {
      const merchants = await getAllMerchants();
      res.json({ success: true, data: merchants });
    } catch (error) {
      logger.error("Error listing merchants", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/merchant/:merchantId", async (req, res) => {
    try {
      const merchant = await getMerchantById(req.params.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json({ success: true, data: merchant });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/merchant/:merchantId/payments", async (req, res) => {
    try {
      const merchant = await getMerchantById(req.params.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const { status, page, limit } = req.query;
      const result = await getAllPayments({
        merchantId: req.params.merchantId,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      const safePayments: SafePayment[] = result.payments.map(({ privateKey, ...rest }) => rest);

      res.json({
        success: true,
        data: safePayments,
        pagination: {
          total: result.total,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Webhooks

  app.post("/webhook/register", async (req, res) => {
    try {
      const { url, events, merchantId } = req.body as RegisterWebhookRequest;

      if (!url || !events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "url and events[] are required" });
      }

      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid webhook URL" });
      }

      const validEvents = [
        "payment.completed", "payment.failed", "payment.expired",
        "payment.partial", "payment.cancelled", "payment.refunded",
      ];
      for (const event of events) {
        if (!validEvents.includes(event)) {
          return res.status(400).json({ error: `Invalid event: ${event}. Valid: ${validEvents.join(", ")}` });
        }
      }

      const webhook = {
        id: crypto.randomUUID(),
        merchantId: merchantId || null,
        url,
        secret: crypto.randomUUID(),
        events,
        active: true,
        createdAt: new Date(),
      };

      await insertWebhook(webhook);
      logger.info("Webhook registered", { webhookId: webhook.id, url });

      res.json({ success: true, data: webhook });
    } catch (error) {
      logger.error("Error registering webhook", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/webhooks", async (req, res) => {
    try {
      const { merchantId } = req.query;
      const webhooks = merchantId
        ? await getWebhooksByMerchant(merchantId as string)
        : await getAllWebhooks();
      res.json({ success: true, data: webhooks });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/webhook/:webhookId", async (req, res) => {
    try {
      const deleted = await deleteWebhook(req.params.webhookId);
      if (!deleted) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json({ success: true, message: "Webhook deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics

  app.get("/analytics/summary", async (req, res) => {
    try {
      const { from, to, merchantId } = req.query;

      const raw = await getAnalytics({
        from: from as string,
        to: to as string,
        merchantId: merchantId as string,
      });

      const summary: AnalyticsSummary = {
        totalPayments: raw.totalPayments,
        completedPayments: raw.byStatus["completed"] ?? 0,
        failedPayments: raw.byStatus["failed"] ?? 0,
        expiredPayments: raw.byStatus["expired"] ?? 0,
        pendingPayments: raw.byStatus["pending"] ?? 0,
        totalVolumeETH: String(raw.totalVolumeETH),
        totalGasCostETH: String(raw.totalGasCost),
        averagePaymentETH: raw.completedCount > 0
          ? String(raw.totalVolumeETH / raw.completedCount)
          : "0",
        byStatus: raw.byStatus,
        byCurrency: raw.byCurrency,
      };

      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error("Error computing analytics", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Price

  app.get("/price/eth-usd", async (_req, res) => {
    try {
      const price = await getEthPrice();
      res.json({ success: true, data: price });
    } catch (error) {
      res.status(500).json({ error: "Unable to fetch ETH price" });
    }
  });

  app.get("/price/convert", async (req, res) => {
    try {
      const { amount, from, to } = req.query;

      if (!amount || !from || !to) {
        return res.status(400).json({ error: "amount, from, and to query params required" });
      }

      const price = await getEthPrice();
      const numAmount = parseFloat(amount as string);

      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let result: string;
      if ((from as string).toUpperCase() === "ETH" && (to as string).toUpperCase() === "USD") {
        result = ethToUsd(numAmount, price.ethUsd);
      } else if ((from as string).toUpperCase() === "USD" && (to as string).toUpperCase() === "ETH") {
        result = usdToEth(numAmount, price.ethUsd);
      } else {
        return res.status(400).json({ error: "Only ETH<->USD conversion supported" });
      }

      res.json({
        success: true,
        data: {
          from: (from as string).toUpperCase(),
          to: (to as string).toUpperCase(),
          inputAmount: String(numAmount),
          outputAmount: result,
          rate: price.ethUsd,
          updatedAt: price.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Unable to convert price" });
    }
  });

  // Start Server

  const PORT = env.PORT;

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API Key auth enabled`);
    logger.info(`Rate limiting: ${env.RATE_LIMIT_MAX} requests per ${env.RATE_LIMIT_WINDOW_MS}ms`);
    logger.info(`Payment timeout: ${env.PAYMENT_TIMEOUT_MINUTES} minutes`);
    logger.info(`Required confirmations: ${env.REQUIRED_CONFIRMATIONS}`);
    logger.info(`Supported currencies: ETH, ${Object.keys(SUPPORTED_TOKENS).join(", ")}`);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down payment processor");
    paymentProcessor.stop();
    await closeDatabase();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("Shutting down payment processor");
    paymentProcessor.stop();
    await closeDatabase();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
