import { after, before, beforeEach } from "node:test";
import { closePool, pool } from "../../src/config/database.js";
import { runMigrations } from "../../src/db/migrate.js";

/** Migrate once per file, wipe all rows before each test, close the pool at the end. */
export function useTestDatabase(): void {
  before(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    // Every table hangs off users, so CASCADE clears the whole schema.
    await pool.query("TRUNCATE users CASCADE");
  });

  after(async () => {
    await closePool();
  });
}
