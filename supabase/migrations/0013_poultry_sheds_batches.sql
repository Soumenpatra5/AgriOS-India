-- AgriOS Poultry — P1: sheds and batches (Broiler Farm Management System).
--
-- PURELY ADDITIVE. This migration creates two new tables and touches nothing
-- that already exists — no ALTER, no DROP, no data movement. An older
-- application version keeps working unchanged against a database that has run
-- it, which is what makes the application rollback independent of the database
-- (see TIER/POULTRY plan §V: dropping these tables is a staging-only
-- procedure, never the production rollback path — production rolls forward).
--
-- SCOPE MODEL. "Farm" is farm_spaces: it already carries the name, location,
-- owner and membership that authorization reads, so a second farm entity would
-- fork the permission model. Every row here therefore carries space_id, and
-- every index leads with it, so a query that forgets to scope is an obvious
-- omission rather than a silent cross-farm leak — the same rule farm_tasks
-- follows.
--
-- Only the two tables P1 needs are created here. The remaining poultry tables
-- (daily records, weights, health, feed, sales, costs) arrive in their own
-- additive migrations as their phases land, so each is reviewed against what
-- the previous phase actually taught us.

-- ── sheds ───────────────────────────────────────────────────────────────────
-- A physical house within a farm. Optional for a batch: a smallholder with one
-- open shed should not be forced to model it before they can place birds.
create table if not exists poultry_sheds (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,

  name         text not null,
  capacity     int,                                   -- birds; null = not stated
  area_sqft    numeric(10,2),
  ventilation_type text,                              -- natural|exhaust|tunnel|other
  notes        text,
  status       text not null default 'active',        -- active|inactive

  created_by   uuid references users(id),
  updated_by   uuid references users(id),
  client_uuid  text,                                  -- offline idempotency key
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint poultry_sheds_capacity_ck check (capacity is null or capacity >= 0),
  constraint poultry_sheds_area_ck     check (area_sqft is null or area_sqft >= 0),
  constraint poultry_sheds_status_ck   check (status in ('active','inactive'))
);
drop trigger if exists trg_poultry_sheds_updated on poultry_sheds;
create trigger trg_poultry_sheds_updated before update on poultry_sheds
  for each row execute function set_updated_at();

create index if not exists idx_poultry_sheds_space
  on poultry_sheds (space_id, status);
-- Two live sheds in one farm may not share a name (case-insensitively); a
-- soft-deleted one frees its name again.
create unique index if not exists idx_poultry_sheds_name_unique
  on poultry_sheds (space_id, lower(name)) where deleted_at is null;
-- Replay of a queued offline create must not produce a second shed.
create unique index if not exists idx_poultry_sheds_client_uuid
  on poultry_sheds (space_id, client_uuid) where client_uuid is not null;

-- ── batches ─────────────────────────────────────────────────────────────────
-- One placement cycle of birds: the unit every daily record, weighing, feed
-- log, health event, sale and cost will hang off in later phases.
--
-- AGE IS NEVER STORED. age_days/age_weeks are derived from placement_date on
-- read. A stored age is wrong the day after it is written, and the legacy
-- local model's hand-typed "age in weeks" is exactly the bug this replaces.
--
-- LIVE BIRDS IS NEVER STORED either — it is placed_qty minus recorded
-- mortality, culls and sales. Persisting it would need every writer to keep it
-- true and would silently drift; the API derives it.
create table if not exists poultry_batches (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  shed_id      uuid references poultry_sheds(id) on delete set null,

  name         text not null,
  batch_code   text,
  poultry_type text not null default 'broiler',       -- broiler|layer|breeder|country
  purpose      text not null default 'meat',          -- meat|eggs|dual
  breed        text,
  strain       text,
  hatchery     text,
  doc_supplier text,

  placement_date          date not null,
  placed_qty              int  not null,
  placement_avg_weight_g  numeric(10,2),

  -- targets; all optional, all farmer-set (never a built-in default)
  target_harvest_age_days int,
  target_weight_g         numeric(10,2),
  target_fcr              numeric(6,3),
  target_mortality_pct    numeric(5,2),
  feed_program            text,

  status       text not null default 'draft',
  -- draft|active|harvesting|partially_sold|completed|closed|archived
  closed_at    timestamptz,
  notes        text,

  -- Set only by the one-time local→server import so a re-run is idempotent and
  -- an imported batch can be traced back to the device record it came from.
  migrated_from_local_id text,

  created_by   uuid references users(id),
  updated_by   uuid references users(id),
  client_uuid  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint poultry_batches_qty_ck        check (placed_qty > 0),
  constraint poultry_batches_pweight_ck    check (placement_avg_weight_g is null or placement_avg_weight_g >= 0),
  constraint poultry_batches_tage_ck       check (target_harvest_age_days is null or target_harvest_age_days > 0),
  constraint poultry_batches_tweight_ck    check (target_weight_g is null or target_weight_g >= 0),
  constraint poultry_batches_tfcr_ck       check (target_fcr is null or target_fcr > 0),
  constraint poultry_batches_tmort_ck      check (target_mortality_pct is null or (target_mortality_pct >= 0 and target_mortality_pct <= 100)),
  constraint poultry_batches_type_ck       check (poultry_type in ('broiler','layer','breeder','country')),
  constraint poultry_batches_purpose_ck    check (purpose in ('meat','eggs','dual')),
  constraint poultry_batches_status_ck     check (status in
    ('draft','active','harvesting','partially_sold','completed','closed','archived'))
);
drop trigger if exists trg_poultry_batches_updated on poultry_batches;
create trigger trg_poultry_batches_updated before update on poultry_batches
  for each row execute function set_updated_at();

create index if not exists idx_poultry_batches_space_status
  on poultry_batches (space_id, status);
create index if not exists idx_poultry_batches_space_placed
  on poultry_batches (space_id, placement_date desc);
create index if not exists idx_poultry_batches_shed
  on poultry_batches (space_id, shed_id);
create unique index if not exists idx_poultry_batches_client_uuid
  on poultry_batches (space_id, client_uuid) where client_uuid is not null;
-- Importing the same device record twice must update, not duplicate.
create unique index if not exists idx_poultry_batches_migrated
  on poultry_batches (space_id, migrated_from_local_id) where migrated_from_local_id is not null;
