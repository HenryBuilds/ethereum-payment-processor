import type {
  Payment,
  SafePayment,
  Merchant,
  Webhook,
  WebhookEvent,
  AnalyticsSummary,
  PriceData,
} from "@server/types";

export type { Payment, SafePayment, Merchant, Webhook, WebhookEvent, AnalyticsSummary, PriceData };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// Client-side rate limiter + cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL: Record<string, number> = {
  "/analytics/summary": 15_000,
  "/merchants": 30_000,
  "/webhooks": 30_000,
};
const MIN_REQUEST_INTERVAL = 1_000;
let lastRequestTime = 0;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() || "GET";
  const cacheKey = `${method}:${path}`;

  // Cache check for GET requests
  if (method === "GET") {
    const ttl = Object.entries(CACHE_TTL).find(([key]) => path.startsWith(key))?.[1];
    if (ttl) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as T;
      }
    }
  }

  // Throttle: wait if last request was too recent
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  const data = await res.json();

  // Store in cache for GET requests
  if (method === "GET") {
    cache.set(cacheKey, { data, timestamp: Date.now() });
  } else {
    // Invalidate cache on mutations
    cache.clear();
  }

  return data;
}

// Health
export function getHealth() {
  return request<{ status: string; timestamp: string; uptime: number }>("/health");
}

// Payments
export function createPayment(data: { amount: string; orderId: string; currency?: string; merchantId?: string }) {
  return request<{ success: true; data: { paymentId: string; address: string; amount: string; currency: string; expiresAt: string } }>(
    "/payment/create",
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function getPaymentStatus(paymentId: string) {
  return request<{ success: true; data: SafePayment }>(`/payment/${paymentId}/status`);
}

export function cancelPayment(paymentId: string) {
  return request<{ success: true; data: SafePayment }>(`/payment/${paymentId}/cancel`, { method: "POST" });
}

export function refundPayment(paymentId: string, toAddress: string) {
  return request<{ success: true; data: SafePayment }>(
    `/payment/${paymentId}/refund`,
    { method: "POST", body: JSON.stringify({ toAddress }) }
  );
}

export function getPayments(params?: {
  status?: string;
  currency?: string;
  merchantId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return request<{
    success: true;
    data: SafePayment[];
    pagination: { total: number; page: number; limit: number; pages: number };
  }>(`/payments${qs ? `?${qs}` : ""}`);
}

export function exportPayments(format: "csv" | "json", params?: { status?: string; currency?: string }) {
  const query = new URLSearchParams({ format });
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.set(k, v);
    });
  }
  return `${API_BASE}/payments/export?${query.toString()}`;
}

// Merchants
export function registerMerchant(data: { name: string; email?: string }) {
  return request<{ success: true; data: Merchant }>("/merchant/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMerchants() {
  return request<{ success: true; data: Merchant[] }>("/merchants");
}

export function getMerchantPayments(merchantId: string, params?: { status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return request<{ success: true; data: SafePayment[]; pagination: { total: number } }>(
    `/merchant/${merchantId}/payments${qs ? `?${qs}` : ""}`
  );
}

// Webhooks
export function registerWebhook(data: { url: string; events: WebhookEvent[]; merchantId?: string }) {
  return request<{ success: true; data: Webhook }>("/webhook/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getWebhooks() {
  return request<{ success: true; data: Webhook[] }>("/webhooks");
}

export function deleteWebhook(webhookId: string) {
  return request<{ success: true }>(`/webhook/${webhookId}`, { method: "DELETE" });
}

// Analytics
export function getAnalytics(params?: { from?: string; to?: string; merchantId?: string }) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.set(k, v);
    });
  }
  const qs = query.toString();
  return request<{ success: true; data: AnalyticsSummary }>(`/analytics/summary${qs ? `?${qs}` : ""}`);
}

// Price - fetches directly from CoinGecko, cached for 60s
let ethPriceCache: { data: { success: true; data: PriceData }; timestamp: number } | null = null;
const ETH_PRICE_TTL = 60_000;

export async function getEthPrice(): Promise<{ success: true; data: PriceData }> {
  if (ethPriceCache && Date.now() - ethPriceCache.timestamp < ETH_PRICE_TTL) {
    return ethPriceCache.data;
  }

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (!res.ok) throw new Error("CoinGecko request failed");
    const json = await res.json();
    const result = { success: true as const, data: { ethUsd: json.ethereum.usd, updatedAt: new Date() } };
    ethPriceCache = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return request<{ success: true; data: PriceData }>("/price/eth-usd");
  }
}

export function convertPrice(amount: number, from: "ETH" | "USD", to: "ETH" | "USD") {
  return request<{
    success: true;
    data: { from: string; to: string; inputAmount: string; outputAmount: string; rate: number };
  }>(`/price/convert?amount=${amount}&from=${from}&to=${to}`);
}
