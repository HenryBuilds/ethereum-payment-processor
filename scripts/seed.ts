import postgres from "postgres";
import crypto from "crypto";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL!);

// ── Helpers ──────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function randomHex(bytes: number): string {
  return "0x" + crypto.randomBytes(bytes).toString("hex");
}

function randomFloat(min: number, max: number, decimals: number): string {
  return (Math.random() * (max - min) + min).toFixed(decimals);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // add random hours/minutes within that day
  d.setHours(Math.floor(Math.random() * 24));
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  return d;
}

// ── Constants ────────────────────────────────────────────────────────

const TOKEN_ADDRESSES: Record<string, string> = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
};

const STATUSES = [
  ...Array(30).fill("completed"),
  ...Array(8).fill("pending"),
  ...Array(5).fill("failed"),
  ...Array(3).fill("expired"),
  ...Array(2).fill("partial"),
  ...Array(2).fill("cancelled"),
];

const CURRENCIES = [
  ...Array(35).fill("ETH"),
  ...Array(8).fill("USDT"),
  ...Array(5).fill("USDC"),
  ...Array(2).fill("DAI"),
];

// ── Merchants ────────────────────────────────────────────────────────

const merchants = [
  {
    id: uuid(),
    name: "CryptoShop",
    email: "admin@cryptoshop.io",
    api_key: "sk_live_" + crypto.randomBytes(24).toString("hex"),
  },
  {
    id: uuid(),
    name: "ETH Store",
    email: "support@ethstore.com",
    api_key: "sk_live_" + crypto.randomBytes(24).toString("hex"),
  },
  {
    id: uuid(),
    name: "DeFi Market",
    email: "ops@defimarket.xyz",
    api_key: "sk_live_" + crypto.randomBytes(24).toString("hex"),
  },
];

// ── Build payments ───────────────────────────────────────────────────

interface Payment {
  id: string;
  order_id: string;
  merchant_id: string | null;
  address: string;
  private_key: string;
  amount: string;
  currency: string;
  token_address: string | null;
  status: string;
  received_amount: string | null;
  tx_hash: string | null;
  refund_tx_hash: string | null;
  gas_used: string | null;
  gas_cost: string | null;
  confirmations: number;
  created_at: Date;
  completed_at: Date | null;
  expires_at: Date;
}

function buildPayments(count: number): Payment[] {
  const payments: Payment[] = [];

  for (let i = 0; i < count; i++) {
    // Weight towards more recent dates: square the random to bias toward 0 (recent)
    const daysBack = Math.floor(Math.pow(Math.random(), 1.8) * 90);
    const createdAt = daysAgo(daysBack);
    const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000); // +30 min

    const currency = pickRandom(CURRENCIES);
    const status = pickRandom(STATUSES);

    let amount: string;
    switch (currency) {
      case "ETH":
        amount = randomFloat(0.01, 2.0, 6);
        break;
      case "USDT":
        amount = randomFloat(10, 500, 2);
        break;
      case "USDC":
        amount = randomFloat(10, 500, 2);
        break;
      case "DAI":
        amount = randomFloat(10, 1000, 2);
        break;
      default:
        amount = "0.1";
    }

    const tokenAddress = TOKEN_ADDRESSES[currency] ?? null;

    // ~70% of payments linked to a merchant
    const merchantId = Math.random() < 0.7 ? pickRandom(merchants).id : null;

    const isCompleted = status === "completed";
    const isPartial = status === "partial";

    let receivedAmount: string | null = null;
    let txHash: string | null = null;
    let gasUsed: string | null = null;
    let gasCost: string | null = null;
    let completedAt: Date | null = null;
    let confirmations = 0;

    if (isCompleted) {
      receivedAmount = amount;
      txHash = randomHex(32);
      gasUsed = String(Math.floor(Math.random() * 30000 + 21000));
      gasCost = randomFloat(0.0005, 0.008, 6);
      completedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 20 + 2) * 60 * 1000);
      confirmations = Math.floor(Math.random() * 50 + 12);
    } else if (isPartial) {
      // received less than expected
      receivedAmount = (parseFloat(amount) * (0.3 + Math.random() * 0.5)).toFixed(6);
      txHash = randomHex(32);
      gasUsed = String(Math.floor(Math.random() * 30000 + 21000));
      gasCost = randomFloat(0.0005, 0.008, 6);
      confirmations = Math.floor(Math.random() * 30 + 6);
    } else if (status === "failed") {
      txHash = randomHex(32);
      confirmations = Math.floor(Math.random() * 3);
    } else if (status === "pending") {
      confirmations = Math.floor(Math.random() * 5);
    }

    payments.push({
      id: uuid(),
      order_id: `ORD-${String(i + 1).padStart(3, "0")}`,
      merchant_id: merchantId,
      address: randomHex(20),
      private_key: randomHex(32),
      amount,
      currency,
      token_address: tokenAddress,
      status,
      received_amount: receivedAmount,
      tx_hash: txHash,
      refund_tx_hash: null,
      gas_used: gasUsed,
      gas_cost: gasCost,
      confirmations,
      created_at: createdAt,
      completed_at: completedAt,
      expires_at: expiresAt,
    });
  }

  return payments;
}

