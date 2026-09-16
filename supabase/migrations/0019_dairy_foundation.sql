-- AgriOS Dairy — D1: canonical dairy data model.
--
-- PURELY ADDITIVE. No ALTER, no DROP, no data movement. Dairy is a separate
-- species OS that lives alongside Poultry — it does NOT reuse poultry_batches
-- or batch_id as its canonical identity. Every dairy row hangs off
-- dairy_animals (individual animal, not a batch).
--
-- CANONICAL IDENTITY: animal_id (FK to dairy_animals) — not batch_id.
-- A buffalo named Lakshmi is one row in dairy_animals for her entire life;
-- her lactation cycles, milk records, health events and reproductive history
-- all reference her individual animal_id.
--
-- SCOPE MODEL: same as poultry — space_id on every row, every index leads
-- with it, requireScope() in the gate enforces it.

-- ── dairy_animals ────────────────────────────────────────────────────────────
-- The individual animal: the root of the entire dairy data model.
create table if not exists dairy_animals (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references farm_spaces(id) on delete cascade,

  tag_id             text,                          -- ear tag / tattoo
  name               text not null,
  species            text not null,                 -- cow | buffalo
  breed              text,
  dob                date,                          -- date of birth
  acquisition_date   date,
  acquisition_source text,                          -- purchased|born_on_farm|gifted|other
  current_status     text not null default 'heifer',-- heifer|milking|dry|sold|deceased|retired
  notes              text,

  client_uuid        text,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint dairy_animals_species_ck check (species in ('cow','buffalo')),
  constraint dairy_animals_status_ck  check (
    current_status in ('heifer','milking','dry','sold','deceased','retired')
  )
);
drop trigger if exists trg_dairy_animals_updated on dairy_animals;
create trigger trg_dairy_animals_updated before update on dairy_animals
  for each row execute function set_updated_at();

create index if not exists idx_dairy_animals_space
  on dairy_animals (space_id, current_status);
create unique index if not exists idx_dairy_animals_client_uuid
  on dairy_animals (space_id, client_uuid) where client_uuid is not null;

-- ── dairy_lactations ─────────────────────────────────────────────────────────
-- Permanent record of each calving and lactation cycle. NO deleted_at — these
-- are historical milestones, not correctable records. A mis-entered lactation
-- is updated, never soft-deleted.
create table if not exists dairy_lactations (
  id                    uuid primary key default gen_random_uuid(),
  space_id              uuid not null references farm_spaces(id) on delete cascade,
  animal_id             uuid not null references dairy_animals(id) on delete cascade,

  lactation_number      int not null check (lactation_number > 0),
  calving_date          date not null,
  calf_sex              text,                       -- male|female|unknown
  calf_alive            boolean,
  dry_off_date          date,
  expected_next_calving date,
  notes                 text,

  created_by            uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint dairy_lactations_calf_sex_ck check (
    calf_sex is null or calf_sex in ('male','female','unknown')
  )
);
drop trigger if exists trg_dairy_lactations_updated on dairy_lactations;
create trigger trg_dairy_lactations_updated before update on dairy_lactations
  for each row execute function set_updated_at();

create index if not exists idx_dairy_lactations_animal
  on dairy_lactations (animal_id, calving_date desc);
-- Each animal has at most one lactation per number (e.g. 3rd lactation is unique)
create unique index if not exists idx_dairy_lactations_number
  on dairy_lactations (animal_id, lactation_number);

