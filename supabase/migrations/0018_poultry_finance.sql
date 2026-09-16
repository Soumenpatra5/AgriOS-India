-- Migration 0018: Poultry Finance — Sales & Costs
--
-- Creates two new tables:
--   poultry_batch_sales  — records each sale transaction (birds sold + revenue)
--   poultry_batch_costs  — records production costs outside the feed ledger
--
-- IMPORTANT: Apply this migration to the Supabase database BEFORE deploying
-- the API code. After this migration runs, poultry.metrics changes live_birds
-- to deduct sold birds, and the new finance actions become available.
--
-- Feed costs are already tracked in poultry_feed_logs.amount (since migration
-- 0014). The costs table intentionally has NO feed category to prevent
-- double-counting. The finance summary query reads feed costs from feed_logs.

-- ── sales ──────────────────────────────────────────────────────────────────

create table poultry_batch_sales (
  id                   uuid          primary key default gen_random_uuid(),
  space_id             uuid          not null references farm_spaces(id) on delete cascade,
  batch_id             uuid          not null references poultry_batches(id) on delete cascade,
  sale_date            date          not null,
  buyer_name           text          check (buyer_name is null or char_length(buyer_name) <= 100),
  birds_sold           int           not null check (birds_sold > 0),
  live_weight_kg       numeric(12,3) check (live_weight_kg is null or live_weight_kg > 0),
  price_per_kg         numeric(12,2) check (price_per_kg is null or price_per_kg >= 0),
  price_per_bird       numeric(12,2) check (price_per_bird is null or price_per_bird >= 0),
  gross_amount         numeric(14,2) not null check (gross_amount >= 0),
  transport_deduction  numeric(14,2) not null default 0 check (transport_deduction >= 0),
  commission_deduction numeric(14,2) not null default 0 check (commission_deduction >= 0),
  other_deduction      numeric(14,2) not null default 0 check (other_deduction >= 0),
  net_revenue          numeric(14,2) generated always as (
    gross_amount - transport_deduction - commission_deduction - other_deduction
  ) stored,
  notes                text          check (notes is null or char_length(notes) <= 500),
  created_by           text          not null,
  updated_by           text          not null,
  client_uuid          text,
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now(),
  deleted_at           timestamptz
);

create trigger set_updated_at
  before update on poultry_batch_sales
  for each row execute function set_updated_at();

create index idx_pbs_batch on poultry_batch_sales (batch_id, sale_date desc) where deleted_at is null;
create index idx_pbs_space on poultry_batch_sales (space_id, sale_date desc) where deleted_at is null;
create unique index idx_pbs_client_uuid on poultry_batch_sales (space_id, client_uuid) where client_uuid is not null;

alter table poultry_batch_sales enable row level security;

-- ── costs ──────────────────────────────────────────────────────────────────

-- Enum excludes 'feed' deliberately — feed costs live in poultry_feed_logs.
create type poultry_cost_category as enum (
  'chick_cost',    -- day-old chick purchase
  'labour',        -- catchers, workers, cleaning crew
  'medicine',      -- drugs, supplements (separate from feed)
  'equipment',     -- tools, repair, depreciation
  'transport',     -- chick delivery, collection trucks
  'electricity',   -- heating, fans, lighting
  'overhead',      -- rent, insurance, management fees
  'other'          -- anything else
);

create table poultry_batch_costs (
  id          uuid                   primary key default gen_random_uuid(),
  space_id    uuid                   not null references farm_spaces(id) on delete cascade,
  batch_id    uuid                   not null references poultry_batches(id) on delete cascade,
  cost_date   date                   not null,
  category    poultry_cost_category  not null,
  description text                   not null check (char_length(description) between 1 and 200),
  quantity    numeric(12,3)          check (quantity is null or quantity > 0),
  unit        text                   check (unit is null or char_length(unit) <= 20),
  unit_cost   numeric(12,4)          check (unit_cost is null or unit_cost >= 0),
  amount      numeric(14,2)          not null check (amount > 0),
  supplier    text                   check (supplier is null or char_length(supplier) <= 100),
  reference   text                   check (reference is null or char_length(reference) <= 100),
  notes       text                   check (notes is null or char_length(notes) <= 500),
  created_by  text                   not null,
  updated_by  text                   not null,
  client_uuid text,
  created_at  timestamptz            not null default now(),
  updated_at  timestamptz            not null default now(),
  deleted_at  timestamptz
);

create trigger set_updated_at
  before update on poultry_batch_costs
  for each row execute function set_updated_at();

create index idx_pbc_batch on poultry_batch_costs (batch_id, cost_date desc) where deleted_at is null;
create index idx_pbc_space on poultry_batch_costs (space_id, cost_date desc) where deleted_at is null;
create unique index idx_pbc_client_uuid on poultry_batch_costs (space_id, client_uuid) where client_uuid is not null;

alter table poultry_batch_costs enable row level security;
