# Backend restructure plan

Goal: move strategy execution and market-data upkeep out of the HTTP request path, stop refetching
the same candles from exchanges, and give the frontend and backend one source of truth for types.

Non-goals: microservices, a new framework, an ORM, or Redis. It stays one repo and one Postgres
database. The backend becomes one package with two entrypoints (API and worker).

## Target shape

```
packages/shared/            # zod schemas + inferred types, strategy context types, indicators
backend/src/
  api.ts                    # entrypoint: HTTP + browser WebSocket
  worker.ts                 # entrypoint: strategy runs, candle sync, backtest jobs
  core/                     # config, db pool, withTransaction, logger
  api/                      # app.ts, routes, controllers, middleware, websocket broker
  worker/                   # scheduler, runExecutor, candleSync, backtestJobs
  sandbox/                  # transpile (esbuild) + isolated-vm execution
  market/                   # exchange adapters, candle store, ticker cache
  domain/                   # portfolio, trading, strategy, research, settings, watchlist (services + models)
  db/migrations/
```

Who owns what:

| Concern | Today | After |
|---|---|---|
| Browser REST + WS fan-out of Gemini ticks | API | API (unchanged) |
| Live strategy evaluation | API, inside `POST /heartbeat` | Worker, on bar close |
| Candles | Fetched from the exchange on every call | `candles` table, synced by the worker, read by both |
| Backtests | Synchronous in the request | Job row, run by the worker, polled by the UI |
| User strategy code | `new Function` in the API process | `isolated-vm` isolate with memory and time limits |

API and worker talk only through Postgres: tables as state, plus `LISTEN/NOTIFY` for wakeups.
Gemini tick fan-out deliberately stays in the API. Moving it to the worker would need tick-rate
pub/sub between the processes, and nothing else requires that. The worker gets live prices from
REST `getTicker` at bar close, which is one call per run per bar.

---

## Phase 0: Safety net (before moving anything)

Why: later phases move a lot of code. They need tests that catch behaviour changes.

1. Add a test Postgres:
   - `docker-compose.yml` with `postgres:16` for local runs.
   - A `services: postgres` block in CI.
   - A test helper that creates a fresh schema per test file and runs migrations.
2. Add a `FakeExchange` that implements `Exchange` with deterministic candles and tickers.
3. Characterisation tests:
   - `backtest.engine`: golden results for the SMA crossover and RSI templates on fixed bars.
   - `liveRunner.tick`:
     - arm, then two new closed bars, gives the expected fills;
     - catch-up fills at next-bar open;
     - `protectManualPositions` limits sells;
     - **two concurrent ticks produce no duplicate fills.** This test fails today, and that is expected.
   - `trading.service`: concurrent buys can't overdraw; sells can't exceed the position.
   - Auth: register/login happy path; duplicate email returns 409.
4. Add ESLint (typescript-eslint) and a GitHub Action that runs typecheck, lint, test and build for both workspaces.
5. Add `output/` and `tmp/` to `.gitignore`.

Done when CI is green on `main`, and the concurrent-tick test exists (skipped with a note until Phase 1).

---

## Phase 1: Critical fixes that later phases build on

Small, ships on its own, and closes the security hole now.

1. **Sandbox** (`sandbox/`):
   - `transpile.ts`: `esbuild.transform(source, { loader: "ts", format: "iife" })` replaces
     `prepareRunnableSource`. Keep the regex scan only as a source of friendly lint messages, not as security.
   - `isolate.ts`: `isolated-vm` with one `Isolate({ memoryLimit: 32 })` per compiled strategy, cached by
     `strategyId + updated_at`. Pass bars, params and the portfolio snapshot in as copied data. `buy`/`sell`/`log`
     are `ivm.Callback`s that only record intents. Timeouts: 50 ms per bar evaluation, 2 s per validation.
   - Make validate, backtest and live tick all use it. Delete `compileStrategy`'s `new Function`.
2. **Run locking:** `tick` takes `SELECT … FROM strategy_runs WHERE id = $1 FOR UPDATE` inside a transaction
   and re-reads `last_processed_bar_time` after taking the lock. Un-skip the Phase 0 concurrency test.
3. **Strategy correctness:**
   - Compute MACD's signal line as an EMA over the MACD series.
   - Use the same equity definition in `evaluateBar` and `fillIntent`. Factor out
     `buildStrategySnapshot()` and use it in both the backtest and live paths.
   - Compute run average cost from a FIFO/average-cost walk that includes sells.
4. **`withTransaction(fn)`** in `core/` replaces the 4 hand-written BEGIN/COMMIT/ROLLBACK blocks. Make
   registration atomic (user, portfolio and settings in one transaction) and map unique violations (`23505`) to 409.

