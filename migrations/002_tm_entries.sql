-- =============================================================
-- SiteDoc migration: tm_entries
-- Daily T&M (time & materials) tracking for tm_force_account
-- projects. Single flat table, rolls up to weekly / overall via
-- GROUP BY entry_date and category.
-- Run in Supabase SQL editor. Idempotent.
-- =============================================================

create table if not exists tm_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  entry_date date not null default current_date,
  category text not null check (category in ('labor', 'equipment', 'material')),
  description text not null,
  quantity numeric not null default 0,
  unit text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tm_entries_project_date_idx
  on tm_entries(project_id, entry_date desc);
create index if not exists tm_entries_project_category_idx
  on tm_entries(project_id, category);

drop trigger if exists tm_entries_set_updated_at on tm_entries;
create trigger tm_entries_set_updated_at
  before update on tm_entries
  for each row execute function set_updated_at();

alter table tm_entries enable row level security;

drop policy if exists tm_entries_org_access on tm_entries;
create policy tm_entries_org_access on tm_entries
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
