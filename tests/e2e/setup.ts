import express from "express";
import type { Server } from "http";

const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const API_KEY = "test-api-key-here";

let server: Server;

export { BASE_URL, API_KEY };

export async function startTestServer(): Promise<void> {
  // Set env BEFORE any src imports
  process.env.MASTER_ADDRESS = "0x0000000000000000000000000000000000000000";
  process.env.RPC_URL = "https://mainnet.infura.io/v3/test";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://processor:processor@localhost:5435/eth_payments_test";
  process.env.API_KEY = API_KEY;
  process.env.ETHERSCAN_API_KEY = "test";
  process.env.PORT = String(TEST_PORT);
  process.env.PAYMENT_TIMEOUT_MINUTES = "60";
  process.env.REQUIRED_CONFIRMATIONS = "1";
  process.env.LOG_LEVEL = "error";
  process.env.RATE_LIMIT_MAX = "1000";
  process.env.RATE_LIMIT_WINDOW_MS = "60000";
  process.env.GAS_LIMIT = "21000";
  process.env.POLLING_INTERVAL = "30000";

  // Dynamic imports AFTER env is set
  const { initDatabase } = await import("../../src/database");
  await initDatabase();

  const { EthereumPaymentProcessor } = await import("../../src/EthereumPaymentProcessor");
  const { apiKeyAuth, rateLimiter } = await import("../../src/middleware");
  const { getAllPayments, insertMerchant, getMerchantById, getAllMerchants, insertWebhook, getAllWebhooks, getWebhooksByMerchant, deleteWebhook, getAnalytics } = await import("../../src/database");
  const { SUPPORTED_TOKENS } = await import("../../src/types");

  const app = express();
  app.use(express.json());
  app.use(rateLimiter);
  app.use(apiKeyAuth);

  const processor = new EthereumPaymentProcessor();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  app.post("/payment/create", async (req, res) => {
    try {
      const { amount, orderId, currency, merchantId } = req.body;
      if (!amount || !orderId) return res.status(400).json({ error: "Amount and orderId are required" });
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return res.status(400).json({ error: "Invalid amount" });
      const payment = await processor.createPayment({ amount, orderId, currency, merchantId });
      res.json({ success: true, data: payment });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/payment/:paymentId/status", async (req, res) => {
    try {
      const payment = await processor.getPaymentStatus(req.params.paymentId);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      const { privateKey, ...safe } = payment;
      res.json({ success: true, data: safe });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/payment/:paymentId/cancel", async (req, res) => {
    try {
      const safe = await processor.cancelPayment(req.params.paymentId);
      res.json({ success: true, data: safe });
    } catch (error: any) {
      const message = error.message || "Internal server error";
      const status = message.includes("not found") ? 404 : message.includes("Cannot cancel") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.get("/payments", async (req, res) => {
    try {
      const { status, currency, merchantId, from, to, page, limit } = req.query;
      const result = await getAllPayments({
        status: status as string, currency: currency as string, merchantId: merchantId as string,
        from: from as string, to: to as string,
        page: page ? parseInt(page as string) : undefined, limit: limit ? parseInt(limit as string) : undefined,
      });
      const data = result.payments.map(({ privateKey, ...rest }) => rest);
      res.json({ success: true, data, pagination: { total: result.total, page: page ? parseInt(page as string) : 1, limit: limit ? parseInt(limit as string) : 50, pages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 50)) } });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/payments/export", async (req, res) => {
    try {
      const { format } = req.query;
      const result = await getAllPayments({ limit: 10000 });
      const data = result.payments.map(({ privateKey, ...rest }) => rest);
      if (format === "csv") {
        const headers = ["id", "orderId", "amount", "currency", "status"];
        const rows = [headers.join(","), ...data.map((p) => [p.id, p.orderId, p.amount, p.currency, p.status].map((v) => `"${v}"`).join(","))];
        res.setHeader("Content-Type", "text/csv");
        res.send(rows.join("\n"));
      } else {
        res.json({ success: true, data, total: result.total });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/merchant/register", async (req, res) => {
    try {
      const { name, email } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const merchant = { id: crypto.randomUUID(), name, email: email || null, apiKey: `mk_${crypto.randomUUID().replace(/-/g, "")}`, createdAt: new Date() };
      await insertMerchant(merchant);
      res.json({ success: true, data: merchant });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/merchants", async (_req, res) => {
    try {
      const merchants = await getAllMerchants();
      res.json({ success: true, data: merchants });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/webhook/register", async (req, res) => {
    try {
      const { url, events, merchantId } = req.body;
      if (!url || !events || events.length === 0) return res.status(400).json({ error: "url and events[] are required" });
      const webhook = { id: crypto.randomUUID(), merchantId: merchantId || null, url, secret: crypto.randomUUID(), events, active: true, createdAt: new Date() };
      await insertWebhook(webhook);
      res.json({ success: true, data: webhook });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/webhooks", async (_req, res) => {
    try {
      const webhooks = await getAllWebhooks();
      res.json({ success: true, data: webhooks });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/webhook/:webhookId", async (req, res) => {
    try {
      const deleted = await deleteWebhook(req.params.webhookId);
      if (!deleted) return res.status(404).json({ error: "Webhook not found" });
      res.json({ success: true, message: "Webhook deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/analytics/summary", async (_req, res) => {
    try {
      const raw = await getAnalytics();
      res.json({ success: true, data: { totalPayments: raw.totalPayments, completedPayments: raw.byStatus["completed"] ?? 0, failedPayments: raw.byStatus["failed"] ?? 0, pendingPayments: raw.byStatus["pending"] ?? 0, expiredPayments: raw.byStatus["expired"] ?? 0, totalVolumeETH: String(raw.totalVolumeETH), totalGasCostETH: String(raw.totalGasCost), averagePaymentETH: "0", byStatus: raw.byStatus, byCurrency: raw.byCurrency } });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
}

export async function stopTestServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  const { closeDatabase } = await import("../../src/database");
  await closeDatabase();
}
