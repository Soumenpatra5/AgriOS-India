-- AgriOS Commerce backend — B0 foundation schema.
-- Server-authoritative, multi-party commerce data (Marketplace first).
-- Applied by scripts/migrate.mjs, which tracks applied files in schema_migrations
-- and runs each file inside a transaction. Do NOT put BEGIN/COMMIT in here.
--
-- Conventions: uuid PKs, money as integer paise (never floats), timestamptz
-- created_at/updated_at (updated_at kept fresh by a trigger), soft-delete via
-- deleted_at to mirror the app's local data convention.

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- updated_at trigger ---------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- identity mirror (Firebase uid -> internal user) ----------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  firebase_uid  text unique not null,
  phone         text,
  name          text,
  is_seller     boolean not null default false,
  kyc_status    text not null default 'none',      -- none|pending|verified|rejected
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- catalog --------------------------------------------------------------------
create table if not exists listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references users(id),
  title         text not null,
  description   text,
  category      text not null,                      -- crop|seed|feed|livestock|equipment|...
  unit          text not null,                      -- kg|quintal|piece|litre
  price_paise   bigint not null check (price_paise >= 0),
  currency      text not null default 'INR',
  qty_available numeric not null default 0 check (qty_available >= 0),
  min_order     numeric not null default 1,
  state         text,
  district      text,
  status        text not null default 'draft',      -- draft|active|paused|sold_out|archived
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
drop trigger if exists trg_listings_updated on listings;
create trigger trg_listings_updated before update on listings
  for each row execute function set_updated_at();
create index if not exists idx_listings_status_category
  on listings (status, category) where deleted_at is null;
create index if not exists idx_listings_seller
  on listings (seller_id) where deleted_at is null;
create index if not exists idx_listings_search
  on listings using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

create table if not exists listing_media (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  url         text not null,
  sort        int not null default 0
);

-- orders ---------------------------------------------------------------------
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  buyer_id       uuid not null references users(id),
  seller_id      uuid not null references users(id),  -- denormalized for seller queries
  status         text not null default 'pending_payment',
    -- pending_payment|paid|confirmed|shipped|delivered|cancelled|refunded
  subtotal_paise bigint not null,
  shipping_paise bigint not null default 0,
  total_paise    bigint not null,
  currency       text not null default 'INR',
  delivery_addr  jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();
create index if not exists idx_orders_buyer  on orders (buyer_id, created_at desc);
create index if not exists idx_orders_seller on orders (seller_id, status);

create table if not exists order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  listing_id       uuid not null references listings(id),
  title_snapshot   text not null,
  unit_price_paise bigint not null,
  quantity         numeric not null check (quantity > 0),
  line_total_paise bigint not null
);

-- payments -------------------------------------------------------------------
create table if not exists payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references orders(id),
  provider            text not null default 'razorpay',
  provider_order_id   text,
  provider_payment_id text,
  amount_paise        bigint not null,
  status              text not null default 'created',  -- created|authorized|captured|failed|refunded
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists trg_payments_updated on payments;
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- webhook idempotency --------------------------------------------------------
create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (provider, event_id)
);

-- reviews --------------------------------------------------------------------
create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id),
  reviewer_id  uuid not null references users(id),
  subject_type text not null,                        -- listing|seller
  subject_id   uuid not null,
  rating       int not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (order_id, reviewer_id, subject_type)
);
