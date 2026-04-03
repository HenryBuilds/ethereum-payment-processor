import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { eq, and, gte, lte, sql, count, desc, isNotNull } from "drizzle-orm";
import path from "path";
import logger from "./logger";
import { env } from "./env";
import { Payment, Merchant, Webhook, WebhookEvent } from "./types";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>>;
let client: postgres.Sql;

export async function initDatabase(): Promise<void> {
  client = postgres(env.DATABASE_URL);
  db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  logger.info("Database initialized");
}

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

// Payment Queries

function rowToPayment(row: typeof schema.payments.$inferSelect): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    merchantId: row.merchantId,
    address: row.address,
    privateKey: row.privateKey,
    amount: row.amount,
    currency: row.currency,
    tokenAddress: row.tokenAddress,
    status: row.status as Payment["status"],
    receivedAmount: row.receivedAmount,
    txHash: row.txHash,
    refundTxHash: row.refundTxHash,
    gasUsed: row.gasUsed,
    gasCost: row.gasCost,
    confirmations: row.confirmations,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    expiresAt: row.expiresAt,
  };
}

export async function insertPayment(payment: Payment): Promise<void> {
  await getDb().insert(schema.payments).values({
    id: payment.id,
    orderId: payment.orderId,
    merchantId: payment.merchantId,
    address: payment.address,
    privateKey: payment.privateKey,
    amount: payment.amount,
    currency: payment.currency,
    tokenAddress: payment.tokenAddress,
    status: payment.status,
    receivedAmount: payment.receivedAmount,
    txHash: payment.txHash,
    refundTxHash: payment.refundTxHash,
    gasUsed: payment.gasUsed,
    gasCost: payment.gasCost,
    confirmations: payment.confirmations,
    createdAt: payment.createdAt,
    completedAt: payment.completedAt,
    expiresAt: payment.expiresAt,
  });
}

export async function updatePayment(id: string, updates: Partial<Omit<Payment, "id">>): Promise<void> {
  if (Object.keys(updates).length === 0) return;
  await getDb().update(schema.payments).set(updates).where(eq(schema.payments.id, id));
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const rows = await getDb().select().from(schema.payments).where(eq(schema.payments.id, id));
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function getPaymentsByStatus(status: string): Promise<Payment[]> {
  const rows = await getDb().select().from(schema.payments).where(eq(schema.payments.status, status));
  return rows.map(rowToPayment);
}

export async function getAllPayments(filters?: {
  status?: string;
  currency?: string;
  merchantId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ payments: Payment[]; total: number }> {
  const conditions = [];

  if (filters?.status) conditions.push(eq(schema.payments.status, filters.status));
  if (filters?.currency) conditions.push(eq(schema.payments.currency, filters.currency));
  if (filters?.merchantId) conditions.push(eq(schema.payments.merchantId, filters.merchantId));
  if (filters?.from) conditions.push(gte(schema.payments.createdAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(schema.payments.createdAt, new Date(filters.to)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const offset = (page - 1) * limit;

  const [countResult] = await getDb()
    .select({ count: count() })
    .from(schema.payments)
    .where(where);
  const total = countResult?.count ?? 0;

  const rows = await getDb()
    .select()
    .from(schema.payments)
    .where(where)
    .orderBy(desc(schema.payments.createdAt))
    .limit(limit)
    .offset(offset);

  return { payments: rows.map(rowToPayment), total };
}

export async function getExpiredPendingPayments(): Promise<Payment[]> {
  const rows = await getDb()
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.status, "pending"),
        isNotNull(schema.payments.expiresAt),
        lte(schema.payments.expiresAt, new Date())
      )
    );
  return rows.map(rowToPayment);
}

// Merchant Queries

function rowToMerchant(row: typeof schema.merchants.$inferSelect): Merchant {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    apiKey: row.apiKey,
    createdAt: row.createdAt,
  };
}

export async function insertMerchant(merchant: Merchant): Promise<void> {
  await getDb().insert(schema.merchants).values({
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    apiKey: merchant.apiKey,
    createdAt: merchant.createdAt,
  });
}

export async function getMerchantById(id: string): Promise<Merchant | null> {
  const rows = await getDb().select().from(schema.merchants).where(eq(schema.merchants.id, id));
  return rows[0] ? rowToMerchant(rows[0]) : null;
}

export async function getMerchantByApiKey(apiKey: string): Promise<Merchant | null> {
  const rows = await getDb().select().from(schema.merchants).where(eq(schema.merchants.apiKey, apiKey));
  return rows[0] ? rowToMerchant(rows[0]) : null;
}

export async function getAllMerchants(): Promise<Merchant[]> {
  const rows = await getDb()
    .select()
    .from(schema.merchants)
    .orderBy(desc(schema.merchants.createdAt));
  return rows.map(rowToMerchant);
}

// Webhook Queries

function rowToWebhook(row: typeof schema.webhooks.$inferSelect): Webhook {
  return {
    id: row.id,
    merchantId: row.merchantId,
    url: row.url,
    secret: row.secret,
    events: JSON.parse(row.events),
    active: row.active,
    createdAt: row.createdAt,
  };
}

export async function insertWebhook(webhook: Webhook): Promise<void> {
  await getDb().insert(schema.webhooks).values({
    id: webhook.id,
    merchantId: webhook.merchantId,
    url: webhook.url,
    secret: webhook.secret,
    events: JSON.stringify(webhook.events),
    active: webhook.active,
    createdAt: webhook.createdAt,
  });
}

export async function getWebhooksByEvent(event: string): Promise<Webhook[]> {
  const rows = await getDb()
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.active, true));
  return rows.map(rowToWebhook).filter((w) => w.events.includes(event as WebhookEvent));
}

