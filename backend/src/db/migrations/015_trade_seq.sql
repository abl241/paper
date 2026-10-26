-- Insertion order for trades. Fills from one strategy tick can share executed_at
-- (catch-up and live fill stamped with the same bar), so ordering needs a tiebreaker.
ALTER TABLE trades ADD COLUMN seq BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE INDEX idx_trades_strategy_run_seq
  ON trades (strategy_run_id, executed_at, seq)
  WHERE strategy_run_id IS NOT NULL;
