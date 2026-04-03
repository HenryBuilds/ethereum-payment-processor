import { pgTable, text, integer, boolean, index, timestamp } from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  apiKey: text("api_key").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_merchants_api_key").on(table.apiKey),
]);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  merchantId: text("merchant_id").references(() => merchants.id),
  address: text("address").notNull(),
  privateKey: text("private_key").notNull(),
  amount: text("amount").notNull(),
  currency: text("currency").notNull().default("ETH"),
  tokenAddress: text("token_address"),
  status: text("status").notNull().default("pending"),
  receivedAmount: text("received_amount"),
  txHash: text("tx_hash"),
  refundTxHash: text("refund_tx_hash"),
  gasUsed: text("gas_used"),
  gasCost: text("gas_cost"),
  confirmations: integer("confirmations").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  index("idx_payments_status").on(table.status),
  index("idx_payments_merchant").on(table.merchantId),
  index("idx_payments_order").on(table.orderId),
  index("idx_payments_created").on(table.createdAt),
]);

export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").references(() => merchants.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull(), // JSON string
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_webhooks_merchant").on(table.merchantId),
]);
