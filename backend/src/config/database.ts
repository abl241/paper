import pg, { type PoolClient } from "pg";
import { logger } from "../utils/logger.js";
import { config } from "./index.js";

const { Pool } = pg;

/** Anything that can run a query: the pool, or a client inside a transaction. */
export type Queryable = pg.Pool | PoolClient;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  // Neon pooled connections: keep this small so API (+ future workers) stay under free-tier limits.
  max: 10,
});

pool.on("error", (err) => {
  logger.error("database", "unexpected pool error", err);
});

export async function verifyDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

let savepointCounter = 0;

/**
 * Run `fn` in a transaction and commit, or roll back if it throws.
 * Given an existing client, nests with a savepoint so a failure only undoes `fn`'s work.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  outer?: PoolClient,
): Promise<T> {
  if (outer) {
    const savepoint = `sp_${(savepointCounter += 1)}`;
    await outer.query(`SAVEPOINT ${savepoint}`);
    try {
      const result = await fn(outer);
      await outer.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await outer.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Postgres unique_violation, optionally for a specific constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const pgError = error as { code?: string; constraint?: string };
  return (
    pgError.code === "23505" &&
    (constraint === undefined || pgError.constraint === constraint)
  );
}

export async function closePool(): Promise<void> {
  await pool.end();
}