Done when a strategy with `while(true){}` or `(()=>0).constructor("return process")()` fails cleanly, and the API stays responsive.

---

## Phase 2: Shared types package

1. Create `packages/shared`:
   - Add it to the root `workspaces`.
   - Build it with `tsc` to `dist/`, with `exports` pointing at `dist`.
   - Add a root `build` script that builds `shared` first. Vite and `tsx` can resolve the source in dev
     through `customConditions` / a `"development"` export condition, so there's no rebuild loop while coding.
2. Move domain by domain, in this order: `market`, `settings`, `portfolio`/`trading`, `strategy`/`strategyRun`,
   `research`, `websocket`. For each domain:
   - write zod schemas for request bodies and response DTOs, and export `z.infer` types;
   - delete the matching files in `backend/src/types` and `frontend/src/types`;
   - validate controller inputs with a small `parseBody(schema)` helper, so a bad body returns 400 instead of 500.
3. Move the strategy context types (`StrategyContext`, `Bar`, `OrderIntent`) and pure indicator functions into
   `shared/strategy`. Generate the frontend's `strategyApiDts.ts` / `apiCatalog.ts` from that one source,
   or at least type-check them against it.
4. Upgrade to Express 5 here, while touching every controller anyway. Remove the per-handler try/catch.

Done when nothing is left in either `types/` folder that is shared over the wire, and both apps import from `@paper/shared`.

---

## Phase 3: Candle store and market-data layer

### Schema (new migration)

```sql
CREATE TABLE candles (
  exchange   TEXT        NOT NULL,
  symbol     TEXT        NOT NULL,
  interval   TEXT        NOT NULL,
  open_time  TIMESTAMPTZ NOT NULL,
  open NUMERIC(28,10) NOT NULL, high NUMERIC(28,10) NOT NULL,
  low  NUMERIC(28,10) NOT NULL, close NUMERIC(28,10) NOT NULL,
  volume NUMERIC(28,10) NOT NULL,
  PRIMARY KEY (exchange, symbol, interval, open_time)
);

CREATE TABLE candle_series (
  exchange TEXT NOT NULL, symbol TEXT NOT NULL, interval TEXT NOT NULL,
  earliest TIMESTAMPTZ, latest TIMESTAMPTZ,      -- closed-bar coverage held locally
  backfill_complete BOOLEAN NOT NULL DEFAULT FALSE,
  last_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  PRIMARY KEY (exchange, symbol, interval)
);
```

Rules:
- Store **closed bars only**. The still-forming bar is served from a short-lived in-memory fetch, never persisted.
- Writes use `INSERT … ON CONFLICT (pk) DO UPDATE`, which is idempotent and safe if API and worker race.
- A series is tracked lazily: it is created the first time anything asks for it, and `last_requested_at` is bumped on every read.

### `CandleService.getCandles(exchange, symbol, interval, { from?, to?, limit? })`

1. Read the requested range from `candles`.
2. If the range isn't covered:
   - **Coinbase** supports `start`/`end`, so backfill the missing window (paged at 300 bars) and upsert.
   - **Gemini** only returns a fixed recent window, so fetch it, upsert, and accept that history only grows
     forward. For deep Gemini history, keep the current fallback to Coinbase daily bars and label it in the UI.
3. Append the forming bar if `to` is now.

Callers to switch: research backtests, live runner, `equityCurve.builder`, market focus charts, and the
`change24h` enrichment in market summaries.

### Same phase, same layer
- `market/http.ts`: one exchange HTTP helper with `AbortSignal.timeout(8000)`, retry with jittered backoff on
  5xx/network errors, and `Retry-After` handling on 429. Gemini and Coinbase clients both use it.
- `TickerCache`: in-memory with a 1–2 s TTL plus **in-flight promise dedupe**, used by trading, portfolio
  enrichment and summaries.
- Market summaries use bulk endpoints (Coinbase product stats, Gemini `pricefeed`) instead of N ticker calls,
  plus N candle calls per page.

### Retention and size (Neon free tier is about 0.5 GB)
Rough cost: about 120 bytes per row with the index.

| Interval | Keep | Rows per symbol | Size per symbol |
|---|---|---|---|
| 1m | 14 days | ~20k | ~2.4 MB |
| 5m | 90 days | ~26k | ~3 MB |
| 15m | 1 year | ~35k | ~4 MB |
| 1h / 6h / 1d | forever | ~9k per year (1h) | ~1 MB per year |

A nightly worker job deletes rows past retention and drops series not requested in 30 days.

Done when running the same backtest twice makes zero exchange calls the second time; a 90-day 1h backtest
on Coinbase works; and the Markets page makes O(1) upstream calls per refresh instead of O(N).

---

## Phase 4: Worker process

