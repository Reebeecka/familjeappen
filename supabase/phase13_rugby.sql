-- ============================================================
-- Familjeappen – rugby (Top 14 / Pro D2)
-- Kör efter phase2.sql. Får köras om.
-- Matcher är gemensamma (inte per hushåll). Skrivs av edge-funktionen
-- sync-rugby. Läsning: inloggade användare.
-- ============================================================

create table if not exists public.rugby_matches (
  api_id bigint primary key,
  league_id integer not null,
  league_name text not null,
  season integer not null,
  kickoff_at timestamptz not null,
  status_short text,
  home_team_id integer not null,
  away_team_id integer not null,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  updated_at timestamptz not null default now()
);

create index if not exists ix_rugby_matches_kickoff
  on public.rugby_matches (kickoff_at);

alter table public.rugby_matches enable row level security;

grant select on table public.rugby_matches to authenticated;

drop policy if exists "rugby matches readable in household" on public.rugby_matches;
drop policy if exists "authenticated can read rugby matches" on public.rugby_matches;
create policy "authenticated can read rugby matches" on public.rugby_matches
  for select
  to authenticated
  using (true);

-- Service role (edge function) går förbi RLS.

do $$ begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'rugby_matches'
  ) then
    alter publication supabase_realtime add table public.rugby_matches;
  end if;
end $$;
