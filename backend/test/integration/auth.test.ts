import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pool } from "../../src/config/database.js";
import { authService } from "../../src/services/auth/auth.service.js";
import { settingsService } from "../../src/services/settings/settings.service.js";
import type { RegisterInput } from "../../src/types/auth.js";
import { useTestDatabase } from "../helpers/db.js";

useTestDatabase();

const alice: RegisterInput = {
  username: "Alice_1",
  email: "Alice@Example.com",
  password: "password123",
};

async function countRows(table: string, userId: string): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = $1`,
    [userId],
  );
  return Number(result.rows[0].n);
}

describe("authService", () => {
  it("register lowercases identity and creates a default portfolio and settings", async () => {
    const { token, user } = await authService.register(alice);

    assert.equal(user.username, "alice_1");
    assert.equal(user.email, "alice@example.com");
    assert.equal(authService.verifyToken(token).sub, user.id);
    assert.equal(await countRows("portfolios", user.id), 1);
    assert.equal(await countRows("settings", user.id), 1);
  });

  it("login accepts the right password case-insensitively on email", async () => {
    const { user } = await authService.register(alice);
    const result = await authService.login({
      email: " ALICE@example.com ",
      password: "password123",
    });
    assert.equal(result.user.id, user.id);
  });

  it("login rejects a wrong password", async () => {
    await authService.register(alice);
    await assert.rejects(
      authService.login({ email: alice.email, password: "nope-nope" }),
      { code: "INVALID_CREDENTIALS", statusCode: 401 },
    );
  });

  it("duplicate email returns 409", async () => {
    await authService.register(alice);
    await assert.rejects(
      authService.register({ ...alice, username: "someone_else" }),
      { code: "EMAIL_EXISTS", statusCode: 409 },
    );
  });

  it("duplicate username returns 409", async () => {
    await authService.register(alice);
    await assert.rejects(
      authService.register({ ...alice, email: "other@example.com" }),
      { code: "USERNAME_EXISTS", statusCode: 409 },
    );
  });

  it("rejects short passwords", async () => {
    await assert.rejects(
      authService.register({ ...alice, password: "short" }),
      { code: "INVALID_PASSWORD", statusCode: 400 },
    );
  });

  it("rejects tampered tokens", () => {
    assert.throws(() => authService.verifyToken("not-a-jwt"), {
      code: "INVALID_TOKEN",
      statusCode: 401,
    });
  });

  it("concurrent duplicate registrations: one succeeds, the other gets 409", async () => {
    const results = await Promise.allSettled([
      authService.register(alice),
      authService.register(alice),
    ]);
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(rejected.length, 1);
    assert.equal((rejected[0] as PromiseRejectedResult).reason.statusCode, 409);

    const users = await pool.query("SELECT id FROM users");
    assert.equal(users.rowCount, 1);
    assert.equal(await countRows("portfolios", users.rows[0].id), 1);
  });

  it("registration is atomic: a failure after creating the user leaves nothing behind", async () => {
    const original = settingsService.initialize;
    settingsService.initialize = async () => {
      throw new Error("settings unavailable");
    };
    try {
      await assert.rejects(authService.register(alice), /settings unavailable/);
    } finally {
      settingsService.initialize = original;
    }

    const users = await pool.query("SELECT id FROM users");
    assert.equal(users.rowCount, 0);
    const portfolios = await pool.query("SELECT id FROM portfolios");
    assert.equal(portfolios.rowCount, 0);

    // And the same identity can register cleanly afterwards.
    const { user } = await authService.register(alice);
    assert.equal(user.email, "alice@example.com");
  });

  it(
    "missing password is a 400, not a crash",
    { todo: "Phase 2: zod validation at the controller" },
    async () => {
      await assert.rejects(
        authService.register({ username: "bob_1", email: "bob@example.com" } as RegisterInput),
        { statusCode: 400 },
      );
    },
  );
});
