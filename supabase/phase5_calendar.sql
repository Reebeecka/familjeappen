-- ============================================================
-- Familjeappen – databasschema (Fas 5): kalender
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- ============================================================

alter table calendar_events add column if not exists color text;
alter table calendar_events add column if not exists category text;
alter table contacts add column if not exists birthday date;
