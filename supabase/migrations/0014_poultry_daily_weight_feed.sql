-- AgriOS Poultry — P2: daily records, weighings and the batch feed ledger.
--
-- PURELY ADDITIVE, like 0013: three new tables, no ALTER of the P1 tables, no
-- DROP, no data movement. An application build that predates this migration
-- keeps working against a database that has run it, which is what keeps the
-- application rollback independent of the database. Dropping these tables is a
-- staging-only procedure after verification — never the production rollback
-- path, which rolls forward.
--
-- WHAT IS DELIBERATELY NOT STORED HERE:
--
--   opening_birds / closing_birds   Derived from placed_qty minus the recorded
--                                   mortality and culls before the date in
--                                   question. Storing them would let a client
--                                   assert its own bird count, and would drift
--                                   the moment a back-dated correction lands.
--   average_weight_g                Stored, but only ever written by the
--                                   server from total_sample_weight_g /
--                                   sample_count. A client-supplied average is
--                                   ignored — it is the one number a farmer
--                                   could most easily fat-finger into a
--                                   flattering FCR.
--   feed stock                      Derived by aggregating this ledger. A
--                                   stored running total is a second source of
--                                   truth waiting to disagree with its own
--                                   history.
--
-- UNITS: bird weights in GRAMS (a day-old chick is ~40 g, so kg would be all
-- leading zeros on a farmer's phone); feed in KILOGRAMS (how it is bought and
-- delivered). The two only ever meet inside api/_lib/farm/fcr.js, which
-- converts at one named boundary.

-- ── daily records ───────────────────────────────────────────────────────────
-- One row per batch per day: the shed diary. Mortality and culls here are the
-- authoritative source for live-bird counts.
create table if not exists poultry_daily_records (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  batch_id     uuid not null references poultry_batches(id) on delete cascade,

  record_date  date not null,

  -- birds
  mortality    int not null default 0,
  culls        int not null default 0,

  -- feed (kg) — a day's summary. The itemised ledger is poultry_feed_logs.
  feed_consumed_kg numeric(12,3),
  feed_type        text,
  feed_wastage_kg  numeric(12,3),

  -- water / environment
  water_litres   numeric(12,2),
  temp_c         numeric(5,2),
  humidity_pct   numeric(5,2),
  ventilation    text,
  lighting_hours numeric(4,1),

  -- health + operations
  symptoms      text,
  remarks       text,
  labour_count  int,
  cleaning      boolean not null default false,
  disinfection  boolean not null default false,

  -- A correction written against a batch that had already moved past ACTIVE.
  -- Requires farm.poultry.manage and is always audited, so a late edit to a
  -- settled cycle is visible rather than silent.
  is_correction boolean not null default false,

  created_by   uuid references users(id),
  updated_by   uuid references users(id),
  client_uuid  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint poultry_daily_mortality_ck   check (mortality >= 0),
  constraint poultry_daily_culls_ck       check (culls >= 0),
  constraint poultry_daily_feed_ck        check (feed_consumed_kg is null or feed_consumed_kg >= 0),
  constraint poultry_daily_wastage_ck     check (feed_wastage_kg is null or feed_wastage_kg >= 0),
  constraint poultry_daily_water_ck       check (water_litres is null or water_litres >= 0),
  constraint poultry_daily_labour_ck      check (labour_count is null or labour_count >= 0),
  constraint poultry_daily_humidity_ck    check (humidity_pct is null or (humidity_pct >= 0 and humidity_pct <= 100)),
  constraint poultry_daily_light_ck       check (lighting_hours is null or (lighting_hours >= 0 and lighting_hours <= 24))
);
drop trigger if exists trg_poultry_daily_updated on poultry_daily_records;
create trigger trg_poultry_daily_updated before update on poultry_daily_records
  for each row execute function set_updated_at();

-- One batch + one date = one record, enforced by the database rather than by
-- whichever handler happens to remember. A soft-deleted row frees the date.
create unique index if not exists idx_poultry_daily_batch_date
  on poultry_daily_records (batch_id, record_date) where deleted_at is null;
