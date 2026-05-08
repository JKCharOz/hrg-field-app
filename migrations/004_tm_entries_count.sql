-- =============================================================
-- SiteDoc migration: add count + per_unit to tm_entries
-- Lets each daily entry capture e.g. "3 drivers × 8 hrs each = 24"
-- without losing the breakdown. quantity stays as the total.
-- Existing rows default to count=1, per_unit=null, so the display
-- still shows them as a single quantity.
-- Idempotent. Run in Supabase SQL editor.
-- =============================================================

alter table tm_entries
  add column if not exists count numeric not null default 1;

alter table tm_entries
  add column if not exists per_unit numeric;
