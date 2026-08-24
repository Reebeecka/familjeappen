-- ============================================================
-- Familjeappen – gömda väggposter (per användare)
-- Kör efter phase6_activity.sql.
-- ============================================================

create table if not exists public.activity_hidden (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null references public.activity (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index if not exists ix_activity_hidden_household
  on public.activity_hidden (household_id);

alter table public.activity_hidden enable row level security;

drop policy if exists "own hidden activity" on public.activity_hidden;
create policy "own hidden activity" on public.activity_hidden
  for all
  using (
    user_id = auth.uid()
    and household_id = public.current_household_id()
  )
  with check (
    user_id = auth.uid()
    and household_id = public.current_household_id()
  );
