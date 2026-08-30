alter table public.trades
  add column if not exists review_illogical text;

alter table public.trades
  alter column direction drop not null;

alter table public.trades
  drop constraint if exists trades_direction_check;

alter table public.trades
  add constraint trades_direction_check
  check (direction is null or direction in ('long', 'short'));

alter table public.trades
  drop constraint if exists trades_result_type_check;

alter table public.trades
  add constraint trades_result_type_check
  check (result_type in ('win', 'loss', 'breakeven', 'no_trade'));
