ALTER TABLE settings
  ADD COLUMN exchange TEXT NOT NULL DEFAULT 'gemini'
  CHECK (exchange IN ('gemini', 'coinbase'));