-- ── dairy_milk_records ───────────────────────────────────────────────────────
-- One row per animal per day. total_yield_kg is GENERATED to prevent the
-- AM+PM arithmetic from diverging from the stored total.
create table if not exists dairy_milk_records (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references farm_spaces(id) on delete cascade,
  animal_id     uuid not null references dairy_animals(id) on delete cascade,

  record_date   date not null,
  am_yield_kg   numeric(6,2) not null default 0 check (am_yield_kg >= 0),
  pm_yield_kg   numeric(6,2) not null default 0 check (pm_yield_kg >= 0),
  total_yield_kg numeric(7,2) generated always as (am_yield_kg + pm_yield_kg) stored,
  fat_pct       numeric(4,2),
  snf_pct       numeric(4,2),
  remarks       text,

  client_uuid   text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
drop trigger if exists trg_dairy_milk_records_updated on dairy_milk_records;
create trigger trg_dairy_milk_records_updated before update on dairy_milk_records
  for each row execute function set_updated_at();

create index if not exists idx_dairy_milk_records_animal
  on dairy_milk_records (animal_id, record_date desc);
create index if not exists idx_dairy_milk_records_space_date
  on dairy_milk_records (space_id, record_date desc);
-- One active record per animal per day; soft-deleted records free the slot.
create unique index if not exists idx_dairy_milk_records_unique
  on dairy_milk_records (animal_id, record_date) where deleted_at is null;
create unique index if not exists idx_dairy_milk_records_client_uuid
  on dairy_milk_records (space_id, client_uuid) where client_uuid is not null;

-- ── dairy_reproductive_events ────────────────────────────────────────────────
create table if not exists dairy_reproductive_events (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references farm_spaces(id) on delete cascade,
  animal_id          uuid not null references dairy_animals(id) on delete cascade,

  event_date         date not null,
  event_type         text not null,
  bull_name          text,
  semen_lot          text,
  pregnancy_result   text,
  calf_count         int,
  calf_sex           text,
  calf_alive         boolean,
  notes              text,

  client_uuid        text,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint dairy_repro_type_ck check (
    event_type in ('heat_observed','natural_service','ai_done','pregnancy_check',
                   'dry_off','calving','abortion','other')
  ),
  constraint dairy_repro_result_ck check (
    pregnancy_result is null or
    pregnancy_result in ('positive','negative','inconclusive')
  )
);
drop trigger if exists trg_dairy_repro_updated on dairy_reproductive_events;
create trigger trg_dairy_repro_updated before update on dairy_reproductive_events
  for each row execute function set_updated_at();

create index if not exists idx_dairy_repro_animal
  on dairy_reproductive_events (animal_id, event_date desc);
create unique index if not exists idx_dairy_repro_client_uuid
  on dairy_reproductive_events (space_id, client_uuid) where client_uuid is not null;

-- ── dairy_health_events ──────────────────────────────────────────────────────
create table if not exists dairy_health_events (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references farm_spaces(id) on delete cascade,
  animal_id           uuid not null references dairy_animals(id) on delete cascade,

  event_date          date not null,
  event_type          text not null,
  title               text not null,
  medicine            text,
  dose                text,
  vet_name            text,
  next_due_date       date,
  is_zoonotic_concern boolean not null default false,
  notes               text,

  client_uuid         text,
  created_by          uuid references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint dairy_health_type_ck check (
    event_type in ('observation','vaccination','treatment','deworming','vet_visit','other')
  )
);
drop trigger if exists trg_dairy_health_updated on dairy_health_events;
create trigger trg_dairy_health_updated before update on dairy_health_events
  for each row execute function set_updated_at();

create index if not exists idx_dairy_health_animal
  on dairy_health_events (animal_id, event_date desc);
create index if not exists idx_dairy_health_due
  on dairy_health_events (space_id, next_due_date)
  where next_due_date is not null and deleted_at is null;
create unique index if not exists idx_dairy_health_client_uuid
  on dairy_health_events (space_id, client_uuid) where client_uuid is not null;

-- ── dairy_milk_sales ─────────────────────────────────────────────────────────
-- Farm-level sales: cooperative or bulk buyer purchases. NO animal_id — milk
-- is sold from the farm as a whole, not per-animal. amount is GENERATED to
-- prevent quantity×price from diverging.
create table if not exists dairy_milk_sales (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references farm_spaces(id) on delete cascade,

  sale_date      date not null,
  buyer          text,
  sale_type      text not null default 'combined',   -- morning|evening|combined
  quantity_kg    numeric(8,2) not null check (quantity_kg > 0),
  price_per_litre numeric(6,2) not null default 0 check (price_per_litre >= 0),
  amount         numeric(12,2) generated always as (quantity_kg * price_per_litre) stored,
  fat_pct        numeric(4,2),
  snf_pct        numeric(4,2),
  notes          text,

  client_uuid    text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint dairy_milk_sales_type_ck check (
    sale_type in ('morning','evening','combined')
  )
);
drop trigger if exists trg_dairy_milk_sales_updated on dairy_milk_sales;
create trigger trg_dairy_milk_sales_updated before update on dairy_milk_sales
  for each row execute function set_updated_at();

create index if not exists idx_dairy_milk_sales_space_date
  on dairy_milk_sales (space_id, sale_date desc);
create unique index if not exists idx_dairy_milk_sales_client_uuid
  on dairy_milk_sales (space_id, client_uuid) where client_uuid is not null;

-- ── dairy_costs ──────────────────────────────────────────────────────────────
-- Operating costs: feed (concentrate + roughage), medicine, labour, AI, etc.
-- Feed is tracked here as cost entries — dairy does not have a feed-movement
-- log (unlike poultry which tracks per-batch feed consumption separately).
create table if not exists dairy_costs (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,

  cost_date   date not null,
  category    text not null,
  description text not null,
  quantity    numeric(10,3),
  unit        text,
  unit_cost   numeric(8,2),
  amount      numeric(10,2) not null check (amount > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint dairy_costs_category_ck check (
    category in (
      'concentrate_feed','roughage','medicine','labour',
      'ai_cost','equipment','veterinary','other'
    )
  )
);
drop trigger if exists trg_dairy_costs_updated on dairy_costs;
create trigger trg_dairy_costs_updated before update on dairy_costs
  for each row execute function set_updated_at();

create index if not exists idx_dairy_costs_space_date
  on dairy_costs (space_id, cost_date desc);
create unique index if not exists idx_dairy_costs_client_uuid
  on dairy_costs (space_id, client_uuid) where client_uuid is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Row Level Security mirrors the poultry pattern: enabled on every table.
-- Application-layer enforcement (gate.js) is the primary guard; RLS is a
-- defence-in-depth backstop that catches any query that skips the gate.
alter table dairy_animals             enable row level security;
alter table dairy_lactations          enable row level security;
alter table dairy_milk_records        enable row level security;
alter table dairy_reproductive_events enable row level security;
alter table dairy_health_events       enable row level security;
alter table dairy_milk_sales          enable row level security;
alter table dairy_costs               enable row level security;
