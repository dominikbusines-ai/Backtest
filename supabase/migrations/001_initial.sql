create extension if not exists pgcrypto;

create table if not exists public.tag_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0
);

create unique index if not exists tag_categories_name_unique on public.tag_categories (lower(name));

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  category_id uuid references public.tag_categories(id) on delete set null,
  is_default boolean not null default false
);

create unique index if not exists tags_name_unique on public.tags (lower(name));
create index if not exists tags_category_idx on public.tags (category_id);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trade_date date not null,
  trade_time time,
  instrument text not null check (char_length(instrument) between 1 and 30),
  timeframe text check (timeframe is null or char_length(timeframe) <= 20),
  direction text not null check (direction in ('long', 'short')),
  entry numeric,
  stop_loss numeric,
  take_profit numeric,
  planned_rr numeric check (planned_rr is null or planned_rr >= 0),
  result_r numeric,
  result_type text not null check (result_type in ('win', 'loss', 'breakeven')),
  confidence smallint check (confidence is null or confidence between 1 and 5),
  context text,
  entry_note text,
  screenshot_url text,
  mfe numeric,
  mae numeric
);

create index if not exists trades_date_idx on public.trades (trade_date desc, trade_time desc);
create index if not exists trades_instrument_idx on public.trades (instrument);
create index if not exists trades_result_idx on public.trades (result_type);
create index if not exists trades_confidence_idx on public.trades (confidence);

create table if not exists public.trade_tags (
  trade_id uuid not null references public.trades(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (trade_id, tag_id)
);

create index if not exists trade_tags_tag_idx on public.trade_tags (tag_id);

alter table public.tag_categories enable row level security;
alter table public.tags enable row level security;
alter table public.trades enable row level security;
alter table public.trade_tags enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-screenshots', 'trade-screenshots', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.tag_categories (id, name, sort_order) values
  ('20000000-0000-4000-8000-000000000001', 'Struktur', 10),
  ('20000000-0000-4000-8000-000000000002', 'FVG', 20),
  ('20000000-0000-4000-8000-000000000003', 'Liquidity', 30),
  ('20000000-0000-4000-8000-000000000004', 'Marktverhalten', 40),
  ('20000000-0000-4000-8000-000000000005', 'Eigene', 50)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.tags (id, name, category_id, is_default) values
  ('10000000-0000-4000-8000-000000000001', '1m BOS', '20000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000002', '5m BOS', '20000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000003', 'FVG', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000004', 'FVG Pullback', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000005', 'IFVG', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000006', 'FVG respected', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000007', 'FVG disrespected', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000008', 'Orderflow disrespected', '20000000-0000-4000-8000-000000000004', true),
  ('10000000-0000-4000-8000-000000000009', 'Liquidity Sweep', '20000000-0000-4000-8000-000000000003', true),
  ('10000000-0000-4000-8000-000000000010', 'Sell-Side Liquidity', '20000000-0000-4000-8000-000000000003', true),
  ('10000000-0000-4000-8000-000000000011', 'Buy-Side Liquidity', '20000000-0000-4000-8000-000000000003', true),
  ('10000000-0000-4000-8000-000000000012', '5m Abflachung', '20000000-0000-4000-8000-000000000004', true),
  ('10000000-0000-4000-8000-000000000013', 'Konsolidierung', '20000000-0000-4000-8000-000000000004', true),
  ('10000000-0000-4000-8000-000000000014', 'Trendfortsetzung', '20000000-0000-4000-8000-000000000004', true),
  ('10000000-0000-4000-8000-000000000015', 'Reversal', '20000000-0000-4000-8000-000000000004', true),
  ('10000000-0000-4000-8000-000000000016', 'HTF FVG', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000017', '4h FVG', '20000000-0000-4000-8000-000000000002', true),
  ('10000000-0000-4000-8000-000000000018', 'Rejection', '20000000-0000-4000-8000-000000000004', true),
  ('10000000-0000-4000-8000-000000000019', 'Displacement', '20000000-0000-4000-8000-000000000004', true)
on conflict (id) do update set name = excluded.name, category_id = excluded.category_id, is_default = excluded.is_default;
