import pg from "pg";
import { config } from "./index.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  // Neon pooled connections: keep this small so API (+ future workers) stay under free-tier limits.
  max: 10,
});

pool.on("error", (err) => {
  console.error("[database] unexpected pool error:", err);
});

export async function verifyDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
