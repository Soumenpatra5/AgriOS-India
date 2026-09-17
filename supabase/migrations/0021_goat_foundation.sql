-- AgriOS Goat — G1: canonical goat / small-ruminant data model.
--
-- Goats and sheep share this module (species column distinguishes them).
-- Unlike dairy, goats are tracked with weight milestones from birth, and
-- sales cover not just milk but also live animals and fiber (wool/mohair).
-- There is no separate lactation table — kidding is a reproductive event.
--
-- CANONICAL IDENTITY: animal_id (FK to goat_animals).
-- SCOPE MODEL: space_id on every row, every index leads with it.

-- ── goat_animals ─────────────────────────────────────────────────────────────
create table if not exists goat_animals (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references farm_spaces(id) on delete cascade,

  tag_id             text,
  name               text not null,
  species            text not null default 'goat',   -- goat | sheep
  sex                text not null default 'unknown', -- male | female | unknown
  breed              text,
  dob                date,
  acquisition_date   date,
  acquisition_source text,
  current_status     text not null default 'kid',
  notes              text,

  client_uuid        text,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint goat_animals_species_ck check (species in ('goat','sheep')),
  constraint goat_animals_sex_ck     check (sex in ('male','female','unknown')),
  constraint goat_animals_status_ck  check (
    current_status in ('kid','grower','milking','dry','breeding','sold','deceased','retired')
  )
);
drop trigger if exists trg_goat_animals_updated on goat_animals;
create trigger trg_goat_animals_updated before update on goat_animals
  for each row execute function set_updated_at();

create index if not exists idx_goat_animals_space
  on goat_animals (space_id, current_status);
create unique index if not exists idx_goat_animals_client_uuid
  on goat_animals (space_id, client_uuid) where client_uuid is not null;

