-- ============================================================
-- Familjeappen – profilbilder (Fas 9)
-- Lägger till avatar_url samt en publik "avatars"-bucket.
-- Kör efter phase6_profiles.sql.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;

-- ---------- Lagringsbucket ----------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------- Policys för storage.objects ----------
-- Alla får läsa profilbilder (publik bucket).
-- Var och en får bara skriva i sin egen mapp: <user_id>/...

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
