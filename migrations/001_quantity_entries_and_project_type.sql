-- =============================================================
-- SiteDoc migration: quantity_entries + project_type
-- Run in Supabase SQL editor. Idempotent where reasonable.
-- =============================================================

-- -------------------------------------------------------------
-- 1. project_type on projects
-- -------------------------------------------------------------
alter table projects
  add column if not exists project_type text
  not null default 'unit_price_bid';

alter table projects
  drop constraint if exists projects_project_type_check;

alter table projects
  add constraint projects_project_type_check
  check (project_type in ('unit_price_bid', 'tm_force_account'));

-- Existing projects default to unit_price_bid (preserves current feature set).
-- Edit individual projects in the UI if any should be tm_force_account.

-- -------------------------------------------------------------
-- 2. quantity_entries — single source of truth for installed
--    contract progress on unit_price_bid projects
-- -------------------------------------------------------------
create table if not exists quantity_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  contract_item_id uuid not null references contract_items(id) on delete cascade,
  report_id uuid references daily_reports(id) on delete restrict,
  entry_date date not null default current_date,
  quantity numeric not null default 0,
  source text not null check (source in ('report', 'quick_entry')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quantity_entries_project_item_idx
  on quantity_entries(project_id, contract_item_id);
create index if not exists quantity_entries_report_idx
  on quantity_entries(report_id);
create index if not exists quantity_entries_entry_date_idx
  on quantity_entries(entry_date);

-- Keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists quantity_entries_set_updated_at on quantity_entries;
create trigger quantity_entries_set_updated_at
  before update on quantity_entries
  for each row execute function set_updated_at();

-- -------------------------------------------------------------
-- 3. Backfill from existing materials rows
--    Only bid-tied installed rows — generic material entries
--    stay in `materials` as before.
-- -------------------------------------------------------------
insert into quantity_entries
  (org_id, project_id, contract_item_id, report_id, entry_date, quantity, source, notes, created_at)
select
  m.org_id,
  m.project_id,
  m.contract_item_id,
  m.report_id,
  coalesce(dr.report_date, m.logged_at::date, current_date) as entry_date,
  coalesce(m.quantity::numeric, 0) as quantity,
  'report' as source,
  m.location_ref as notes,
  coalesce(m.logged_at, now()) as created_at
from materials m
left join daily_reports dr on dr.id = m.report_id
where m.is_delivery = false
  and m.contract_item_id is not null
  and not exists (
    -- Guard against re-running: skip if an entry already exists for this materials row's report+item+quantity
    select 1 from quantity_entries qe
    where qe.report_id is not distinct from m.report_id
      and qe.contract_item_id = m.contract_item_id
      and qe.quantity = coalesce(m.quantity::numeric, 0)
      and qe.source = 'report'
  );

-- -------------------------------------------------------------
-- 4. RLS (mirrors existing tables — adjust if your policy
--    shape differs. Safe to skip if RLS is off in dev.)
-- -------------------------------------------------------------
alter table quantity_entries enable row level security;

drop policy if exists quantity_entries_org_access on quantity_entries;
create policy quantity_entries_org_access on quantity_entries
  for all
  using (
    org_id in (
      select org_id from users where id = auth.uid()
    )
  )
  with check (
    org_id in (
      select org_id from users where id = auth.uid()
    )
  );

-- =============================================================
-- Post-migration notes:
--   * report_id uses ON DELETE RESTRICT. Daily reports with
--     quantity_entries cannot be deleted at the DB level —
--     this is intentional to prevent orphan rows. If you add
--     a report-delete UI, handle entries first (reassign to
--     quick_entry + null report_id, or soft-delete the report).
--   * After deploying app code changes through the daily-log
--     write-path switch, bid-tied quantities write to
--     quantity_entries instead of materials.
--   * The original bid-tied rows in `materials` are NOT deleted.
--     They remain as a historical backstop. Run a separate
--     cleanup only after you've verified totals match.
--   * To verify backfill: totals on any unit_price_bid project
--     should match before/after this migration runs.
-- =============================================================