-- ── goat_weight_records ──────────────────────────────────────────────────────
-- Weight milestones from birth to market. One record per weigh-in event.
create table if not exists goat_weight_records (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  animal_id   uuid not null references goat_animals(id) on delete cascade,

  weigh_date  date not null,
  weight_kg   numeric(7,2) not null check (weight_kg > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
drop trigger if exists trg_goat_weight_updated on goat_weight_records;
create trigger trg_goat_weight_updated before update on goat_weight_records
  for each row execute function set_updated_at();

create index if not exists idx_goat_weight_animal
  on goat_weight_records (animal_id, weigh_date desc);
create unique index if not exists idx_goat_weight_client_uuid
  on goat_weight_records (space_id, client_uuid) where client_uuid is not null;

-- ── goat_milk_records ────────────────────────────────────────────────────────
-- One row per animal per day. total_yield_kg is GENERATED.
-- Avoid ON CONFLICT DO UPDATE — see dairy notes about GENERATED columns.
create table if not exists goat_milk_records (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references farm_spaces(id) on delete cascade,
  animal_id      uuid not null references goat_animals(id) on delete cascade,

  record_date    date not null,
  am_yield_kg    numeric(6,2) not null default 0 check (am_yield_kg >= 0),
  pm_yield_kg    numeric(6,2) not null default 0 check (pm_yield_kg >= 0),
  total_yield_kg numeric(7,2) generated always as (am_yield_kg + pm_yield_kg) stored,
  fat_pct        numeric(4,2),
  remarks        text,

  client_uuid    text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
drop trigger if exists trg_goat_milk_updated on goat_milk_records;
create trigger trg_goat_milk_updated before update on goat_milk_records
  for each row execute function set_updated_at();

create index if not exists idx_goat_milk_animal
  on goat_milk_records (animal_id, record_date desc);
create index if not exists idx_goat_milk_space_date
  on goat_milk_records (space_id, record_date desc);
create unique index if not exists idx_goat_milk_unique
  on goat_milk_records (animal_id, record_date) where deleted_at is null;
create unique index if not exists idx_goat_milk_client_uuid
  on goat_milk_records (space_id, client_uuid) where client_uuid is not null;

-- ── goat_reproductive_events ─────────────────────────────────────────────────
create table if not exists goat_reproductive_events (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references farm_spaces(id) on delete cascade,
  animal_id         uuid not null references goat_animals(id) on delete cascade,

  event_date        date not null,
  event_type        text not null,
  buck_name         text,
  pregnancy_result  text,
  kid_count         int,
  kid_sex           text,
  kid_alive         boolean,
  notes             text,

  client_uuid       text,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint goat_repro_type_ck check (
    event_type in ('heat_observed','mating','pregnancy_check','kidding',
                   'abortion','weaning','other')
  ),
  constraint goat_repro_result_ck check (
    pregnancy_result is null or
    pregnancy_result in ('positive','negative','inconclusive')
  )
);
drop trigger if exists trg_goat_repro_updated on goat_reproductive_events;
create trigger trg_goat_repro_updated before update on goat_reproductive_events
  for each row execute function set_updated_at();

create index if not exists idx_goat_repro_animal
  on goat_reproductive_events (animal_id, event_date desc);
create unique index if not exists idx_goat_repro_client_uuid
  on goat_reproductive_events (space_id, client_uuid) where client_uuid is not null;

-- ── goat_health_events ───────────────────────────────────────────────────────
create table if not exists goat_health_events (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references farm_spaces(id) on delete cascade,
  animal_id           uuid not null references goat_animals(id) on delete cascade,

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

  constraint goat_health_type_ck check (
    event_type in ('observation','vaccination','treatment','deworming','vet_visit','other')
  )
);
drop trigger if exists trg_goat_health_updated on goat_health_events;
create trigger trg_goat_health_updated before update on goat_health_events
  for each row execute function set_updated_at();

create index if not exists idx_goat_health_animal
  on goat_health_events (animal_id, event_date desc);
create index if not exists idx_goat_health_due
  on goat_health_events (space_id, next_due_date)
  where next_due_date is not null and deleted_at is null;
create unique index if not exists idx_goat_health_client_uuid
  on goat_health_events (space_id, client_uuid) where client_uuid is not null;

-- ── goat_feed_records ────────────────────────────────────────────────────────
create table if not exists goat_feed_records (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  animal_id   uuid not null references goat_animals(id) on delete cascade,

  feed_date   date not null,
  feed_type   text not null,
  quantity_kg numeric(8,2),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint goat_feed_type_ck check (
    feed_type in ('concentrate','fodder','silage','mineral','browse','other')
  )
);
drop trigger if exists trg_goat_feed_updated on goat_feed_records;
create trigger trg_goat_feed_updated before update on goat_feed_records
  for each row execute function set_updated_at();

create index if not exists idx_goat_feed_animal
  on goat_feed_records (animal_id, feed_date desc);
create unique index if not exists idx_goat_feed_client_uuid
  on goat_feed_records (space_id, client_uuid) where client_uuid is not null;

-- ── goat_sales ───────────────────────────────────────────────────────────────
-- Covers milk sold, live animals sold, and fiber (wool/mohair/cashmere).
create table if not exists goat_sales (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,

  sale_date   date not null,
  sale_type   text not null,             -- milk | animal | fiber | other
  buyer       text,
  quantity    numeric(10,3),
  unit        text,                      -- kg, head, litre
  unit_price  numeric(8,2),
  amount      numeric(12,2) not null check (amount > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint goat_sales_type_ck check (
    sale_type in ('milk','animal','fiber','other')
  )
);
drop trigger if exists trg_goat_sales_updated on goat_sales;
create trigger trg_goat_sales_updated before update on goat_sales
  for each row execute function set_updated_at();

create index if not exists idx_goat_sales_space_date
  on goat_sales (space_id, sale_date desc);
create unique index if not exists idx_goat_sales_client_uuid
  on goat_sales (space_id, client_uuid) where client_uuid is not null;

-- ── goat_costs ───────────────────────────────────────────────────────────────
create table if not exists goat_costs (
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

  constraint goat_costs_category_ck check (
    category in (
      'concentrate_feed','fodder','medicine','labour',
      'veterinary','equipment','fiber_shearing','other'
    )
  )
);
drop trigger if exists trg_goat_costs_updated on goat_costs;
create trigger trg_goat_costs_updated before update on goat_costs
  for each row execute function set_updated_at();

create index if not exists idx_goat_costs_space_date
  on goat_costs (space_id, cost_date desc);
create unique index if not exists idx_goat_costs_client_uuid
  on goat_costs (space_id, client_uuid) where client_uuid is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table goat_animals             enable row level security;
alter table goat_weight_records      enable row level security;
alter table goat_milk_records        enable row level security;
alter table goat_reproductive_events enable row level security;
alter table goat_health_events       enable row level security;
alter table goat_feed_records        enable row level security;
alter table goat_sales               enable row level security;
alter table goat_costs               enable row level security;
