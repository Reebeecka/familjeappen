-- ============================================================
-- Familjeappen – växelkurs per budgetpost (Fas 11)
-- Sparar dagens EUR/SEK-kurs på varje post så historiken ligger fast.
-- Kör efter phase5_budget.sql. Får köras om.
-- ============================================================

alter table public.budget_entries
  add column if not exists eur_sek_rate numeric(10, 4);
