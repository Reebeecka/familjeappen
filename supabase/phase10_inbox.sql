-- ============================================================
-- Familjeappen – notisinkorg (Fas 10)
-- path för djuplänkar, inköp samlas (10 min), bara relevanta händelser.
-- Kör efter phase9_wall.sql.
-- Får köras om.
-- ============================================================

alter table public.activity
  add column if not exists path text;

-- ---------- Inköp: en notis per lista per 10 minuter ----------
-- Övriga listor: en rad per uppgift, med länk till just den punkten.

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
         and entity = 'inköp'
         and created_at > now() - interval '10 minutes'
    ) into logged_recently;

    if logged_recently then
      return new;
    end if;

    insert into public.activity (
      household_id, actor_id, actor_name, action, entity, summary, entity_id, path
    )
    values (
      new.household_id, activity_actor_id, activity_actor_name,
      'uppdaterade', 'inköp', target_list.name, new.list_id,
      '/listor/' || new.list_id::text
    );
    return new;
  end if;

  insert into public.activity (
    household_id, actor_id, actor_name, action, entity, summary, entity_id, path
  )
  values (
    new.household_id, activity_actor_id, activity_actor_name,
    'lade till', 'uppgift', new.title, new.list_id,
    '/listor/' || new.list_id::text || '?item=' || new.id::text
  );

  return new;
end;
$$;

create or replace function public.log_list_item_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  list_type text;
  activity_actor_id uuid;
  activity_actor_name text;
begin
  select type into list_type from public.lists where id = new.list_id;
  if list_type is null or list_type = 'shopping' then
    return new;
  end if;

  activity_actor_id := coalesce(new.updated_by, new.created_by);
  select display_name
    into activity_actor_name
    from public.profiles
   where id = activity_actor_id;

  insert into public.activity (
    household_id, actor_id, actor_name, action, entity, summary, entity_id, path
  )
  values (
    new.household_id, activity_actor_id, activity_actor_name,
    'klarade', 'uppgift', new.title, new.list_id,
    '/listor/' || new.list_id::text || '?item=' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists log_list_item_created on public.list_items;
create trigger log_list_item_created
  after insert on public.list_items
  for each row
  execute function public.log_list_item_created();

drop trigger if exists log_list_item_completed on public.list_items;
create trigger log_list_item_completed
  after update on public.list_items
  for each row
  when (old.done is distinct from new.done and new.done = true)
  execute function public.log_list_item_completed();

-- ---------- Kalender ----------

create or replace function public.log_calendar_event_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_actor_id uuid;
  activity_actor_name text;
begin
  activity_actor_id := coalesce(new.updated_by, new.created_by);
  select display_name into activity_actor_name from public.profiles where id = activity_actor_id;

  insert into public.activity (
    household_id, actor_id, actor_name, action, entity, summary, entity_id, path
  )
  values (
    new.household_id, activity_actor_id, activity_actor_name,
    'lade till', 'händelse', new.title, new.id,
    '/kalender?event=' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists log_calendar_event_created on public.calendar_events;
create trigger log_calendar_event_created
  after insert on public.calendar_events
  for each row
  execute function public.log_calendar_event_created();

-- Måltider ska inte hamna i inkorgen
drop trigger if exists log_meal_created on public.meals;

-- ---------- Chatt ----------

create or replace function public.log_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_actor_name text;
begin
  select display_name into activity_actor_name from public.profiles where id = new.sender_id;

  insert into public.activity (
    household_id, actor_id, actor_name, action, entity, summary, entity_id, path
  )
  values (
    new.household_id, new.sender_id, activity_actor_name,
    'skickade', 'chatt', left(new.body, 80), new.id,
    '/chatt'
  );
  return new;
end;
$$;

drop trigger if exists log_message_created on public.messages;
create trigger log_message_created
  after insert on public.messages
  for each row
  execute function public.log_message_created();

-- ---------- Dokument ----------

create or replace function public.log_document_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_actor_id uuid;
  activity_actor_name text;
begin
  activity_actor_id := coalesce(new.updated_by, new.created_by);
  select display_name into activity_actor_name from public.profiles where id = activity_actor_id;

  insert into public.activity (
    household_id, actor_id, actor_name, action, entity, summary, entity_id, path
  )
  values (
    new.household_id, activity_actor_id, activity_actor_name,
    'laddade upp', 'dokument', new.name, new.id,
    '/dokument?doc=' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists log_document_created on public.documents;
create trigger log_document_created
  after insert on public.documents
  for each row
  execute function public.log_document_created();
