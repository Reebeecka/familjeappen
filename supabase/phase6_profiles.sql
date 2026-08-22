alter table profiles add column if not exists color text;
alter table profiles add column if not exists avatar text;

alter table profiles enable row level security;

drop policy if exists "read household profiles" on profiles;
create policy "read household profiles" on profiles
  for select using (household_id = public.current_household_id());
