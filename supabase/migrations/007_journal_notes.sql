-- Independent personal notes. Existing trades and their notes are unchanged.
create table if not exists public.journal_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 120),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_notes_created_at_idx
  on public.journal_notes (created_at desc, id desc);

-- Access through server-side routes, as for the existing single-user journal.
alter table public.journal_notes enable row level security;
revoke all on public.journal_notes from anon, authenticated;
grant select, insert, update, delete on public.journal_notes to service_role;
