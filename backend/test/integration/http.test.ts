import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type {
  ApiErrorBody,
  ApiResponse,
  AuthResponse,
  PortfolioDetail,
  PortfolioListItem,
  TradeExecutionResult,
} from "@paper/shared";
import { useTestDatabase } from "../helpers/db.js";
import { installFakeExchange } from "../helpers/fakeExchange.js";
import { createAccount, type TestAccount } from "../helpers/fixtures.js";
import { useTestServer } from "../helpers/http.js";

useTestDatabase();
const api = useTestServer();

describe("HTTP API", () => {
  describe("request validation", () => {
    it("register without a password is a 400 naming the field", async () => {
      const res = await api.request<ApiErrorBody>("POST", "/auth/register", {
        body: { username: "bob_1", email: "bob@example.com" },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INVALID_REQUEST");
      assert.equal(res.body.error.message, "password: Required");
      assert.deepEqual(
        res.body.error.issues?.map((issue) => issue.path),
        ["password"],
      );
    });

    it("register with no body at all is a 400, not a crash", async () => {
      const res = await api.request<ApiErrorBody>("POST", "/auth/register");
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INVALID_REQUEST");
    });

    it("malformed JSON is a 400", async () => {
      const res = await api.request<ApiErrorBody>("POST", "/auth/login", {
        rawBody: "{not json",
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INVALID_REQUEST");
    });

    it("register and login round-trip through the API", async () => {
      const registered = await api.request<ApiResponse<AuthResponse>>("POST", "/auth/register", {
        body: { username: "Carol_1", email: "carol@example.com", password: "password123" },
      });
      assert.equal(registered.status, 201);
      assert.equal(registered.body.data.user.username, "carol_1");

      const login = await api.request<ApiResponse<AuthResponse>>("POST", "/auth/login", {
        body: { email: "carol@example.com", password: "password123" },
      });
      assert.equal(login.status, 200);

      const me = await api.request<ApiResponse<{ id: string }>>("GET", "/auth/me", {
        token: login.body.data.token,
      });
      assert.equal(me.body.data.id, registered.body.data.user.id);
    });

    it("protected routes reject a missing token", async () => {
      const res = await api.request<ApiErrorBody>("GET", "/portfolios");
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "UNAUTHORIZED");
    });

    it("an unknown route is a JSON 404", async () => {
      const res = await api.request<ApiErrorBody>("GET", "/nope");
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "NOT_FOUND");
    });
  });

  describe("signed in", () => {
    let account: TestAccount;

    beforeEach(async () => {
      const exchange = installFakeExchange("gemini");
      exchange.setTicker("BTC-USD", { bid: 100, ask: 101 });
      account = await createAccount();
    });

    it("rejects a non-numeric quantity before it reaches the trading service", async () => {
      const res = await api.request<ApiErrorBody>(
        "POST",
        `/portfolios/${account.portfolioId}/trading/buy`,
        { body: { symbol: "BTC-USD", quantity: "lots" }, token: account.token },
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.error.issues?.[0].path, "quantity");
    });

    it("buys at the ask and returns money as numbers", async () => {
      const res = await api.request<ApiResponse<TradeExecutionResult>>(
        "POST",
        `/portfolios/${account.portfolioId}/trading/buy`,
        { body: { symbol: "BTC-USD", quantity: 2 }, token: account.token },
      );
      assert.equal(res.status, 201);
      assert.equal(res.body.data.trade.executionPrice, 101);
      assert.equal(typeof res.body.data.cashBalance, "number");
      assert.equal(typeof res.body.data.trade.executedAt, "string");
    });

    it("service errors from async handlers reach the error handler", async () => {
      const res = await api.request<ApiErrorBody>(
        "POST",
        `/portfolios/${account.portfolioId}/trading/sell`,
        { body: { symbol: "BTC-USD", quantity: 1 }, token: account.token },
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INSUFFICIENT_POSITION");
    });

    it("withdrawing a negative amount is rejected", async () => {
      const res = await api.request<ApiErrorBody>(
        "POST",
        `/portfolios/${account.portfolioId}/funds`,
        { body: { type: "withdraw", amount: -50 }, token: account.token },
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.error.issues?.[0].path, "amount");
    });

    it("deposits update the balance", async () => {
      const res = await api.request<ApiResponse<PortfolioDetail>>(
        "POST",
        `/portfolios/${account.portfolioId}/funds`,
        { body: { type: "deposit", amount: 250.5 }, token: account.token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.cashBalance, 100_250.5);
    });

    it("query params are validated and coerced", async () => {
      const bad = await api.request<ApiErrorBody>(
        "GET",
        `/portfolios/${account.portfolioId}/trades?from=not-a-date`,
        { token: account.token },
      );
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.issues?.[0].path, "from");

      const list = await api.request<ApiResponse<PortfolioListItem[]>>(
        "GET",
        "/portfolios?includeArchived=true",
        { token: account.token },
      );
      assert.equal(list.status, 200);
      assert.equal(list.body.data.length, 1);
    });

    it("market candles reject unsupported intervals", async () => {
      const res = await api.request<ApiErrorBody>(
        "GET",
        "/markets/candles/BTC-USD?interval=2h",
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.error.issues?.[0].path, "interval");
    });
  });
});
