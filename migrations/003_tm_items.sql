-- =============================================================
-- SiteDoc migration: tm_items
-- Per-project catalog of T&M items (description + unit) so that
-- daily logging is one tap + a quantity, not retyping every time.
-- Run in Supabase SQL editor. Idempotent.
-- =============================================================

create table if not exists tm_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  category text not null check (category in ('labor', 'equipment', 'material')),
  description text not null,
  unit text,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tm_items_project_category_idx
  on tm_items(project_id, category, archived, sort_order);

drop trigger if exists tm_items_set_updated_at on tm_items;
create trigger tm_items_set_updated_at
  before update on tm_items
  for each row execute function set_updated_at();

alter table tm_items enable row level security;

drop policy if exists tm_items_org_access on tm_items;
create policy tm_items_org_access on tm_items
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

-- Optional link from tm_entries to tm_items (kept nullable so old rows survive)
alter table tm_entries
  add column if not exists item_id uuid references tm_items(id) on delete set null;

create index if not exists tm_entries_item_idx on tm_entries(item_id);
