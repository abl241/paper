# Paper

**Simulated crypto trading against live exchange data.**

Paper is a full-stack trading sandbox. It streams live prices from Gemini and Coinbase, simulates fills, and tracks cash, positions, and PnL. No exchange API keys and no real capital; the goal is to see how a market stack behaves from tick to portfolio.

---

## Why this exists

I wanted somewhere to practice trading decisions without risking money, then stayed interested in the systems side: normalizing tick data across venues, keeping cash and positions correct when orders race, and building a UI that keeps up when the book moves every few hundred milliseconds.

---

## Snapshot

| | |
|---|---|
| **What it is** | Paper trading for crypto, using live Gemini / Coinbase market data |
| **What it isn't** | A broker, a signal product, or a way to place real orders |
| **Main flow** | Stream prices → size a paper trade → update cash, positions, PnL |

---

## Features

Organized by the main nav tabs.

### Home
Landing page: what Paper is, the watch → trade → build → backtest flow, and links into the main workspaces.

### Markets
Browse live crypto markets from Gemini or Coinbase.
- Movers strip (gainers, losers, volume) and tabs for Watchlist, Holdings, Gainers, Losers, Top, and Browse
- Sortable table with last, bid/ask, 24h % / $ change, volume, and sparklines
- Live ticker updates: **Gemini** over a backend WebSocket; **Coinbase** via REST polling at your refresh interval
- Holdings highlighted from the active portfolio
- Focused symbol view with candlestick charts (TradingView Lightweight Charts) and trade prints
- From the focused view you can open Trade or **Run strategy** on that market for the active portfolio

### Portfolio
One or more isolated paper books (cash, positions, and history per portfolio). Sub-tabs:

| Tab | What it does |
|-----|----------------|
| **Overview** | Equity, cash, open positions, and a short book summary |
| **Trade** | Simulated market buys/sells filled at live ask/bid |
| **Strategies** | Run one saved Lab strategy on live candles for this book; paper fills hit the portfolio, with run stats and fill history on the tab |
| **History** | Fill / trade log for the selected portfolio (filter by strategy vs manual) |
| **Performance** | Equity curve and performance over time |
| **Settings** | Portfolio options (name, exchange preference, cash deposits / withdrawals / reset) |

### Strategy Lab
Write TypeScript strategies against a fixed `StrategyContext` API (no imports or `fetch`; only buy/sell, bars, indicators, portfolio, and params).
- Templates (SMA crossover, RSI mean reversion, blank scaffold) plus your saved drafts
- Monaco editor with autocomplete and JSDoc hover
- Properties for symbols, timeframe, params, and risk metadata
- Validate / dry-run with console output
- **API Explorer**: searchable docs (toolbar **API**, right-edge tab, or Ctrl/Cmd+Shift+D). Insert Example pastes snippets into the editor

### Research
Backtest saved Lab strategies on historical candles with the same Strategy API.
- Pick strategy, symbol, range, and timeframe
- Run backtests and inspect equity / results
- Open from Strategy Lab with a strategy already selected
- For live runs against a real book, use the portfolio **Strategies** tab

### Live paper runs
The portfolio Strategies tab arms one strategy per portfolio and evaluates it on closed candles, using the same transactional fill path as manual orders.
- **Presence-gated**: the backend polls candles only while the tab is open and sending heartbeats, so an idle session makes no exchange calls
- **Catch-up on return**: closed bars missed while away are replayed in order before live evaluation continues
- Run state (armed strategy, last processed bar, log, last error) persists across sessions until you stop it
- Run performance (trade count, realized PnL, win rate) and the run’s fill list update on the Strategies tab; History can filter to strategy fills

### Settings
Account-wide preferences: preferred exchange, price refresh interval (throttles Gemini WebSocket updates and Coinbase REST polling), equity chart defaults (range, resolution, y-axis), and clock format. Guests keep settings locally; logged-in users sync to the server.

### System
Backend health check at `/health`: API status plus a PostgreSQL connectivity probe (`database: ok | error`). Handy when debugging local or deployed setups.

### Shared pieces
- JWT auth (register / login); Strategy Lab, Research, and Portfolio require a session
- Exchange-agnostic market layer (Gemini REST + WS, Coinbase REST)
- Concurrent paper fills use SQL transactions with row locks so cash and positions stay consistent

---

## Architecture

```
┌─────────────┐   REST + WS (Gemini)  ┌───────────────────┐   REST + WS (Gemini)  ┌────────────┐
│  React UI   │ ◄────────────────────► │  Express API      │ ◄────────────────────► │ Gemini     │
│  (Vite)     │   REST poll (Coinbase) │  + stream broker  │        REST only       │ Coinbase   │
└─────────────┘                        └─────────┬─────────┘                        └────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ PostgreSQL  │
                                          │ portfolios  │
                                          │ positions   │
                                          │ trades      │
                                          └─────────────┘
```

**Venue boundary.** Gemini and Coinbase adapters implement a shared `Exchange` interface. The rest of the app does not speak venue-specific APIs.

**Concurrent fills.** Paper fills run in SQL transactions with row locks on portfolio cash and positions, so overlapping orders cannot invent money or shares.

**Stream fan-out.** For Gemini, the backend holds one upstream WebSocket and fans ticker/trade updates to subscribed browsers. Upstream subscriptions are reference-counted so idle symbols drop off. Coinbase live quotes are polled over REST from the frontend at the configured refresh interval.

---

## Stack

| Layer | |
|-------|--|
| Frontend | React 19, React Router, Vite, TypeScript, CSS Modules, Monaco, Lightweight Charts |
| Backend | Node.js, Express, TypeScript, `ws` |
| Data | PostgreSQL, versioned SQL migrations |
| Auth | JWT, bcrypt |
| Venues | Gemini (REST + WebSocket), Coinbase (REST) |

npm workspaces monorepo: `backend/` + `frontend/`.

---

## Layout

```
paper/
├── backend/     # API, exchange adapters, WS broker, strategies, research, migrations
├── frontend/    # markets, portfolio, Strategy Lab, Research, charts, settings
├── package.json
└── .env.example
```

---

## Run locally

**Needs:** Node.js 20+, PostgreSQL

```bash
createdb paper_trading          # or create the DB named in DATABASE_URL
cp .env.example .env            # set DATABASE_URL, JWT_SECRET, …
npm install
npm run dev                     # API on :3001, UI on :5173
```

Vite reads env from the repo root (see `frontend/vite.config.ts`). Migrations apply automatically when the backend starts.

---

## Reading the code

Some design choices worth knowing:

1. **Domain over venue.** Symbols and tickers are normalized in-app; mappers live at the exchange edge.
2. **Portfolios own state.** Cash, positions, and trades hang off `portfolio_id`, so strategies stay isolated. Live paper runs attach one strategy per portfolio and fill through the same book.
3. **Paper is still strict.** Fills use bid/ask, validate quantity, and reject insufficient cash or size.
4. **Quiet streams.** Reference-counted upstream subscriptions keep the wire quiet when nobody is watching.
5. **Strategy API sandbox.** Lab strategies talk only to `StrategyContext` (no imports/`fetch`). Research and live paper runs reuse that same surface.

---

## Status

Active personal project. Live data, paper trading, and portfolio tracking work. Strategy Lab and Research cover authoring and backtesting; portfolio Strategies runs live paper (presence + catch-up). Still iterating on UX, exchange coverage, and performance analytics.

---

*Private. Portfolio / learning project.*
