-- Keep a stable, server-side creation timestamp for every trade.
-- It is intentionally separate from trade_date/trade_time (the market event)
-- and is not rendered in the website UI. AI consumers can use it to order
-- alternating backtests and live trades chronologically.
alter table public.trades
  alter column created_at set default now();

update public.trades
set created_at = now()
where created_at is null;

alter table public.trades
  alter column created_at set not null;

create index if not exists trades_created_at_idx
  on public.trades (created_at asc);
