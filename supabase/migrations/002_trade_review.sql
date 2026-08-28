alter table public.trades
  add column if not exists review_observation text,
  add column if not exists review_mistake text,
  add column if not exists review_invalidation text;
