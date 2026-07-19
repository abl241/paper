-- Strategy Lab: first-class strategy entities (code + metadata + config).

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_code TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  validation_status TEXT NOT NULL DEFAULT 'unvalidated'
    CHECK (validation_status IN ('unvalidated', 'valid', 'invalid')),
  validation_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  symbols TEXT[] NOT NULL DEFAULT '{}',
  exchange TEXT CHECK (exchange IS NULL OR exchange IN ('gemini', 'coinbase')),
  timeframe TEXT NOT NULL DEFAULT '1h',
  starting_capital NUMERIC(20, 8) NOT NULL DEFAULT 100000
    CHECK (starting_capital >= 0),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT strategies_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_strategies_user_id ON strategies (user_id);
CREATE INDEX idx_strategies_user_favorite ON strategies (user_id, is_favorite)
  WHERE is_favorite = TRUE;
CREATE INDEX idx_strategies_user_updated ON strategies (user_id, updated_at DESC);
