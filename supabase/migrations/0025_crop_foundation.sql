-- Crop / Field module foundation
-- Field-centric model: each farm_field is a plot of land with a crop cycle.
-- Activities (irrigation, spray, weeding) hang off field_id.
-- Finance (costs/sales) is space-scoped matching other livestock modules.
--
-- Field statuses:
--   fallow      — between crops / resting (default on creation)
--   sowing      — land prep + seed sown, crop not yet established
--   growing     — crop established and growing
--   ready       — crop ready to harvest
--   harvesting  — active harvest in progress
--   inactive    — field decommissioned (terminal, blocks writes)
--
-- Indian context: covers kharif (rice, maize, cotton, soybean) and rabi
-- (wheat, mustard, chickpea, potato) seasons. Area in bigha/acres/hectare.

/* ── farm_fields ─────────────────────────────────────────────────────────── */
create table if not exists farm_fields (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,

  name            text not null,
  area            numeric(10,3),
  area_unit       text not null default 'acres'
                    check (area_unit in ('acres','bigha','hectare','guntha')),
  crop_type       text not null default 'other'
                    check (crop_type in (
                      'rice','wheat','maize','cotton','sugarcane','mustard',
                      'soybean','chickpea','potato','onion','tomato',
                      'vegetables','pulses','oilseeds','fruit','other'
                    )),
  current_crop    text,
  season          text check (season in ('kharif','rabi','zaid','perennial')),
  soil_type       text check (soil_type in ('clay','loam','sandy','silt','black','red','other')),
  irrigation_type text check (irrigation_type in ('rainfed','canal','borewell','drip','sprinkler','other')),
  current_status  text not null default 'fallow'
                    check (current_status in ('fallow','sowing','growing','ready','harvesting','inactive')),
  notes           text,

  client_uuid     text unique,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists farm_fields_space on farm_fields(space_id) where deleted_at is null;

/* ── field_sowing ────────────────────────────────────────────────────────── */
-- Records what was sown: seed variety, quantity, method, expected harvest.
create table if not exists field_sowing (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  field_id        uuid not null references farm_fields(id) on delete cascade,

  sowing_date     date not null,
  crop            text not null,
  variety         text,
  seed_kg         numeric(8,2),
  method          text check (method in ('broadcast','line','transplant','drill','other')),
  expected_harvest_date date,
  notes           text,

  client_uuid     text unique,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists field_sowing_field on field_sowing(field_id) where deleted_at is null;

/* ── field_activities ────────────────────────────────────────────────────── */
-- Irrigation, spraying (pesticide/fertilizer), weeding, land prep, etc.
create table if not exists field_activities (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  field_id        uuid not null references farm_fields(id) on delete cascade,

  activity_date   date not null,
  activity_type   text not null default 'other'
                    check (activity_type in (
                      'irrigation','spray_pesticide','spray_fertilizer',
                      'weeding','land_prep','thinning','other'
                    )),
  description     text,
  quantity        numeric(10,3),
  unit            text,
  cost            numeric(10,2),
  notes           text,

  client_uuid     text unique,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists field_activities_field on field_activities(field_id) where deleted_at is null;

/* ── field_harvests ──────────────────────────────────────────────────────── */
create table if not exists field_harvests (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  field_id        uuid not null references farm_fields(id) on delete cascade,

  harvest_date    date not null,
  crop            text not null,
  quantity        numeric(10,3) not null check (quantity > 0),
  unit            text not null default 'kg',
  quality_grade   text,
  notes           text,

  client_uuid     text unique,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists field_harvests_field on field_harvests(field_id) where deleted_at is null;

/* ── field_costs ─────────────────────────────────────────────────────────── */
create table if not exists field_costs (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  field_id    uuid references farm_fields(id) on delete set null,

  cost_date   date not null,
  category    text not null default 'other'
                check (category in (
                  'seeds','fertilizer','pesticide','irrigation',
                  'labour','equipment','transport','other'
                )),
  description text not null,
  amount      numeric(10,2) not null check (amount > 0),
  notes       text,

  client_uuid text unique,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists field_costs_space on field_costs(space_id) where deleted_at is null;

/* ── field_sales ─────────────────────────────────────────────────────────── */
create table if not exists field_sales (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  field_id    uuid references farm_fields(id) on delete set null,

  sale_date   date not null,
  crop        text not null,
  quantity    numeric(10,3),
  unit        text,
  unit_price  numeric(10,2),
  amount      numeric(10,2) not null check (amount > 0),
  buyer       text,
  notes       text,

  client_uuid text unique,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists field_sales_space on field_sales(space_id) where deleted_at is null;
