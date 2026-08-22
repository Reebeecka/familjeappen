-- ============================================================
-- Familjeappen – reaktioner på aktivitetsflödet (Fas 8)
-- Kör efter supabase/phase6_activity.sql.
-- ============================================================

-- ---------- Tabell ----------

create table if not exists public.activity_reactions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (activity_id, user_id, emoji)
);

create index if not exists ix_activity_reactions_activity_id
  on public.activity_reactions (activity_id);

-- ---------- Radnivåsäkerhet ----------

alter table public.activity_reactions enable row level security;

drop policy if exists "activity_reactions in my household"
  on public.activity_reactions;
create policy "activity_reactions in my household"
  on public.activity_reactions
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------- Realtid ----------

do $$ begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'activity_reactions'
  ) then
    alter publication supabase_realtime add table public.activity_reactions;
  end if;
end $$;
