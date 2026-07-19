-- Equity chart display preferences (Robinhood-style portfolio value curve)
ALTER TABLE settings
  ADD COLUMN equity_resolution TEXT NOT NULL DEFAULT '1h'
    CHECK (equity_resolution IN ('15m', '1h', '6h', '1d')),
  ADD COLUMN equity_y_axis TEXT NOT NULL DEFAULT 'tight'
    CHECK (equity_y_axis IN ('tight', 'padded', 'zero')),
  ADD COLUMN equity_default_range TEXT NOT NULL DEFAULT '1W'
    CHECK (equity_default_range IN ('1D', '1W', '1M', '3M', 'YTD', 'ALL'));
