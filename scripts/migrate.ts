import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

async function run() {
  console.log("Connecting to DB...");
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  const tables = await client`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log("Tables:", tables.map((t) => t.tablename));

  await client.end();
  console.log("Done.");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