### 4a. Entrypoints and deploy
- Split `index.ts` into `api.ts` and `worker.ts`, both on top of `core/`. Migrations run in the **API** only,
  guarded by `pg_advisory_lock`.
- `worker.ts` takes `pg_try_advisory_lock(<worker-lock-id>)` on a dedicated connection. If another worker
  holds it (deploy overlap), it idles and retries. That gives exactly one active worker with no coordinator.
- Railway: add a second service from the same repo with start command `npm run start:worker -w backend`.
  Split the Neon pool (API `max: 6`, worker `max: 4`) or use Neon's pooled endpoint.
- Worker liveness: upsert a `worker_heartbeat` row every 15 s. `/health` reports `worker: ok | stale`.

### 4b. Live strategy runs
- **Scheduler:** every 5 s, load running runs and group them by `(exchange, symbol, interval)`. For each group
  whose next bar close plus a 10 s grace period has passed:
  1. sync candles once for the group;
  2. for each run, `runExecutor.process(runId)`.
- `LISTEN strategy_runs_changed`: the API sends `NOTIFY` on start/stop so the worker reacts immediately instead of on the next poll.
- **`runExecutor.process`:** one transaction, `SELECT … FOR UPDATE SKIP LOCKED` on the run, then load the portfolio,
  positions and run trades **once**. Evaluate every new closed bar in the sandbox and update in-memory state between
  bars. Fills go through the existing `tradingService` path (same client/transaction), followed by a single
  `UPDATE strategy_runs`. Fill semantics are unchanged: catch-up fills at next-bar open, the newest bar at the live ticker.
- The API's `heartbeat` endpoint stops evaluating. Depending on the presence decision below, it either just bumps
  `last_heartbeat_at` or is removed. `GET /strategy-run` stays as the UI's read path.
- Safety limits:
  - a per-user cap on running runs (for example 3);
  - auto-stop a run after N consecutive errors, with the reason written to `last_error`.

### 4c. Backtests as jobs
- Migration: `backtests.status` gains `queued` and `running`; add `started_at` and `finished_at`.
- `POST /research/backtests` inserts a `queued` row, sends `NOTIFY`, and returns `202` with the id.
- The worker claims jobs with `FOR UPDATE SKIP LOCKED`, runs them in the sandbox (each bar is time-limited, plus an
  overall 30 s cap), and writes the results.
- The UI polls `GET /research/backtests/:id` until the job finishes (the Research page already loads by id).

Done when:
- closing all browser tabs doesn't stop a run (or does, if presence gating is kept, but evaluation never happens inside an HTTP request);
- killing the worker mid-tick leaves no partial fills;
- two worker replicas never both process.

---

## Phase 5: Hardening and cleanup

- Request logging with a request id; log lines from the worker carry `runId` / `backtestId`.
- `helmet`, and `express-rate-limit` on `/auth/*`.
- Paginate trades (cursor on `executed_at, id`) in History and the run view.
- WebSocket broker:
  - ping/pong every 30 s to drop dead clients;
  - cap subscriptions at 50 per client;
  - `JSON.stringify` once per message;
  - skip clients whose `bufferedAmount` is over 1 MB;
  - remove the redundant `geminiStreams` refcount.
- Either implement email verification or drop `email_verification_tokens`.
- Add Redis **only** if the API ever runs more than one replica (shared ticker cache, plus pub/sub so every
  replica's browsers get worker events).

---

## Decisions needed

1. **Presence gating.** Keep "runs only process while the tab is open" or make runs always-on?
   Recommendation: always-on with a per-user cap. With shared candle syncs, the extra cost is roughly one ticker call per run per bar.
2. **Gemini deep history.** Accept forward-only accumulation for Gemini intraday candles, or always backtest
   on Coinbase data? Recommendation: backtests default to the strategy's exchange and fall back to Coinbase
   for ranges Gemini can't cover, with a note in the result.
3. **Money representation.** Phase 2 is the natural point to switch `portfolioMath` to `decimal.js`, with DTOs
   carrying numbers rounded at the edge. Decide whether the API sends money as strings or numbers.

## Order and rough size

| Phase | Depends on | Size | Can ship alone |
|---|---|---|---|
| 0 Safety net | none | S–M | yes |
| 1 Critical fixes | 0 | M | yes |
| 2 Shared package | 0 | M | yes (domain by domain) |
| 3 Candle store | 1 | M–L | yes |
| 4 Worker | 1, 3 | L | 4a, 4b and 4c separately |
| 5 Hardening | none | S each | yes |

Phases 2 and 3 can run in parallel once Phase 1 lands, because they touch different files.
Do the folder moves in the target layout as one mechanical commit at the start of Phase 4, so behaviour changes aren't buried in the rename diff.
