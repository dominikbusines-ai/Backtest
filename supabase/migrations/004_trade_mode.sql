alter table public.trades
  add column if not exists trade_mode text not null default 'backtest';

alter table public.trades
  drop constraint if exists trades_trade_mode_check;

alter table public.trades
  add constraint trades_trade_mode_check
  check (trade_mode in ('backtest', 'live'));

create index if not exists trades_trade_mode_idx
  on public.trades (trade_mode);
