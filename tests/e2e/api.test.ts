import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, stopTestServer, BASE_URL, API_KEY } from "./setup";

function authed(headers: Record<string, string> = {}) {
  return { "Content-Type": "application/json", "X-API-Key": API_KEY, ...headers };
}

async function api(path: string, options?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, options);
}

beforeAll(async () => {
  await startTestServer();
}, 30000);

afterAll(async () => {
  await stopTestServer();
});

describe("Health", () => {
  it("GET /health returns ok without auth", async () => {
    const res = await api("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});

describe("Auth", () => {
  it("rejects requests without API key", async () => {
    const res = await api("/payments");
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong API key", async () => {
    const res = await api("/payments", { headers: { "X-API-Key": "wrong" } });
    expect(res.status).toBe(403);
  });
});

describe("Payment CRUD", () => {
  let paymentId: string;

  it("POST /payment/create creates a payment", async () => {
    const res = await api("/payment/create", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ amount: "0.1", orderId: "E2E-001" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.paymentId).toBeDefined();
    expect(body.data.address).toMatch(/^0x/);
    expect(body.data.amount).toBe("0.1");
    expect(body.data.currency).toBe("ETH");
    expect(body.data.expiresAt).toBeDefined();
    paymentId = body.data.paymentId;
  });

  it("POST /payment/create validates amount", async () => {
    const res = await api("/payment/create", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ amount: "-1", orderId: "E2E-BAD" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /payment/create validates required fields", async () => {
    const res = await api("/payment/create", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /payment/create supports ERC-20 tokens", async () => {
    const res = await api("/payment/create", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ amount: "100", orderId: "E2E-USDT", currency: "USDT" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.currency).toBe("USDT");
  });

  it("GET /payment/:id/status returns payment", async () => {
    const res = await api(`/payment/${paymentId}/status`, { headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(paymentId);
    expect(body.data.status).toBe("pending");
    expect(body.data.orderId).toBe("E2E-001");
    // privateKey should not be exposed
    expect(body.data.privateKey).toBeUndefined();
  });

  it("GET /payment/:id/status returns 404 for unknown ID", async () => {
    const res = await api("/payment/nonexistent/status", { headers: authed() });
    expect(res.status).toBe(404);
  });

  it("POST /payment/:id/cancel cancels a pending payment", async () => {
    const res = await api(`/payment/${paymentId}/cancel`, { method: "POST", headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("cancelled");
  });

  it("POST /payment/:id/cancel rejects non-pending payment", async () => {
    const res = await api(`/payment/${paymentId}/cancel`, { method: "POST", headers: authed() });
    expect(res.status).toBe(400);
  });
});

describe("Payments List & Pagination", () => {
  it("GET /payments returns paginated list", async () => {
    const res = await api("/payments?limit=2&page=1", { headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(body.data.length).toBeLessThanOrEqual(2);
    // No privateKeys
    for (const p of body.data) {
      expect(p.privateKey).toBeUndefined();
    }
  });

  it("GET /payments filters by status", async () => {
    const res = await api("/payments?status=cancelled", { headers: authed() });
    const body = await res.json();
    for (const p of body.data) {
      expect(p.status).toBe("cancelled");
    }
  });

  it("GET /payments filters by currency", async () => {
    const res = await api("/payments?currency=USDT", { headers: authed() });
    const body = await res.json();
    for (const p of body.data) {
      expect(p.currency).toBe("USDT");
    }
  });
});

describe("Payments Export", () => {
  it("GET /payments/export?format=json returns JSON", async () => {
    const res = await api("/payments/export?format=json", { headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /payments/export?format=csv returns CSV", async () => {
    const res = await api("/payments/export?format=csv", { headers: authed() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("id");
    expect(text).toContain("orderId");
  });
});

describe("Merchants", () => {
  let merchantId: string;

  it("POST /merchant/register creates a merchant", async () => {
    const res = await api("/merchant/register", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ name: "Test Merchant", email: "test@example.com" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Test Merchant");
    expect(body.data.apiKey).toMatch(/^mk_/);
    expect(body.data.email).toBe("test@example.com");
    merchantId = body.data.id;
  });

  it("POST /merchant/register validates name", async () => {
    const res = await api("/merchant/register", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /merchants lists all merchants", async () => {
    const res = await api("/merchants", { headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.some((m: any) => m.id === merchantId)).toBe(true);
  });
});

describe("Webhooks", () => {
  let webhookId: string;

  it("POST /webhook/register creates a webhook", async () => {
    const res = await api("/webhook/register", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ url: "https://example.com/hook", events: ["payment.completed", "payment.failed"] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.url).toBe("https://example.com/hook");
    expect(body.data.events).toContain("payment.completed");
    expect(body.data.secret).toBeDefined();
    webhookId = body.data.id;
  });

  it("POST /webhook/register validates input", async () => {
    const res = await api("/webhook/register", {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ url: "https://example.com/hook" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /webhooks lists all webhooks", async () => {
    const res = await api("/webhooks", { headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("DELETE /webhook/:id deletes a webhook", async () => {
    const res = await api(`/webhook/${webhookId}`, { method: "DELETE", headers: authed() });
    expect(res.status).toBe(200);

    // Verify it's gone
    const list = await api("/webhooks", { headers: authed() });
    const body = await list.json();
    expect(body.data.some((w: any) => w.id === webhookId)).toBe(false);
  });

  it("DELETE /webhook/:id returns 404 for unknown ID", async () => {
    const res = await api("/webhook/nonexistent", { method: "DELETE", headers: authed() });
    expect(res.status).toBe(404);
  });
});

describe("Analytics", () => {
  it("GET /analytics/summary returns analytics data", async () => {
    const res = await api("/analytics/summary", { headers: authed() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalPayments).toBeGreaterThanOrEqual(2);
    expect(body.data.byStatus).toBeDefined();
    expect(body.data.byCurrency).toBeDefined();
    expect(body.data.totalVolumeETH).toBeDefined();
    expect(body.data.totalGasCostETH).toBeDefined();
  });
});
