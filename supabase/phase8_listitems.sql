-- Familjeappen – förfallodatum, prioritet och deluppgifter (Fas 8)
-- Kör efter phase7_lists.sql.

alter table list_items add column if not exists due_date date;
alter table list_items add column if not exists priority text default 'normal';
alter table list_items add column if not exists parent_id uuid references list_items(id) on delete cascade;

create index if not exists ix_list_items_parent on list_items (parent_id);
