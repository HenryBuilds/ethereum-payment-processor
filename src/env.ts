import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  MASTER_ADDRESS: z
    .string()
    .startsWith("0x", "Must be a valid Ethereum address")
    .length(42, "Ethereum address must be 42 characters"),
  RPC_URL: z
    .string()
    .url("Must be a valid URL"),
  PORT: z
    .string()
    .default("3000")
    .transform(Number)
    .pipe(z.number().int().positive()),
  POLLING_INTERVAL: z
    .string()
    .default("30000")
    .transform(Number)
    .pipe(z.number().int().min(5000, "Polling interval must be at least 5 seconds")),
  GAS_LIMIT: z
    .string()
    .default("21000")
    .transform(Number)
    .pipe(z.number().int().positive()),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "debug"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
