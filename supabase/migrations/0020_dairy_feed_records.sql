-- AgriOS Dairy — Feed records: operational animal-level feed tracking.
--
-- PURELY ADDITIVE. No ALTER, no DROP.
-- Scope: individual animal (animal_id), not space-level — this is operational
-- feed recording (farm.dairy.record permission), NOT finance (dairy_costs).
--
-- DESIGN CHOICE: A separate table from dairy_costs because:
--   1. dairy_costs is space-level with no animal_id — cannot track per-animal feed.
--   2. dairy_costs is finance-gated (farm.dairy.finance) — workers cannot record.
--   3. Operational feed is a health/management concern, not a P&L concern.

create table if not exists dairy_feed_records (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references farm_spaces(id) on delete cascade,
  animal_id     uuid not null references dairy_animals(id) on delete cascade,

  feed_date     date not null,
  feed_type     text not null,        -- concentrate|fodder|silage|mineral|other
  quantity_kg   numeric(8,2),
  notes         text,

  client_uuid   text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint dairy_feed_records_feed_type_ck check (
    feed_type in ('concentrate','fodder','silage','mineral','other')
  )
);

drop trigger if exists trg_dairy_feed_records_updated on dairy_feed_records;
create trigger trg_dairy_feed_records_updated before update on dairy_feed_records
  for each row execute function set_updated_at();

create index if not exists idx_dairy_feed_records_animal
  on dairy_feed_records (animal_id, feed_date desc);

create index if not exists idx_dairy_feed_records_space
  on dairy_feed_records (space_id, feed_date desc);

create unique index if not exists idx_dairy_feed_records_client_uuid
  on dairy_feed_records (space_id, client_uuid) where client_uuid is not null;

-- RLS: space membership enforced at application layer via requireScope().
-- Raw access requires authenticated Supabase role with space_id match.
alter table dairy_feed_records enable row level security;
