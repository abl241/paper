/**
 * Preloaded (via --import) before any test file so config/database.ts sees test settings.
 * dotenv never overrides variables that are already set, so the repo .env cannot leak in.
 */
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://paper:paper@localhost:5433/paper_test";

const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

// Tests truncate every table; refuse to point at anything that isn't clearly a test database.
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests against database "${databaseName}": name must end with "_test"`,
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
process.env.EXCHANGE = "gemini";
process.env.STARTING_CASH_BALANCE = "100000";
