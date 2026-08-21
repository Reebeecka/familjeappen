-- ============================================================
-- Familjeappen – databasschema (Fas 1)
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- ============================================================

-- ---------- Tabeller ----------

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Vårt hushåll',
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  household_id uuid references households (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  checked boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ix_tasks_household on tasks (household_id);
create index if not exists ix_shopping_household on shopping_items (household_id);
create index if not exists ix_push_household on push_subscriptions (household_id);

-- ---------- Skapa profil automatiskt vid nytt konto ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Hjälpfunktion: nuvarande användares hushåll ----------

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- ---------- Skapa / gå med i hushåll (säkra RPC-funktioner) ----------

create or replace function public.create_household(p_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  new_household households;
begin
  new_code := upper(substr(md5(random()::text), 1, 6));
  insert into households (name, invite_code)
  values (coalesce(nullif(p_name, ''), 'Vårt hushåll'), new_code)
  returning * into new_household;

  update profiles set household_id = new_household.id where id = auth.uid();
  return new_household;
end;
$$;

create or replace function public.join_household(p_code text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  target households;
begin
  select * into target from households where invite_code = upper(p_code);
  if target.id is null then
    raise exception 'Ingen hushåll hittades med den koden';
  end if;

  update profiles set household_id = target.id where id = auth.uid();
  return target;
end;
$$;

-- ---------- Radnivåsäkerhet (RLS) ----------
-- Var och en ser bara sitt eget hushålls data.

alter table households enable row level security;
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table shopping_items enable row level security;
alter table push_subscriptions enable row level security;

-- households: se ditt eget hushåll
drop policy if exists "household members can read" on households;
create policy "household members can read" on households
  for select using (id = public.current_household_id());

-- profiles: läs/uppdatera din egen profil
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
  for select using (id = auth.uid());

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (id = auth.uid());

-- tasks: full åtkomst inom eget hushåll
drop policy if exists "tasks in my household" on tasks;
create policy "tasks in my household" on tasks
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- shopping_items: full åtkomst inom eget hushåll
drop policy if exists "shopping in my household" on shopping_items;
create policy "shopping in my household" on shopping_items
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- push_subscriptions: var och en hanterar bara sina egna
drop policy if exists "manage own subscriptions" on push_subscriptions;
create policy "manage own subscriptions" on push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- Realtid (så ändringar syns direkt) ----------

alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table shopping_items;
