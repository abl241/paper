-- Tag paper fills that came from a live strategy run.

ALTER TABLE trades
  ADD COLUMN strategy_run_id UUID REFERENCES strategy_runs (id) ON DELETE SET NULL;

CREATE INDEX idx_trades_strategy_run_id
  ON trades (strategy_run_id, executed_at DESC)
  WHERE strategy_run_id IS NOT NULL;

CREATE INDEX idx_trades_portfolio_strategy_source
  ON trades (portfolio_id, executed_at DESC)
  WHERE strategy_run_id IS NOT NULL;
