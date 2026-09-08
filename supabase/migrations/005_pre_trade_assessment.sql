-- Optionale Pre-Trade-Bewertung für Backtests und Live-Trades.
alter table public.trades
  add column if not exists pre_trade_assessment text
  check (pre_trade_assessment is null or char_length(pre_trade_assessment) <= 5000);
