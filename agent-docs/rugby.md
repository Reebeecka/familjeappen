# Rugby (Top 14 / Pro D2)

Matcher nära Pamiers för att åka och köpa biljetter.

## Klubbar
Toulouse, Pau, Castres, Perpignan, Colomiers, Narbonne, Montauban, Béziers.
Inte Carcassonne (Nationale).

## Källa
Officiella LNR-kalendrar (`top14.lnr.fr` och `prod2.lnr.fr`). Ingen API-nyckel.

## Att köra i Supabase
1. SQL: `supabase/phase13_rugby.sql`
2. Deploy: `supabase functions deploy sync-rugby`

Biljettlänkar är hårdkodade per hemmaklubb. Avsparkstider fylls i när LNR publicerar dem.
