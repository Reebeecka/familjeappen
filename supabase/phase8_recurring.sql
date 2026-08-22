-- ============================================================
-- Familjeappen – materialisering av återkommande uppgifter (Fas 8)
-- Kör efter phase2.sql och phase7_lists.sql.
-- ============================================================

alter table public.recurring_tasks
  add column if not exists last_materialized_date date;

-- Edge-funktionen avgör vilka uppgifter som gäller för dagen. Den här
-- databasfunktionen låser hushållet och uppgiften så att skapande av lista,
-- listpunkt och uppdatering av datum sker atomiskt utan dubbletter.
create or replace function public.materialize_recurring_task(
  p_task_id uuid,
  p_materialized_date date
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  recurring_task public.recurring_tasks%rowtype;
  todo_list_id uuid;
begin
  select *
  into recurring_task
  from public.recurring_tasks
  where id = p_task_id
    and active = true
  for update;

  if not found then
    return false;
  end if;

  if recurring_task.last_materialized_date is not null
    and recurring_task.last_materialized_date >= p_materialized_date then
    return false;
  end if;

  -- Serialisera listskapande även när flera uppgifter i samma hushåll körs.
  perform 1
  from public.households
  where id = recurring_task.household_id
  for update;

  select id
  into todo_list_id
  from public.lists
  where household_id = recurring_task.household_id
    and name = 'Att göra'
    and type = 'todo'
  order by created_at, id
  limit 1;

  if todo_list_id is null then
    insert into public.lists (household_id, name, type, icon)
    values (recurring_task.household_id, 'Att göra', 'todo', '✅')
    returning id into todo_list_id;
  end if;

  insert into public.list_items (household_id, list_id, title, done)
  values (
    recurring_task.household_id,
    todo_list_id,
    recurring_task.title,
    false
  );

  update public.recurring_tasks
  set last_materialized_date = p_materialized_date
  where id = recurring_task.id;

  return true;
end;
$$;

-- RPC:n ska bara kunna anropas med service role-nyckeln.
revoke all on function public.materialize_recurring_task(uuid, date)
  from public, anon, authenticated;
grant execute on function public.materialize_recurring_task(uuid, date)
  to service_role;

-- MANUAL_STEP: Projektets URL och anropsnyckel är inte tillgängliga säkert
-- i denna migration, så cron skapas inte här. Schemalägg ett dagligt POST-anrop
-- till:
--   https://<PROJECT_REF>.supabase.co/functions/v1/materialize-recurring
-- Använd Supabase Scheduled Functions, eller pg_cron + pg_net med nyckeln lagrad
-- i Supabase Vault. Skicka:
--   Authorization: Bearer <SUPABASE_ANON_KEY>
--   Content-Type: application/json
-- Kroppen kan vara ett tomt JSON-objekt: {}.
