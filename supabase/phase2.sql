-- ============================================================
-- Familjeappen – databasschema (Fas 2)
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- Kräver att schema.sql (Fas 1) redan är kört (households, profiles,
-- public.current_household_id()).
-- ============================================================

-- ---------- Tabeller ----------

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  weekday int,
  day_of_month int,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('frukost', 'lunch', 'middag')),
  title text not null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ix_calendar_events_household on calendar_events (household_id);
create index if not exists ix_recurring_tasks_household on recurring_tasks (household_id);
create index if not exists ix_meals_household on meals (household_id);

-- ---------- Radnivåsäkerhet (RLS) ----------
-- Var och en ser bara sitt eget hushålls data.

alter table calendar_events enable row level security;
drop policy if exists "calendar_events in my household" on calendar_events;
create policy "calendar_events in my household" on calendar_events
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter table recurring_tasks enable row level security;
drop policy if exists "recurring_tasks in my household" on recurring_tasks;
create policy "recurring_tasks in my household" on recurring_tasks
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter table meals enable row level security;
drop policy if exists "meals in my household" on meals;
create policy "meals in my household" on meals
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------- Realtid (så ändringar syns direkt) ----------

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_events'
  ) then
    alter publication supabase_realtime add table calendar_events;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recurring_tasks'
  ) then
    alter publication supabase_realtime add table recurring_tasks;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meals'
  ) then
    alter publication supabase_realtime add table meals;
  end if;
end $$;