create index if not exists idx_poultry_daily_batch
  on poultry_daily_records (batch_id, record_date desc);
create index if not exists idx_poultry_daily_space
  on poultry_daily_records (space_id, record_date desc);
create unique index if not exists idx_poultry_daily_client_uuid
  on poultry_daily_records (space_id, client_uuid) where client_uuid is not null;

-- ── weighings ───────────────────────────────────────────────────────────────
-- Sample weighing events. Several per day are legitimate (different pens), so
-- there is no unique (batch, date) here — ADG reads the latest per day.
create table if not exists poultry_weights (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  batch_id     uuid not null references poultry_batches(id) on delete cascade,

  weigh_date            date not null,
  sample_count          int not null,
  total_sample_weight_g numeric(12,2) not null,
  -- Server-derived from the two columns above, never from the request body.
  average_weight_g      numeric(10,2) not null,
  weighing_method       text,
  notes                 text,

  created_by   uuid references users(id),
  updated_by   uuid references users(id),
  client_uuid  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  -- A sample of zero birds has no average; the division would be Infinity.
  constraint poultry_weights_sample_ck  check (sample_count > 0),
  constraint poultry_weights_total_ck   check (total_sample_weight_g > 0),
  constraint poultry_weights_avg_ck     check (average_weight_g > 0)
);
drop trigger if exists trg_poultry_weights_updated on poultry_weights;
create trigger trg_poultry_weights_updated before update on poultry_weights
  for each row execute function set_updated_at();

create index if not exists idx_poultry_weights_batch
  on poultry_weights (batch_id, weigh_date desc);
create index if not exists idx_poultry_weights_space
  on poultry_weights (space_id, weigh_date desc);
create unique index if not exists idx_poultry_weights_client_uuid
  on poultry_weights (space_id, client_uuid) where client_uuid is not null;

-- ── feed ledger ─────────────────────────────────────────────────────────────
-- Batch-scoped feed movements. This is NOT the farm-wide inventory: that stays
-- in the device-local inventoryService, which owns its own stock and clamps an
-- overdraw at zero because it was built for a single-user offline app. This
-- ledger is server-side and shared, where a silent clamp could swallow a second
-- worker's entry during a race — so an overdraw is REJECTED here instead.
-- Neither ledger deducts from the other; linking them is a later phase.
--
-- Direction lives in `kind`, never in the sign of the quantity: an
-- adjustment_out of 5 kg, not a quantity of -5. Every quantity is > 0, so a
-- negative can never enter the arithmetic by accident.
create table if not exists poultry_feed_logs (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  batch_id     uuid not null references poultry_batches(id) on delete cascade,

  log_date     date not null,
  kind         text not null,   -- received|consumed|wastage|adjustment_in|adjustment_out
  feed_type    text,
  quantity_kg  numeric(12,3) not null,
  rate_per_kg  numeric(12,2),
  amount       numeric(14,2),
  supplier     text,
  notes        text,

  created_by   uuid references users(id),
  updated_by   uuid references users(id),
  client_uuid  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint poultry_feed_qty_ck  check (quantity_kg > 0),
  constraint poultry_feed_rate_ck check (rate_per_kg is null or rate_per_kg >= 0),
  constraint poultry_feed_kind_ck check (kind in
    ('received','consumed','wastage','adjustment_in','adjustment_out'))
);
drop trigger if exists trg_poultry_feed_updated on poultry_feed_logs;
create trigger trg_poultry_feed_updated before update on poultry_feed_logs
  for each row execute function set_updated_at();

create index if not exists idx_poultry_feed_batch
  on poultry_feed_logs (batch_id, log_date desc);
create index if not exists idx_poultry_feed_space_kind
  on poultry_feed_logs (space_id, kind, log_date desc);
create unique index if not exists idx_poultry_feed_client_uuid
  on poultry_feed_logs (space_id, client_uuid) where client_uuid is not null;
