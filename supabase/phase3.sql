-- ============================================================
-- Familjeappen – databasschema (Fas 3): budget + kontakter
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- ============================================================

-- ---------- Tabeller ----------

create table if not exists budget_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  kind text not null check (kind in ('inkomst', 'utgift')),
  category text,
  amount numeric(10, 2) not null,
  note text,
  entry_date date not null default current_date,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  category text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ix_budget_entries_household on budget_entries (household_id);
create index if not exists ix_contacts_household on contacts (household_id);

-- ---------- Radnivåsäkerhet (RLS) ----------

alter table budget_entries enable row level security;
drop policy if exists "budget_entries in my household" on budget_entries;
create policy "budget_entries in my household" on budget_entries
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter table contacts enable row level security;
drop policy if exists "contacts in my household" on contacts;
create policy "contacts in my household" on contacts
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------- Realtid (så ändringar syns direkt) ----------

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budget_entries'
  ) then
    alter publication supabase_realtime add table budget_entries;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table contacts;
  end if;
end $$;
