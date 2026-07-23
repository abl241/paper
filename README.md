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

### Markets & data
- Live tickers, symbol search, and watchlists
- Focused symbol view with candlestick charts (TradingView Lightweight Charts)
- Real-time bid/ask and trade prints via WebSocket
- Exchange-agnostic market layer (Gemini REST + WS, Coinbase REST)

### Trading & portfolios
- Market buys/sells filled at live ask/bid
- Multiple portfolios per user — isolated cash, positions, and trade history
- Per-portfolio (or default) exchange preference
- Cash ledger for deposits, withdrawals, and resets
- Position tracking with average cost; full trade history

### Product
- JWT auth (register / login)
- Portfolio hub: overview, trade, history, performance, settings
- Preferred exchange and account settings

### Strategy Lab & Research
- Author TypeScript strategies against a controlled `StrategyContext` API (orders, bars, indicators, portfolio)
- Validate with dry-run; templates for SMA crossover, RSI mean reversion, and a blank scaffold
- **API Explorer** — searchable in-lab docs dock (toolbar **API**, edge tab, or Ctrl/Cmd+Shift+D); Monaco autocomplete + JSDoc hover; Insert Example into the editor
- Research runs historical backtests on saved strategies using the same Strategy API

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
