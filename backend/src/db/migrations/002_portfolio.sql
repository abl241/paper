CREATE TABLE cash_accounts (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  balance NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL CHECK (quantity >= 0),
  average_cost NUMERIC(20, 8) NOT NULL CHECK (average_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
  execution_price NUMERIC(20, 8) NOT NULL CHECK (execution_price > 0),
  realized_pnl NUMERIC(20, 8),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_user_executed_at ON trades (user_id, executed_at DESC);
CREATE INDEX idx_positions_user_id ON positions (user_id);
