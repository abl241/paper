-- Live paper strategy runs (one armed run per portfolio).

CREATE TABLE strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES strategies (id) ON DELETE CASCADE,
  strategy_name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  exchange TEXT CHECK (exchange IS NULL OR exchange IN ('gemini', 'coinbase')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'stopped')),
  last_processed_bar_time TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  last_error TEXT,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_strategy_runs_one_running_per_portfolio
  ON strategy_runs (portfolio_id)
  WHERE status = 'running';

CREATE INDEX idx_strategy_runs_portfolio ON strategy_runs (portfolio_id, created_at DESC);
CREATE INDEX idx_strategy_runs_user ON strategy_runs (user_id, created_at DESC);
