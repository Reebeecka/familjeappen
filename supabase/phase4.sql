-- ============================================================
-- Familjeappen – Fas 4: Dokumentvalv (documents)
-- Kör hela denna fil EN gång i Supabase: SQL Editor -> New query
-- ============================================================
--
-- VIKTIGT – Storage-bucket måste skapas manuellt FÖRST:
--   1. Öppna Supabase-dashboarden -> Storage -> New bucket
--   2. Namn: documents
--   3. Public bucket: AV (lämna avstängt så att den blir privat)
--   4. Spara.
-- Utan denna privata bucket kommer filuppladdning att misslyckas.
-- ============================================================

-- ---------- Metadata-tabell ----------

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  name text not null,
  storage_path text not null,
  size bigint,
  mime_type text
);

create index if not exists ix_documents_household on documents (household_id);

-- ---------- Radnivåsäkerhet (RLS) ----------

alter table documents enable row level security;

drop policy if exists "documents in my household" on documents;
create policy "documents in my household" on documents
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------- Realtid (guardat så det inte läggs till dubbelt) ----------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table documents;
  end if;
end;
$$;

-- ---------- Storage-policies för bucketen 'documents' ----------
-- Första mappnivån i filnamnet måste vara användarens hushålls-id,
-- så att varje hushåll bara kommer åt sina egna filer.

drop policy if exists "documents storage read" on storage.objects;
create policy "documents storage read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_household_id()::text);

drop policy if exists "documents storage insert" on storage.objects;
create policy "documents storage insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_household_id()::text);

drop policy if exists "documents storage update" on storage.objects;
create policy "documents storage update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_household_id()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_household_id()::text);

drop policy if exists "documents storage delete" on storage.objects;
create policy "documents storage delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_household_id()::text);
