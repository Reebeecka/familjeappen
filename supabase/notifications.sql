-- ============================================================
-- Familjeappen – tillägg för push-notiser
-- Kör denna EN gång i Supabase (SQL Editor) om du redan kört schema.sql tidigare.
-- (Är du på en helt ny databas räcker det att köra schema.sql som redan innehåller detta.)
-- ============================================================

-- Spåra vem som senast ändrade en rad (så vi inte notifierar personen själv).
alter table tasks add column if not exists updated_by uuid references auth.users (id) on delete set null;
alter table shopping_items add column if not exists updated_by uuid references auth.users (id) on delete set null;

-- Tabell för varje enhets push-prenumeration.
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ix_push_household on push_subscriptions (household_id);

alter table push_subscriptions enable row level security;

-- Var och en hanterar bara sina egna prenumerationer.
drop policy if exists "manage own subscriptions" on push_subscriptions;
create policy "manage own subscriptions" on push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
