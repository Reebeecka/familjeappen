-- ============================================================
-- Familjeappen – ny listtyp "Annat" (Fas 9)
-- Enkel checklista utan förfallodatum, prioritet eller tilldelning.
-- Kör efter phase7_lists.sql.
-- ============================================================

alter table public.lists
  drop constraint if exists lists_type_check;

alter table public.lists
  add constraint lists_type_check
  check (type in ('todo', 'shopping', 'simple'));