// ── Webhooks ─────────────────────────────────────────────────────────

const webhooks = [
  {
    id: uuid(),
    merchant_id: merchants[0].id, // CryptoShop
    url: "https://cryptoshop.io/webhooks/payments",
    secret: crypto.randomBytes(32).toString("hex"),
    events: JSON.stringify(["payment.completed"]),
    active: true,
  },
  {
    id: uuid(),
    merchant_id: merchants[1].id, // ETH Store
    url: "https://ethstore.com/api/webhooks",
    secret: crypto.randomBytes(32).toString("hex"),
    events: JSON.stringify(["payment.completed", "payment.failed", "payment.expired", "payment.partial"]),
    active: true,
  },
];

// ── Seed ─────────────────────────────────────────────────────────────

async function seed() {
  console.log("Clearing existing data...");
  await sql`DELETE FROM webhooks`;
  await sql`DELETE FROM payments`;
  await sql`DELETE FROM merchants`;

  console.log("Inserting 3 merchants...");
  for (const m of merchants) {
    await sql`
      INSERT INTO merchants (id, name, email, api_key)
      VALUES (${m.id}, ${m.name}, ${m.email}, ${m.api_key})
    `;
  }

  const payments = buildPayments(50);
  console.log(`Inserting ${payments.length} payments...`);
  for (const p of payments) {
    await sql`
      INSERT INTO payments (
        id, order_id, merchant_id, address, private_key,
        amount, currency, token_address, status, received_amount,
        tx_hash, refund_tx_hash, gas_used, gas_cost, confirmations,
        created_at, completed_at, expires_at
      ) VALUES (
        ${p.id}, ${p.order_id}, ${p.merchant_id}, ${p.address}, ${p.private_key},
        ${p.amount}, ${p.currency}, ${p.token_address}, ${p.status}, ${p.received_amount},
        ${p.tx_hash}, ${p.refund_tx_hash}, ${p.gas_used}, ${p.gas_cost}, ${p.confirmations},
        ${p.created_at}, ${p.completed_at}, ${p.expires_at}
      )
    `;
  }

  console.log("Inserting 2 webhooks...");
  for (const w of webhooks) {
    await sql`
      INSERT INTO webhooks (id, merchant_id, url, secret, events, active)
      VALUES (${w.id}, ${w.merchant_id}, ${w.url}, ${w.secret}, ${w.events}, ${w.active})
    `;
  }

  // Print summary
  const statusCounts = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const currencyCounts = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.currency] = (acc[p.currency] || 0) + 1;
    return acc;
  }, {});

  console.log("\n--- Seed complete ---");
  console.log("Merchants:", merchants.length);
  console.log("Payments:", payments.length);
  console.log("  Status breakdown:", statusCounts);
  console.log("  Currency breakdown:", currencyCounts);
  console.log("Webhooks:", webhooks.length);

  await sql.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
