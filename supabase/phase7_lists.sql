-- ============================================================
-- Familjeappen – gemensamma listor (Fas 7)
-- Kör efter schema.sql och phase6_activity.sql.
-- ============================================================

-- ---------- Tabeller ----------

alter table public.tasks
  add column if not exists assigned_to uuid
  references auth.users (id) on delete set null;

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  type text not null default 'todo' check (type in ('todo', 'shopping')),
  icon text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  assigned_to uuid references auth.users (id) on delete set null,
  quantity text,
  category text,
  position int,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists ix_lists_household on public.lists (household_id);
create index if not exists ix_list_items_household on public.list_items (household_id);
create index if not exists ix_list_items_list on public.list_items (list_id);

-- ---------- Radnivåsäkerhet ----------

alter table public.lists enable row level security;
drop policy if exists "lists in my household" on public.lists;
create policy "lists in my household" on public.lists
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

alter table public.list_items enable row level security;
drop policy if exists "list_items in my household" on public.list_items;
create policy "list_items in my household" on public.list_items
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------- Standardlistor och befintlig data ----------

insert into public.lists (household_id, name, type, icon)
select household.id, 'Att göra', 'todo', '✅'
from public.households as household
where not exists (
  select 1
  from public.lists as existing_list
  where existing_list.household_id = household.id
    and existing_list.name = 'Att göra'
    and existing_list.type = 'todo'
);

insert into public.lists (household_id, name, type, icon)
select household.id, 'Inköp', 'shopping', '🛒'
from public.households as household
where not exists (
  select 1
  from public.lists as existing_list
  where existing_list.household_id = household.id
    and existing_list.name = 'Inköp'
    and existing_list.type = 'shopping'
);

insert into public.list_items (
  id,
  household_id,
  list_id,
  title,
  done,
  assigned_to,
  created_by,
  updated_by,
  created_at
)
select
  task.id,
  task.household_id,
  target_list.id,
  task.title,
  task.done,
  task.assigned_to,
  task.created_by,
  task.updated_by,
  task.created_at
from public.tasks as task
join lateral (
  select id
  from public.lists
  where household_id = task.household_id
    and name = 'Att göra'
    and type = 'todo'
  order by created_at, id
  limit 1
) as target_list on true
on conflict (id) do nothing;

insert into public.list_items (
  id,
  household_id,
  list_id,
  title,
  done,
  created_by,
  updated_by,
  created_at
)
select
  shopping_item.id,
  shopping_item.household_id,
  target_list.id,
  shopping_item.name,
  shopping_item.checked,
  shopping_item.created_by,
  shopping_item.updated_by,
  shopping_item.created_at
from public.shopping_items as shopping_item
join lateral (
  select id
  from public.lists
  where household_id = shopping_item.household_id
    and name = 'Inköp'
    and type = 'shopping'
  order by created_at, id
  limit 1
) as target_list on true
on conflict (id) do nothing;

-- ---------- Aktivitetslogg ----------

drop trigger if exists log_list_item_created on public.list_items;
create trigger log_list_item_created
  after insert on public.list_items
  for each row
  execute function public.log_activity('la till', 'listpunkt', 'title');

drop trigger if exists log_list_item_completed on public.list_items;
create trigger log_list_item_completed
  after update on public.list_items
  for each row
  when (old.done is distinct from new.done and new.done = true)
  execute function public.log_activity('slutförde', 'uppgift', 'title');

-- ---------- Realtid ----------

do $$ begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lists'
  ) then
    alter publication supabase_realtime add table public.lists;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'list_items'
  ) then
    alter publication supabase_realtime add table public.list_items;
  end if;
end $$;
