-- ============================================================
-- Familjeappen – Fas 8: Personliga notisinställningar
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- ============================================================

-- ---------- Tabell ----------

create table if not exists notification_prefs (
  user_id uuid primary key,
  household_id uuid not null references households (id) on delete cascade,
  notify_tasks boolean not null default true,
  notify_shopping boolean not null default true,
  notify_calendar boolean not null default true,
  notify_chat boolean not null default true,
  updated_at timestamptz default now()
);

-- ---------- Radnivåsäkerhet (RLS) ----------

alter table notification_prefs enable row level security;

drop policy if exists "own notification prefs" on notification_prefs;
create policy "own notification prefs" on notification_prefs
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and household_id = public.current_household_id()
  );
