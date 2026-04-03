import { describe, it, expect } from "vitest";
import { z } from "zod";

// Test the schema validation logic directly without triggering process.exit
const envSchema = z.object({
  MASTER_ADDRESS: z
    .string()
    .startsWith("0x", "Must be a valid Ethereum address")
    .length(42, "Ethereum address must be 42 characters"),
  RPC_URL: z
    .string()
    .url("Must be a valid URL"),
  DATABASE_URL: z
    .string()
    .url("Must be a valid PostgreSQL connection URL"),
  PORT: z
    .string()
    .default("3000")
    .transform(Number)
    .pipe(z.number().int().positive()),
  POLLING_INTERVAL: z
    .string()
    .default("30000")
    .transform(Number)
    .pipe(z.number().int().min(5000)),
  API_KEY: z
    .string()
    .min(1),
  PAYMENT_TIMEOUT_MINUTES: z
    .string()
    .default("60")
    .transform(Number)
    .pipe(z.number().int().min(1)),
  REQUIRED_CONFIRMATIONS: z
    .string()
    .default("1")
    .transform(Number)
    .pipe(z.number().int().min(0)),
});

describe("env validation", () => {
  const validEnv = {
    MASTER_ADDRESS: "0x0000000000000000000000000000000000000000",
    RPC_URL: "https://mainnet.infura.io/v3/test",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    API_KEY: "test-key",
  };

  it("accepts valid env vars", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("rejects MASTER_ADDRESS without 0x prefix", () => {
    const result = envSchema.safeParse({ ...validEnv, MASTER_ADDRESS: "1234567890123456789012345678901234567890ab" });
    expect(result.success).toBe(false);
  });

  it("rejects MASTER_ADDRESS with wrong length", () => {
    const result = envSchema.safeParse({ ...validEnv, MASTER_ADDRESS: "0x1234" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid RPC_URL", () => {
    const result = envSchema.safeParse({ ...validEnv, RPC_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects empty API_KEY", () => {
    const result = envSchema.safeParse({ ...validEnv, API_KEY: "" });
    expect(result.success).toBe(false);
  });

  it("applies default PORT", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it("rejects POLLING_INTERVAL below 5000ms", () => {
    const result = envSchema.safeParse({ ...validEnv, POLLING_INTERVAL: "1000" });
    expect(result.success).toBe(false);
  });

  it("accepts REQUIRED_CONFIRMATIONS of 0", () => {
    const result = envSchema.safeParse({ ...validEnv, REQUIRED_CONFIRMATIONS: "0" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REQUIRED_CONFIRMATIONS).toBe(0);
    }
  });
});
