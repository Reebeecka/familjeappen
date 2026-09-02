-- ============================================================
-- Familjeappen – namnge automatiska återkommande uppgifter
-- Kör efter phase10_inbox.sql. Får köras om.
-- ============================================================

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
  if activity_actor_id is null then
    activity_actor_name := 'Återkommande';
  else
    select display_name
      into activity_actor_name
      from public.profiles
     where id = activity_actor_id;
  end if;

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

update public.activity
   set actor_name = 'Återkommande'
 where actor_id is null
   and coalesce(actor_name, '') = ''
   and entity in ('uppgift', 'uppgiften', 'listpunkt');
