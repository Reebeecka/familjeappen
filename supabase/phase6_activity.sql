-- ============================================================
-- Familjeappen – aktivitetsflöde (Fas 6)
-- Kör efter migreringen som skapar profiles.
-- ============================================================

-- ---------- Tabell ----------

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists ix_activity_household_created_at
  on public.activity (household_id, created_at desc);

-- ---------- Logga aktivitet från källtabeller ----------

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_actor_id uuid;
  activity_actor_name text;
  activity_summary text;
begin
  activity_actor_id := coalesce(new.updated_by, new.created_by);
  activity_summary := to_jsonb(new) ->> tg_argv[2];

  select display_name
    into activity_actor_name
    from public.profiles
   where id = activity_actor_id;

  insert into public.activity (
    household_id,
    actor_id,
    actor_name,
    action,
    entity,
    summary
  )
  values (
    new.household_id,
    activity_actor_id,
    activity_actor_name,
    tg_argv[0],
    tg_argv[1],
    activity_summary
  );

  return new;
end;
$$;

drop trigger if exists log_task_created on public.tasks;
create trigger log_task_created
  after insert on public.tasks
  for each row
  execute function public.log_activity('skapade', 'uppgift', 'title');

drop trigger if exists log_task_completed on public.tasks;
create trigger log_task_completed
  after update on public.tasks
  for each row
  when (old.done is distinct from new.done and new.done = true)
  execute function public.log_activity('slutförde', 'uppgift', 'title');

drop trigger if exists log_shopping_item_created on public.shopping_items;
create trigger log_shopping_item_created
  after insert on public.shopping_items
  for each row
  execute function public.log_activity('la till', 'inköp', 'name');

drop trigger if exists log_calendar_event_created on public.calendar_events;
create trigger log_calendar_event_created
  after insert on public.calendar_events
  for each row
  execute function public.log_activity('skapade', 'händelse', 'title');

drop trigger if exists log_meal_created on public.meals;
create trigger log_meal_created
  after insert on public.meals
  for each row
  execute function public.log_activity('planerade', 'måltid', 'title');

-- ---------- Radnivåsäkerhet ----------

alter table public.activity enable row level security;

drop policy if exists "activity in my household" on public.activity;
create policy "activity in my household" on public.activity
  for select
  using (household_id = public.current_household_id());

-- ---------- Realtid ----------

do $$ begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'activity'
  ) then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;
