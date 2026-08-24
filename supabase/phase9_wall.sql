-- ============================================================
-- Familjeappen – familjeväggen v2 (Fas 9)
-- Klickbara poster (entity_id), mindre brus från inköpslistan
-- och naturligare formuleringar.
-- Kör efter phase6_activity.sql och phase7_lists.sql.
-- ============================================================

-- ---------- Länkbar målreferens ----------

alter table public.activity
  add column if not exists entity_id uuid;

-- ---------- Generisk logg med valfritt entity_id ----------
-- tg_argv[0]=action, [1]=entity, [2]=summary-kolumn, [3]=entity_id-kolumn (valfri)

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_actor_id uuid;
  activity_actor_name text;
  activity_summary text;
  activity_entity_id uuid;
begin
  activity_actor_id := coalesce(new.updated_by, new.created_by);
  activity_summary := to_jsonb(new) ->> tg_argv[2];

  if tg_nargs > 3 and tg_argv[3] is not null then
    activity_entity_id := nullif(to_jsonb(new) ->> tg_argv[3], '')::uuid;
  end if;

  select display_name
    into activity_actor_name
    from public.profiles
   where id = activity_actor_id;

  insert into public.activity (
    household_id, actor_id, actor_name, action, entity, summary, entity_id
  )
  values (
    new.household_id, activity_actor_id, activity_actor_name,
    tg_argv[0], tg_argv[1], activity_summary, activity_entity_id
  );

  return new;
end;
$$;

-- ---------- Listpunkter: uppgifter loggas var för sig,
-- inköp samlas ihop (max en post per lista per 10 min) ----------

create or replace function public.log_list_item_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list record;
  activity_actor_id uuid;
  activity_actor_name text;
  logged_recently boolean;
begin
  -- deluppgifter ska inte skräpa ner väggen
  if new.parent_id is not null then
    return new;
  end if;

  select id, name, type
    into target_list
    from public.lists
   where id = new.list_id;

  if target_list.id is null then
    return new;
  end if;

  activity_actor_id := coalesce(new.updated_by, new.created_by);
  select display_name
    into activity_actor_name
    from public.profiles
   where id = activity_actor_id;

  if target_list.type = 'shopping' then
    select exists (
      select 1
        from public.activity
       where household_id = new.household_id
         and entity_id = new.list_id
         and action = 'la till'
         and created_at > now() - interval '10 minutes'
    ) into logged_recently;

    if logged_recently then
      return new;
    end if;

    insert into public.activity (
      household_id, actor_id, actor_name, action, entity, summary, entity_id
    )
    values (
      new.household_id, activity_actor_id, activity_actor_name,
      'la till', 'nya saker i', target_list.name, new.list_id
    );
  else
    insert into public.activity (
      household_id, actor_id, actor_name, action, entity, summary, entity_id
    )
    values (
      new.household_id, activity_actor_id, activity_actor_name,
      'la till', 'uppgiften', new.title, new.list_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_list_item_created on public.list_items;
create trigger log_list_item_created
  after insert on public.list_items
  for each row
  execute function public.log_list_item_created();

-- ---------- Slutförda uppgifter blir klickbara ----------

drop trigger if exists log_list_item_completed on public.list_items;
create trigger log_list_item_completed
  after update on public.list_items
  for each row
  when (old.done is distinct from new.done and new.done = true)
  execute function public.log_activity('slutförde', 'uppgiften', 'title', 'list_id');

-- ---------- Naturligare formuleringar för kalender och måltider ----------

drop trigger if exists log_calendar_event_created on public.calendar_events;
create trigger log_calendar_event_created
  after insert on public.calendar_events
  for each row
  execute function public.log_activity('skapade', 'händelsen', 'title');

drop trigger if exists log_meal_created on public.meals;
create trigger log_meal_created
  after insert on public.meals
  for each row
  execute function public.log_activity('planerade', 'måltiden', 'title');
