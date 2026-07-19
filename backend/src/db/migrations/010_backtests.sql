-- Research backtest runs (persisted simulation results).

CREATE TABLE backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES strategies (id) ON DELETE CASCADE,
  strategy_name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  exchange TEXT CHECK (exchange IS NULL OR exchange IN ('gemini', 'coinbase')),
  range_label TEXT NOT NULL DEFAULT 'max',
  starting_capital NUMERIC(20, 8) NOT NULL CHECK (starting_capital >= 0),
  fee_bps NUMERIC(10, 4) NOT NULL DEFAULT 0 CHECK (fee_bps >= 0),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed')),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  equity_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
  trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT[] NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backtests_user_created ON backtests (user_id, created_at DESC);
CREATE INDEX idx_backtests_strategy ON backtests (strategy_id, created_at DESC);
