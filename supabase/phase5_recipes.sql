-- Deploya även Edge Function: supabase functions deploy import-recipe
-- ============================================================
-- Familjeappen – databasschema (Fas 5: Receptbok)
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- Kräver att schema.sql (Fas 1) redan är kört.
-- ============================================================

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  source_url text,
  image_url text,
  servings int check (servings is null or servings > 0),
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ix_recipes_household on recipes (household_id);

alter table recipes enable row level security;

drop policy if exists "recipes in my household" on recipes;
create policy "recipes in my household" on recipes
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

do $$ begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recipes'
  ) then
    alter publication supabase_realtime add table recipes;
  end if;
end $$;