export async function getWebhooksByMerchant(merchantId: string): Promise<Webhook[]> {
  const rows = await getDb()
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.merchantId, merchantId), eq(schema.webhooks.active, true)));
  return rows.map(rowToWebhook);
}

export async function getAllWebhooks(): Promise<Webhook[]> {
  const rows = await getDb()
    .select()
    .from(schema.webhooks)
    .orderBy(desc(schema.webhooks.createdAt));
  return rows.map(rowToWebhook);
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const result = await getDb().delete(schema.webhooks).where(eq(schema.webhooks.id, id)).returning({ id: schema.webhooks.id });
  return result.length > 0;
}

// Analytics Queries

export async function getAnalytics(filters?: { from?: string; to?: string; merchantId?: string }): Promise<{
  totalPayments: number;
  byStatus: Record<string, number>;
  byCurrency: Record<string, { count: number; volume: string }>;
  totalVolumeETH: number;
  totalGasCost: number;
  completedCount: number;
}> {
  const conditions = [];

  if (filters?.from) conditions.push(gte(schema.payments.createdAt, new Date(filters.from)));
  if (filters?.to) conditions.push(lte(schema.payments.createdAt, new Date(filters.to)));
  if (filters?.merchantId) conditions.push(eq(schema.payments.merchantId, filters.merchantId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await getDb()
    .select({ count: count() })
    .from(schema.payments)
    .where(where);

  const statusRows = await getDb()
    .select({ status: schema.payments.status, count: count() })
    .from(schema.payments)
    .where(where)
    .groupBy(schema.payments.status);
  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  const currencyRows = await getDb()
    .select({
      currency: schema.payments.currency,
      count: count(),
      volume: sql<string>`COALESCE(SUM(CAST(${schema.payments.amount} AS DOUBLE PRECISION)), 0)`,
    })
    .from(schema.payments)
    .where(where)
    .groupBy(schema.payments.currency);
  const byCurrency: Record<string, { count: number; volume: string }> = {};
  for (const row of currencyRows) {
    byCurrency[row.currency] = { count: row.count, volume: String(row.volume) };
  }

  const ethConditions = [...conditions, eq(schema.payments.currency, "ETH")];
  const [volumeResult] = await getDb()
    .select({ volume: sql<number>`COALESCE(SUM(CAST(${schema.payments.amount} AS DOUBLE PRECISION)), 0)` })
    .from(schema.payments)
    .where(and(...ethConditions));

  const [gasResult] = await getDb()
    .select({ totalGas: sql<number>`COALESCE(SUM(CAST(${schema.payments.gasCost} AS DOUBLE PRECISION)), 0)` })
    .from(schema.payments)
    .where(where);

  return {
    totalPayments: totalResult?.count ?? 0,
    byStatus,
    byCurrency,
    totalVolumeETH: volumeResult?.volume ?? 0,
    totalGasCost: gasResult?.totalGas ?? 0,
    completedCount: byStatus["completed"] ?? 0,
  };
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    logger.info("Database closed");
  }
}
