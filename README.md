# Paper

**Simulated crypto trading against live exchange data.**

Real prices. Simulated fills. Honest portfolio math. Paper is a full-stack trading sandbox wired to live venues — no exchange API keys, no capital at risk — built to understand how market systems behave end to end.

---

## Why this exists

Markets are a feedback loop: information moves, prices update, decisions follow. I wanted a place to practice that loop without risking money — and then kept going. How do you normalize tick data across venues? How do you keep cash and positions correct when orders race? What does a trading UI need when the book moves every few hundred milliseconds?

Paper is that project: equal parts market curiosity and systems engineering.

---

## Snapshot

| | |
|---|---|
| **What it is** | Paper trading platform for crypto, powered by live Gemini / Coinbase market data |
| **What it isn't** | A broker, a signal product, or a place to place real orders |
| **Core loop** | Stream prices → size a paper trade → update cash, positions, PnL |

---

## Features

Paper is organized around the main nav tabs. Each one is a stage in the paper-trading loop.

### Home
Landing overview of the product: what Paper is, how the loop works (watch → trade → build → backtest), and quick links into the main workspaces.

### Markets
Browse live crypto markets from Gemini or Coinbase.
- Symbol search and watchlists
- Live tickers with bid/ask and volume
- Focused symbol view with candlestick charts (TradingView Lightweight Charts)
- Real-time trade prints over WebSocket

### Portfolio
Paper trading desk for one or more isolated portfolios (cash, positions, and history per portfolio). Sub-tabs:

| Tab | What it does |
|-----|----------------|
| **Overview** | Equity, cash, open positions, and a high-level snapshot of the book |
| **Trade** | Place simulated market buys/sells filled at live ask/bid |
| **History** | Full fill / trade log for the selected portfolio |
| **Performance** | Equity curve and performance view over time |
| **Settings** | Portfolio-level options (e.g. name, exchange preference, cash deposits / withdrawals / reset) |

### Strategy Lab
Author and validate TypeScript strategies against a controlled `StrategyContext` API (no imports or `fetch` — only buy/sell, bars, indicators, portfolio, and params).
- Library of templates (SMA crossover, RSI mean reversion, blank scaffold) plus your saved drafts
- Monaco editor with autocomplete and JSDoc hover
- Properties for symbols, timeframe, params, and risk metadata
- Validate / dry-run with console output
- **API Explorer** — searchable docs dock (toolbar **API**, right-edge tab, or Ctrl/Cmd+Shift+D); Insert Example pastes snippets into the editor

### Research
Backtest saved Lab strategies on historical candles using the same Strategy API.
- Pick strategy, symbol, range, and timeframe
- Run backtests and inspect equity / results
- Jump in from Strategy Lab with a strategy pre-selected

### Settings
Account-wide preferences: preferred exchange, price refresh interval, equity chart defaults (range, resolution, y-axis), and clock format.

### System
Live backend health check against `/health` (API up, DB connectivity). Useful when debugging local or deployed environments.

### Cross-cutting
- JWT auth (register / login); Strategy Lab, Research, and Portfolio require a session
- Exchange-agnostic market layer (Gemini REST + WS, Coinbase REST)
- Concurrent paper fills use SQL transactions with row locks so cash and positions stay consistent

---

## Architecture

```
┌─────────────┐    REST + WS     ┌───────────────────┐    REST / WS     ┌────────────┐
│  React UI   │ ◄──────────────► │  Express API      │ ◄──────────────► │ Gemini /   │
│  (Vite)     │                  │  + stream broker  │                  │ Coinbase   │
└─────────────┘                  └─────────┬─────────┘                  └────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ PostgreSQL  │
                                    │ portfolios  │
                                    │ positions   │
                                    │ trades      │
                                    └─────────────┘
```

**Venue boundary** — Gemini and Coinbase adapters implement a shared `Exchange` interface. The rest of the app never speaks a venue-specific dialect.

**Correctness under concurrency** — paper fills run in SQL transactions with row locks on portfolio cash and positions, so overlapping orders don't invent money or shares.

**Stream fan-out** — the backend holds upstream WebSocket connections and fans ticker/trade updates to subscribed browsers. Upstream subscriptions are reference-counted; idle symbols drop off the wire.

---

## Stack

| Layer | |
|-------|--|
| Frontend | React 19 · React Router · Vite · TypeScript · CSS Modules · Monaco · Lightweight Charts |
| Backend | Node.js · Express · TypeScript · `ws` |
| Data | PostgreSQL · versioned SQL migrations |
| Auth | JWT · bcrypt |
| Venues | Gemini (REST + WebSocket) · Coinbase (REST) |

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
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, …
npm install
npm run dev                   # API on :3001, UI on :5173
```

Migrations apply automatically when the backend starts.

---

## Reading the code

A few intentional choices:

1. **Domain over venue** — symbols and tickers are normalized in-app; mappers live at the exchange edge.
2. **Portfolios own state** — cash, positions, and trades hang off `portfolio_id`, so strategies stay isolated.
3. **Paper ≠ toy** — fills still use bid/ask, validate quantity, and reject insufficient cash or size.
4. **Cheap streams** — reference-counted upstream subscriptions keep the wire quiet when nobody is watching.
5. **Strategy API sandbox** — Lab strategies talk only to `StrategyContext` (no imports/`fetch`); Research reuses that surface for backtests.

---

## Status

Active personal project. The core loop — live data → paper trade → portfolio — works. Strategy Lab and Research cover authoring and backtesting. Ongoing work: UX polish, broader exchange coverage, richer performance analytics, live paper strategy runners.

---

*Private — portfolio / learning project.*
