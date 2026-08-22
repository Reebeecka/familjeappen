-- ============================================================
-- Familjeappen – familjechatt (Fas 8)
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- Kräver households och public.current_household_id().
-- ============================================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  sender_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ix_messages_household_created_at
  on messages (household_id, created_at);

alter table messages enable row level security;

drop policy if exists "messages in my household" on messages;
drop policy if exists "read messages in my household" on messages;
drop policy if exists "create own messages" on messages;
drop policy if exists "update own messages" on messages;
drop policy if exists "delete own messages" on messages;

create policy "read messages in my household" on messages
  for select
  using (household_id = public.current_household_id());

create policy "create own messages" on messages
  for insert
  with check (
    household_id = public.current_household_id()
    and sender_id = auth.uid()
  );

create policy "update own messages" on messages
  for update
  using (sender_id = auth.uid());

create policy "delete own messages" on messages
  for delete
  using (sender_id = auth.uid());

do $$ begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
