-- Multi-portfolio hub: portfolios own cash, positions, and trades.

CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starting_cash NUMERIC(20, 8) NOT NULL CHECK (starting_cash >= 0),
  cash_balance NUMERIC(20, 8) NOT NULL CHECK (cash_balance >= 0),
  exchange TEXT CHECK (exchange IS NULL OR exchange IN ('gemini', 'coinbase')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolios_user_id ON portfolios (user_id);
CREATE UNIQUE INDEX idx_portfolios_one_default_per_user
  ON portfolios (user_id)
  WHERE is_default = TRUE AND archived_at IS NULL;

-- Backfill one Main portfolio per existing cash account.
INSERT INTO portfolios (user_id, name, starting_cash, cash_balance, is_default)
SELECT
  ca.user_id,
  'Main',
  100000,
  ca.balance,
  TRUE
FROM cash_accounts ca;

-- Users without a cash account still get a Main portfolio (edge case).
INSERT INTO portfolios (user_id, name, starting_cash, cash_balance, is_default)
SELECT
  u.id,
  'Main',
  100000,
  100000,
  TRUE
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM portfolios p WHERE p.user_id = u.id
);

-- Positions: move from user_id → portfolio_id
ALTER TABLE positions ADD COLUMN portfolio_id UUID REFERENCES portfolios (id) ON DELETE CASCADE;

UPDATE positions pos
SET portfolio_id = p.id
FROM portfolios p
WHERE p.user_id = pos.user_id
  AND p.is_default = TRUE;

ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_user_id_symbol_key;
ALTER TABLE positions DROP COLUMN user_id;
ALTER TABLE positions ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE positions ADD CONSTRAINT positions_portfolio_symbol_key UNIQUE (portfolio_id, symbol);
CREATE INDEX idx_positions_portfolio_id ON positions (portfolio_id);
DROP INDEX IF EXISTS idx_positions_user_id;

-- Trades: move from user_id → portfolio_id
ALTER TABLE trades ADD COLUMN portfolio_id UUID REFERENCES portfolios (id) ON DELETE CASCADE;

UPDATE trades t
SET portfolio_id = p.id
FROM portfolios p
WHERE p.user_id = t.user_id
  AND p.is_default = TRUE;

ALTER TABLE trades DROP COLUMN user_id;
ALTER TABLE trades ALTER COLUMN portfolio_id SET NOT NULL;
DROP INDEX IF EXISTS idx_trades_user_executed_at;
CREATE INDEX idx_trades_portfolio_executed_at ON trades (portfolio_id, executed_at DESC);

CREATE TABLE cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'reset')),
  amount NUMERIC(20, 8) NOT NULL,
  balance_after NUMERIC(20, 8) NOT NULL CHECK (balance_after >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_ledger_portfolio_created_at
  ON cash_ledger (portfolio_id, created_at DESC);

DROP TABLE cash_accounts;
