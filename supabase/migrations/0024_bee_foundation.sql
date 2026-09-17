-- Beekeeping / Apiculture module foundation
-- Hive-centric model: apiaries contain hives, hives have inspections,
-- harvests, treatments and finance records.

/* ── apiaries ──────────────────────────────────────────────────────────── */
create table if not exists bee_apiaries (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  name        text not null,
  location    text,
  notes       text,
  status      text not null default 'active' check (status in ('active','inactive')),
  client_uuid text unique,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists bee_apiaries_space on bee_apiaries(space_id) where deleted_at is null;

/* ── hives ─────────────────────────────────────────────────────────────── */
-- hive_type: langstroth | top_bar | warre | traditional | other
-- current_status: active | queenless | weak | dead | merged | archived
create table if not exists bee_hives (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  apiary_id       uuid references bee_apiaries(id) on delete set null,
  name            text not null,
  hive_type       text not null default 'langstroth'
                    check (hive_type in ('langstroth','top_bar','warre','traditional','other')),
  installation_date date,
  source          text,         -- e.g. "swarm", "nucleus", "package", "split"
  queen_year      int,
  notes           text,
  current_status  text not null default 'active'
                    check (current_status in ('active','queenless','weak','dead','merged','archived')),
  client_uuid     text unique,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists bee_hives_space    on bee_hives(space_id)    where deleted_at is null;
create index if not exists bee_hives_apiary   on bee_hives(apiary_id)   where deleted_at is null;

/* ── inspections ───────────────────────────────────────────────────────── */
-- colony_strength: 1-5 (1=very weak, 5=very strong)
-- queen_status: present | absent | unknown | superseded
create table if not exists bee_inspections (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references farm_spaces(id) on delete cascade,
  hive_id          uuid not null references bee_hives(id) on delete cascade,
  inspection_date  date not null,
  colony_strength  int  check (colony_strength between 1 and 5),
  queen_status     text check (queen_status in ('present','absent','unknown','superseded')),
  honey_frames     numeric(5,1),      -- frames with capped honey
  brood_frames     numeric(5,1),      -- frames with brood
  varroa_level     text check (varroa_level in ('low','moderate','high','not_checked')),
  saw_queen        boolean default false,
  eggs_present     boolean default false,
  disease_signs    text,
  action_taken     text,
  next_inspection  date,
  notes            text,
  client_uuid      text unique,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists bee_inspections_space on bee_inspections(space_id)  where deleted_at is null;
create index if not exists bee_inspections_hive  on bee_inspections(hive_id)   where deleted_at is null;

/* ── harvests ──────────────────────────────────────────────────────────── */
-- product_type: honey | beeswax | propolis | pollen | royal_jelly | other
create table if not exists bee_harvests (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  hive_id         uuid references bee_hives(id) on delete set null,
  harvest_date    date not null,
  product_type    text not null default 'honey'
                    check (product_type in ('honey','beeswax','propolis','pollen','royal_jelly','other')),
  quantity_kg     numeric(8,3) not null check (quantity_kg > 0),
  quality_grade   text,        -- e.g. "A", "B", "mixed"
  notes           text,
  client_uuid     text unique,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists bee_harvests_space on bee_harvests(space_id)   where deleted_at is null;
create index if not exists bee_harvests_hive  on bee_harvests(hive_id)    where deleted_at is null;

/* ── treatments ────────────────────────────────────────────────────────── */
create table if not exists bee_treatments (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references farm_spaces(id) on delete cascade,
  hive_id          uuid references bee_hives(id) on delete set null,
  treatment_date   date not null,
  treatment_type   text not null,  -- "oxalic_acid","formic_acid","amitraz","antibiotic","other"
  product_name     text,
  dose             text,
  target           text,           -- "varroa","nosema","european_foulbrood","other"
  notes            text,
  client_uuid      text unique,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists bee_treatments_space on bee_treatments(space_id)   where deleted_at is null;
create index if not exists bee_treatments_hive  on bee_treatments(hive_id)    where deleted_at is null;

/* ── sales (honey & products) ──────────────────────────────────────────── */
create table if not exists bee_sales (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  sale_date    date not null,
  product_type text not null default 'honey'
                 check (product_type in ('honey','beeswax','propolis','pollen','royal_jelly','other')),
  quantity_kg  numeric(8,3),
  unit_price   numeric(10,2),
  amount       numeric(10,2) not null check (amount > 0),
  buyer        text,
  notes        text,
  client_uuid  text unique,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists bee_sales_space on bee_sales(space_id) where deleted_at is null;

/* ── costs ─────────────────────────────────────────────────────────────── */
-- category: equipment | feed_supplement | treatment | labour | transport | other
create table if not exists bee_costs (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  cost_date   date not null,
  category    text not null
                check (category in ('equipment','feed_supplement','treatment','labour','transport','other')),
  description text not null,
  amount      numeric(10,2) not null check (amount > 0),
  notes       text,
  client_uuid text unique,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists bee_costs_space on bee_costs(space_id) where deleted_at is null;
