-- When true, live sells only close size this strategy run bought.
ALTER TABLE strategy_runs
  ADD COLUMN IF NOT EXISTS protect_manual_positions BOOLEAN NOT NULL DEFAULT TRUE;
