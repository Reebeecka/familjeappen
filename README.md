# Familjeappen

Familjeappen är en gemensam familjeorganisatör som samlar vardagens planering på ett ställe.
Den är byggd som en installerbar PWA och synkroniserar hushållets information i realtid.

## Funktioner

- Konton, profiler och delade hushåll med inbjudningskod
- Gemensamma listor för uppgifter, inköp och egna ändamål
- Tilldelning, prioritet, förfallodatum och deluppgifter
- Aktivitetsflöde, reaktioner och familjechatt
- Kalender, svenska helgdagar och återkommande uppgifter
- Måltidsplanering och receptbok med import från länk
- Budget med månadsöversikt och flera valutor
- Kontakter och privat dokumentvalv
- Global sökning och en samlad vy för ”Min dag”
- Push-notiser med individuella notisinställningar
- Ljust och mörkt tema
- Installation på mobil eller dator samt en tydlig offline-sida

## Teknik

- [React](https://react.dev/) för användargränssnittet
- [Vite](https://vite.dev/) för utveckling och bygg
- [Supabase](https://supabase.com/) för autentisering, PostgreSQL, realtid, Storage och
  Edge Functions
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) och Workbox för manifest,
  service worker, precache och push
- [Vercel](https://vercel.com/) för publicering

## Kör lokalt

Krav: Node.js och npm.

1. Installera beroenden:

   ```bash
   npm install
   ```

2. Skapa `.env.local` i projektroten och lägg in projektets publika klientinställningar:

   ```dotenv
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_VAPID_PUBLIC_KEY=
   ```

   `VITE_VAPID_PUBLIC_KEY` behövs för push-notiser. Lägg aldrig privata VAPID-nycklar
   eller Supabase `service_role`-nyckeln i klientens miljöfil.

3. Starta utvecklingsservern:

   ```bash
   npm run dev
   ```

Öppna adressen som Vite visar i terminalen. PWA- och service worker-beteende testas bäst
mot en produktionsbyggd version över HTTPS.

## Databas och migreringar

Skapa ett Supabase-projekt och kör SQL-filerna i Supabase SQL Editor. Kör varje fil en gång
och i följande ordning:

1. `supabase/schema.sql`
2. `supabase/phase2.sql`
3. `supabase/phase3.sql`
4. `supabase/phase4.sql`
5. Fas 5, i valfri inbördes ordning:
   - `supabase/phase5_budget.sql`
   - `supabase/phase5_calendar.sql`
   - `supabase/phase5_documents.sql`
   - `supabase/phase5_recipes.sql`
6. `supabase/phase6_profiles.sql`
7. `supabase/phase6_activity.sql`
8. `supabase/phase6_tasks_assign.sql`
9. `supabase/phase7_lists.sql`
10. Fas 8, i valfri inbördes ordning:
    - `supabase/phase8_listitems.sql`
    - `supabase/phase8_chat.sql`
    - `supabase/phase8_reactions.sql`
    - `supabase/phase8_notifprefs.sql`
    - `supabase/phase8_recurring.sql`

11. `supabase/phase9_hidden.sql` och `supabase/phase9_wall.sql`
12. `supabase/phase10_inbox.sql`
13. `supabase/phase11_budget_fx.sql`
14. `supabase/phase12_recurring_actor.sql`
15. `supabase/phase13_rugby.sql` – rugby-matcher (Top 14 / Pro D2)

`supabase/notifications.sql` sätter upp databastabellerna för push-notiser och körs när
notisfunktionen aktiveras. Dokumentvalvet kräver dessutom en privat Storage-bucket med
namnet `documents`.

## Edge Functions

Projektet innehåller Supabase Edge Functions:

- `notify` skickar push-notiser.
- `import-recipe` hämtar och tolkar recept från en länk.
- `materialize-recurring` skapar listpunkter från återkommande uppgifter och bör schemaläggas
  att köras regelbundet.
- `sync-rugby` hämtar Top 14- och Pro D2-matcher för följda klubbar från LNR:s
  officiella kalendrar. Ingen API-nyckel krävs.

Deploya dem från projektroten efter att Supabase CLI har länkats till rätt projekt:

```bash
supabase functions deploy notify
supabase functions deploy import-recipe
supabase functions deploy materialize-recurring
supabase functions deploy sync-rugby
```

Konfigurera funktionernas serverhemligheter i Supabase, inte i `.env.local`. Se
[NOTISER.md](./NOTISER.md) för push-konfiguration och kommentarerna i
`supabase/phase8_recurring.sql` för schemaläggning.

## Publicera på Vercel

1. Lägg projektet i ett Git-repository och importera det i Vercel.
2. Låt Vercel använda Vite-inställningarna (`npm run build` och utdata i `dist`).
3. Lägg till `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` och
   `VITE_VAPID_PUBLIC_KEY` under projektets Environment Variables.
4. Deploya och öppna den tilldelade HTTPS-adressen.
5. Lägg till adressen som tillåten URL i Supabase Auth om autentiseringsinställningarna
   kräver det.

Efter publicering kan appen installeras från webbläsarens meny. Mer detaljerad
kom-igång-information finns i [PLANERING.md](./PLANERING.md).
