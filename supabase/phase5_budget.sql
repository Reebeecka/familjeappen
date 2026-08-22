-- ============================================================
-- Familjeappen – databasschema (Fas 5): utökad budget
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- ============================================================

alter table budget_entries
  add column if not exists currency text not null default 'SEK';

create table if not exists budget_settings (
  household_id uuid primary key references households (id) on delete cascade,
  base_currency text not null default 'SEK',
  eur_sek_rate numeric(10, 4) not null default 11.5,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz default now()
);

create table if not exists budget_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount numeric(10, 2) not null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, month)
);

create index if not exists ix_budget_settings_household
  on budget_settings (household_id);
create index if not exists ix_budget_goals_household
  on budget_goals (household_id);

-- ---------- Radnivåsäkerhet (RLS) ----------

alter table budget_settings enable row level security;
drop policy if exists "budget_settings in my household" on budget_settings;
create policy "budget_settings in my household" on budget_settings
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter table budget_goals enable row level security;
drop policy if exists "budget_goals in my household" on budget_goals;
create policy "budget_goals in my household" on budget_goals
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------- Realtid (så ändringar syns direkt) ----------

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'budget_settings'
  ) then
    alter publication supabase_realtime add table budget_settings;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'budget_goals'
  ) then
    alter publication supabase_realtime add table budget_goals;
  end if;
end $$;
