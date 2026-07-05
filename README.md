# Paper Trading Platform

A full-stack web application for simulated cryptocurrency trading using live market data. No real money or orders are ever submitted.

## Stack

- **Frontend:** React, React Router, Axios, CSS Modules
- **Backend:** Node.js, Express, PostgreSQL
- **Market data:** Exchange-agnostic layer (Gemini first)

## Project structure

```
paper/
├── backend/    # Express API
├── frontend/   # React app
└── package.json
```

## Prerequisites

- Node.js 20+
- PostgreSQL

## Getting started

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies (once backend and frontend are scaffolded):

   ```bash
   npm install
   ```

3. Run both apps:

   ```bash
   npm run dev
   ```

## Development milestones

- [x] **M1 — Foundation:** Monorepo, health check, frontend ↔ backend communication
- [ ] **M2 — Market data:** Gemini REST integration via exchange abstraction
- [ ] **M3 — WebSockets:** Live price updates through backend
- [ ] **M4 — Authentication:** Registration, login, JWT
- [ ] **M5 — Portfolio:** Cash, positions, trade history
- [ ] **M6 — Paper trading:** Simulated buy/sell with PnL

## License

Private — portfolio project.
