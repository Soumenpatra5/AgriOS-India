-- AgriOS Fish / Aquaculture — P1: pond-centric aquaculture data model.
--
-- Unlike individual-animal modules (pig, goat, dairy), fish farming is
-- pond-centric: each pond holds a batch of fish from stocking to harvest.
-- Individual tracking is impractical at farm scale; the pond is the unit.
--
-- Pond statuses:
--   active    — pond is running (default)
--   harvested — full harvest completed (terminal — writes blocked)
--   inactive  — pond decommissioned (terminal — writes blocked)
--
-- Indian context: supports composite fish culture (Rohu+Catla+Mrigal+carp),
-- cage culture in reservoirs, and prawn/shrimp alongside finfish.
-- Water quality monitoring is the key management signal in aquaculture.

-- ── fish_ponds ────────────────────────────────────────────────────────────────
create table if not exists fish_ponds (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references farm_spaces(id) on delete cascade,

  name               text not null,
  pond_type          text not null default 'earthen',
  culture_type       text not null default 'polyculture',
  species            text,                            -- primary species description
  area_sqm           numeric(10,2),
  depth_m            numeric(5,2),

  stocking_date      date,
  stocking_count     int,
  stocking_size_cm   numeric(5,1),                   -- fingerling size at stocking

  current_status     text not null default 'active',
  notes              text,

  client_uuid        text,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint fish_ponds_type_ck check (
    pond_type in ('earthen','cement','tank','cage','other')
  ),
  constraint fish_ponds_culture_ck check (
    culture_type in ('monoculture','polyculture','composite')
  ),
  constraint fish_ponds_status_ck check (
    current_status in ('active','harvested','inactive')
  )
);
drop trigger if exists trg_fish_ponds_updated on fish_ponds;
create trigger trg_fish_ponds_updated before update on fish_ponds
  for each row execute function set_updated_at();

create index if not exists idx_fish_ponds_space
  on fish_ponds (space_id, current_status);
create unique index if not exists idx_fish_ponds_client_uuid
  on fish_ponds (space_id, client_uuid) where client_uuid is not null;

