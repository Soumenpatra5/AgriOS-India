-- AgriOS Pig — P1: canonical swine / pig data model.
--
-- Pigs are tracked individually from birth to market or retirement.
-- No commercial milk records — reproductive output (litter data) is captured
-- on farrowing events instead. Weight records are the primary production KPI.
--
-- Sex values cover the full swine vocabulary:
--   boar  — intact male (breeding)
--   sow   — mature female (has farrowed)
--   gilt  — young unbred female
--   barrow — castrated male
--   unknown
--
-- Statuses: piglet → grower → finisher (market weight) → breeder
-- Terminal: sold | deceased | retired

-- ── pig_animals ──────────────────────────────────────────────────────────────
create table if not exists pig_animals (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references farm_spaces(id) on delete cascade,

  tag_id             text,
  name               text not null,
  breed              text,
  sex                text not null default 'unknown',
  dob                date,
  acquisition_date   date,
  acquisition_source text,
  current_status     text not null default 'piglet',
  notes              text,

  client_uuid        text,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint pig_animals_sex_ck check (
    sex in ('boar','sow','gilt','barrow','unknown')
  ),
  constraint pig_animals_status_ck check (
    current_status in ('piglet','grower','finisher','breeder','sold','deceased','retired')
  )
);
drop trigger if exists trg_pig_animals_updated on pig_animals;
create trigger trg_pig_animals_updated before update on pig_animals
  for each row execute function set_updated_at();

create index if not exists idx_pig_animals_space
  on pig_animals (space_id, current_status);
create unique index if not exists idx_pig_animals_client_uuid
  on pig_animals (space_id, client_uuid) where client_uuid is not null;

-- ── pig_weight_records ───────────────────────────────────────────────────────
-- Weight is the primary production KPI for market pigs.
create table if not exists pig_weight_records (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  animal_id   uuid not null references pig_animals(id) on delete cascade,

  weigh_date  date not null,
  weight_kg   numeric(7,2) not null check (weight_kg > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
drop trigger if exists trg_pig_weight_updated on pig_weight_records;
create trigger trg_pig_weight_updated before update on pig_weight_records
  for each row execute function set_updated_at();

create index if not exists idx_pig_weight_animal
  on pig_weight_records (animal_id, weigh_date desc);
create unique index if not exists idx_pig_weight_client_uuid
  on pig_weight_records (space_id, client_uuid) where client_uuid is not null;

-- ── pig_reproductive_events ──────────────────────────────────────────────────
-- Farrowing events carry litter statistics. Other events track the breeding
-- cycle (heat, mating, pregnancy check, weaning, abortion).
create table if not exists pig_reproductive_events (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references farm_spaces(id) on delete cascade,
  animal_id         uuid not null references pig_animals(id) on delete cascade,

  event_date        date not null,
  event_type        text not null,
  boar_name         text,
  pregnancy_result  text,
  -- Farrowing litter detail
  litter_size       int,
  live_born         int,
  still_born        int,
  weaned_count      int,
  notes             text,

  client_uuid       text,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint pig_repro_type_ck check (
    event_type in ('heat_observed','mating','pregnancy_check','farrowing',
                   'weaning','abortion','other')
  ),
  constraint pig_repro_result_ck check (
    pregnancy_result is null or
    pregnancy_result in ('positive','negative','inconclusive')
  )
);
drop trigger if exists trg_pig_repro_updated on pig_reproductive_events;
create trigger trg_pig_repro_updated before update on pig_reproductive_events
  for each row execute function set_updated_at();

create index if not exists idx_pig_repro_animal
  on pig_reproductive_events (animal_id, event_date desc);
create unique index if not exists idx_pig_repro_client_uuid
  on pig_reproductive_events (space_id, client_uuid) where client_uuid is not null;

-- ── pig_health_events ────────────────────────────────────────────────────────
create table if not exists pig_health_events (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references farm_spaces(id) on delete cascade,
  animal_id           uuid not null references pig_animals(id) on delete cascade,

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

  constraint pig_health_type_ck check (
    event_type in ('observation','vaccination','treatment','deworming','vet_visit','other')
  )
);
drop trigger if exists trg_pig_health_updated on pig_health_events;
create trigger trg_pig_health_updated before update on pig_health_events
  for each row execute function set_updated_at();

create index if not exists idx_pig_health_animal
  on pig_health_events (animal_id, event_date desc);
create index if not exists idx_pig_health_due
  on pig_health_events (space_id, next_due_date)
  where next_due_date is not null and deleted_at is null;
create unique index if not exists idx_pig_health_client_uuid
  on pig_health_events (space_id, client_uuid) where client_uuid is not null;

-- ── pig_feed_records ─────────────────────────────────────────────────────────
create table if not exists pig_feed_records (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  animal_id   uuid not null references pig_animals(id) on delete cascade,

  feed_date   date not null,
  feed_type   text not null,
  quantity_kg numeric(8,2),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint pig_feed_type_ck check (
    feed_type in ('starter','grower_feed','finisher_feed','sow_feed','concentrate','other')
  )
);
drop trigger if exists trg_pig_feed_updated on pig_feed_records;
create trigger trg_pig_feed_updated before update on pig_feed_records
  for each row execute function set_updated_at();

create index if not exists idx_pig_feed_animal
  on pig_feed_records (animal_id, feed_date desc);
create unique index if not exists idx_pig_feed_client_uuid
  on pig_feed_records (space_id, client_uuid) where client_uuid is not null;

-- ── pig_sales ────────────────────────────────────────────────────────────────
create table if not exists pig_sales (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,

  sale_date   date not null,
  sale_type   text not null,             -- live_animal | pork | piglet | other
  buyer       text,
  quantity    numeric(10,3),
  unit        text,                      -- kg, head
  unit_price  numeric(8,2),
  amount      numeric(12,2) not null check (amount > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint pig_sales_type_ck check (
    sale_type in ('live_animal','pork','piglet','other')
  )
);
drop trigger if exists trg_pig_sales_updated on pig_sales;
create trigger trg_pig_sales_updated before update on pig_sales
  for each row execute function set_updated_at();

create index if not exists idx_pig_sales_space_date
  on pig_sales (space_id, sale_date desc);
create unique index if not exists idx_pig_sales_client_uuid
  on pig_sales (space_id, client_uuid) where client_uuid is not null;

-- ── pig_costs ────────────────────────────────────────────────────────────────
create table if not exists pig_costs (
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

  constraint pig_costs_category_ck check (
    category in (
      'feed','medicine','labour','veterinary','equipment','housing','other'
    )
  )
);
drop trigger if exists trg_pig_costs_updated on pig_costs;
create trigger trg_pig_costs_updated before update on pig_costs
  for each row execute function set_updated_at();

create index if not exists idx_pig_costs_space_date
  on pig_costs (space_id, cost_date desc);
create unique index if not exists idx_pig_costs_client_uuid
  on pig_costs (space_id, client_uuid) where client_uuid is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table pig_animals             enable row level security;
alter table pig_weight_records      enable row level security;
alter table pig_reproductive_events enable row level security;
alter table pig_health_events       enable row level security;
alter table pig_feed_records        enable row level security;
alter table pig_sales               enable row level security;
alter table pig_costs               enable row level security;
