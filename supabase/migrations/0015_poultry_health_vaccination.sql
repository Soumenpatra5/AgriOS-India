-- AgriOS Poultry — P4: health events and vaccination records.
--
-- PURELY ADDITIVE. Two new tables and their indexes; nothing existing is
-- altered, dropped, or rewritten. An older build that pre-dates this
-- migration continues to work against a database that has run it, and
-- dropping these tables is the staging-only rollback — never the production
-- path, which rolls forward.
--
-- DESIGN DECISIONS:
--
--   One health-events table for all clinical notes, treatments and vet
--   visits rather than separate "clinical_notes" and "treatments" tables.
--   A broiler cycle runs 40–50 days; typical farms record < 20 health
--   events per batch. A single table is simpler to query and simpler for
--   a farm worker to reason about ("health record" is the same thing
--   whether it is an observation or a treatment).
--
--   Vaccination records are separate because their schema diverges: vaccines
--   have batch-lot numbers and administration routes that observations do
--   not, and a duplicate-prevention constraint (same vaccine on the same
--   day) only makes sense on vaccinations.
--
--   Soft delete on both tables: a deleted clinical note is still part of a
--   batch's history. Hard deletion would make the audit trail meaningless.
--
-- DUPLICATE PREVENTION:
--
--   The unique partial index on poultry_vaccinations enforces that the same
--   vaccine cannot be given twice on the same date to the same batch.
--   Soft-deleted rows are excluded from the index so a corrected vaccination
--   can be re-entered after the erroneous one is deleted.
--   The application layer runs an explicit pre-check before every insert and
--   returns a clear 409 (with a farmer-readable message) before the DB
--   constraint would ever fire; the constraint is defence-in-depth.

-- ── health events ────────────────────────────────────────────────────────────

create table if not exists poultry_health_events (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  batch_id     uuid not null references poultry_batches(id) on delete cascade,

  event_date   date not null,
  type         text not null check (type in ('observation','treatment','vet_visit','outbreak')),
  title        text not null,        -- required short description
  medicine     text,                 -- drug name; relevant for treatment type
  dose         text,                 -- dosage / unit; free text
  note         text,                 -- longer description

  created_by   text not null,        -- firebase_uid of the recording user
  updated_by   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz           -- soft delete; never hard-deleted
);

-- Leading with space_id keeps the index selective; event_date desc gives the
-- list query its sort order for free.
create index if not exists idx_health_events_space_batch
  on poultry_health_events (space_id, batch_id, event_date desc)
  where deleted_at is null;

-- ── vaccinations ─────────────────────────────────────────────────────────────

create table if not exists poultry_vaccinations (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references farm_spaces(id) on delete cascade,
  batch_id     uuid not null references poultry_batches(id) on delete cascade,

  given_at     date not null,
  vaccine_name text not null,
  route        text not null check (route in ('drinking_water','spray','eye_drop','injection')),
  dose         text,                 -- amount / dilution; free text
  batch_lot    text,                 -- vaccine lot number for traceability
  note         text,

  created_by   text not null,
  updated_by   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Prevent recording the same vaccine twice on the same date for one batch.
-- Partial (where deleted_at is null) so a corrected entry can be re-inserted
-- after the erroneous one is soft-deleted.
create unique index if not exists idx_vaccinations_no_duplicate
  on poultry_vaccinations (batch_id, given_at, vaccine_name)
  where deleted_at is null;

create index if not exists idx_vaccinations_space_batch
  on poultry_vaccinations (space_id, batch_id, given_at desc)
  where deleted_at is null;