-- ── fish_water_quality ────────────────────────────────────────────────────────
-- Water quality monitoring is the most critical management signal in
-- aquaculture. Key parameters: pH (7–8.5 optimal), DO (≥5 ppm), temperature,
-- ammonia (NH3 toxic above 0.05 ppm).
create table if not exists fish_water_quality (
  id                   uuid primary key default gen_random_uuid(),
  space_id             uuid not null references farm_spaces(id) on delete cascade,
  pond_id              uuid not null references fish_ponds(id) on delete cascade,

  event_date           date not null,
  ph                   numeric(4,2),
  dissolved_oxygen_ppm numeric(5,2),
  temperature_c        numeric(5,2),
  ammonia_ppm          numeric(6,3),
  notes                text,

  client_uuid          text,
  created_by           uuid references users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
drop trigger if exists trg_fish_water_updated on fish_water_quality;
create trigger trg_fish_water_updated before update on fish_water_quality
  for each row execute function set_updated_at();

create index if not exists idx_fish_water_pond
  on fish_water_quality (pond_id, event_date desc);
create unique index if not exists idx_fish_water_client_uuid
  on fish_water_quality (space_id, client_uuid) where client_uuid is not null;

-- ── fish_feed_records ─────────────────────────────────────────────────────────
create table if not exists fish_feed_records (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references farm_spaces(id) on delete cascade,
  pond_id       uuid not null references fish_ponds(id) on delete cascade,

  feed_date     date not null,
  feed_type     text not null,
  quantity_kg   numeric(8,2),
  notes         text,

  client_uuid   text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint fish_feed_type_ck check (
    feed_type in (
      'pellet','rice_bran','mustard_cake','groundnut_cake',
      'soybean_meal','kitchen_waste','other'
    )
  )
);
drop trigger if exists trg_fish_feed_updated on fish_feed_records;
create trigger trg_fish_feed_updated before update on fish_feed_records
  for each row execute function set_updated_at();

create index if not exists idx_fish_feed_pond
  on fish_feed_records (pond_id, feed_date desc);
create unique index if not exists idx_fish_feed_client_uuid
  on fish_feed_records (space_id, client_uuid) where client_uuid is not null;

-- ── fish_health_events ────────────────────────────────────────────────────────
create table if not exists fish_health_events (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references farm_spaces(id) on delete cascade,
  pond_id       uuid not null references fish_ponds(id) on delete cascade,

  event_date    date not null,
  event_type    text not null,
  title         text not null,
  medicine      text,
  dose          text,
  notes         text,

  client_uuid   text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint fish_health_type_ck check (
    event_type in ('observation','disease','treatment','water_treatment','other')
  )
);
drop trigger if exists trg_fish_health_updated on fish_health_events;
create trigger trg_fish_health_updated before update on fish_health_events
  for each row execute function set_updated_at();

create index if not exists idx_fish_health_pond
  on fish_health_events (pond_id, event_date desc);
create unique index if not exists idx_fish_health_client_uuid
  on fish_health_events (space_id, client_uuid) where client_uuid is not null;

-- ── fish_mortality_records ────────────────────────────────────────────────────
create table if not exists fish_mortality_records (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  pond_id     uuid not null references fish_ponds(id) on delete cascade,

  event_date  date not null,
  count       int  not null check (count > 0),
  reason      text,
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint fish_mortality_reason_ck check (
    reason is null or
    reason in ('disease','oxygen_depletion','predation','stress','unknown','other')
  )
);
drop trigger if exists trg_fish_mortality_updated on fish_mortality_records;
create trigger trg_fish_mortality_updated before update on fish_mortality_records
  for each row execute function set_updated_at();

create index if not exists idx_fish_mortality_pond
  on fish_mortality_records (pond_id, event_date desc);
create unique index if not exists idx_fish_mortality_client_uuid
  on fish_mortality_records (space_id, client_uuid) where client_uuid is not null;

-- ── fish_harvest_records ──────────────────────────────────────────────────────
create table if not exists fish_harvest_records (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references farm_spaces(id) on delete cascade,
  pond_id        uuid not null references fish_ponds(id) on delete cascade,

  harvest_date   date not null,
  harvest_type   text not null,             -- partial | full
  weight_kg      numeric(10,2),
  count          int,
  avg_weight_g   numeric(8,2),
  price_per_kg   numeric(8,2),
  notes          text,

  client_uuid    text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint fish_harvest_type_ck check (
    harvest_type in ('partial','full')
  )
);
drop trigger if exists trg_fish_harvest_updated on fish_harvest_records;
create trigger trg_fish_harvest_updated before update on fish_harvest_records
  for each row execute function set_updated_at();

create index if not exists idx_fish_harvest_pond
  on fish_harvest_records (pond_id, harvest_date desc);
create unique index if not exists idx_fish_harvest_client_uuid
  on fish_harvest_records (space_id, client_uuid) where client_uuid is not null;

-- ── fish_sales ────────────────────────────────────────────────────────────────
create table if not exists fish_sales (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,

  sale_date   date not null,
  sale_type   text not null,               -- fresh_fish | dried_fish | fingerlings | prawn | other
  species     text,
  buyer       text,
  weight_kg   numeric(10,2),
  unit_price  numeric(8,2),
  amount      numeric(12,2) not null check (amount > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint fish_sales_type_ck check (
    sale_type in ('fresh_fish','dried_fish','fingerlings','prawn','other')
  )
);
drop trigger if exists trg_fish_sales_updated on fish_sales;
create trigger trg_fish_sales_updated before update on fish_sales
  for each row execute function set_updated_at();

create index if not exists idx_fish_sales_space_date
  on fish_sales (space_id, sale_date desc);
create unique index if not exists idx_fish_sales_client_uuid
  on fish_sales (space_id, client_uuid) where client_uuid is not null;

-- ── fish_costs ────────────────────────────────────────────────────────────────
create table if not exists fish_costs (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,

  cost_date   date not null,
  category    text not null,
  description text not null,
  amount      numeric(10,2) not null check (amount > 0),
  notes       text,

  client_uuid text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint fish_costs_category_ck check (
    category in (
      'fingerlings','feed','chemicals','equipment',
      'labour','electricity','pond_prep','other'
    )
  )
);
drop trigger if exists trg_fish_costs_updated on fish_costs;
create trigger trg_fish_costs_updated before update on fish_costs
  for each row execute function set_updated_at();

create index if not exists idx_fish_costs_space_date
  on fish_costs (space_id, cost_date desc);
create unique index if not exists idx_fish_costs_client_uuid
  on fish_costs (space_id, client_uuid) where client_uuid is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table fish_ponds             enable row level security;
alter table fish_water_quality     enable row level security;
alter table fish_feed_records      enable row level security;
alter table fish_health_events     enable row level security;
alter table fish_mortality_records enable row level security;
alter table fish_harvest_records   enable row level security;
alter table fish_sales             enable row level security;
alter table fish_costs             enable row level security;
