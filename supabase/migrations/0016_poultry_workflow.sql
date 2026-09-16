-- AgriOS Poultry — P5: Workflow Engine + Follow-up Chain System.
--
-- PURELY ADDITIVE. Five new tables; nothing existing is altered, dropped,
-- or rewritten. P1-P4 tables remain the authoritative source of truth for
-- all farm data. This layer references them but never writes to them directly
-- — every write to P1-P4 continues through the existing API actions.
--
-- TABLE ORDER matters for FK references:
--   poultry_task_templates   (no FK to new tables)
--   poultry_followup_chains  (FK → poultry_batches)
--   poultry_batch_tasks      (FK → chains, templates)
--   poultry_followup_outcomes(FK → chains, tasks)
--   poultry_incidents        (FK → chains, batches)
--
-- VACCINATION SCHEDULES: stored as template rows with configurable day
-- numbers (trigger_config.day or followup_days), never as hard-coded logic.
-- Managers can add farm-specific rows; the engine treats them identically.
--
-- OFFLINE IDEMPOTENCY: every write table carries a client_uuid column with
-- a unique partial index so offline replays are deduplicated server-side.

-- ── task templates ────────────────────────────────────────────────────────────
-- Configurable schedule rules. Seed rows are the defaults; new rows can be
-- added without a migration. `active = false` retires a row without deleting
-- the tasks already created from it.

create table if not exists poultry_task_templates (
  id              text primary key,
  category        text not null
    check (category in
      ('daily_ops','health','weight','feed','biosecurity','milestone','reactive')),
  task_type       text not null
    check (task_type in
      ('data_recording','monitoring_check','physical_task','chain_followup')),
  title           text not null,
  description     text,
  -- null means all poultry types; a JSON array means only those types.
  poultry_types   text[],
  trigger_type    text not null
    check (trigger_type in ('daily','every_n_days','on_day','reactive')),
  -- {"day":7} for on_day; {"every_n_days":7,"start_day":0} for periodic.
  trigger_config  jsonb,
  day_from        int,                  -- null = no lower bound
  day_to          int,                  -- null = no upper bound
  default_priority text not null default 'normal'
    check (default_priority in ('urgent','high','normal','low')),
  -- Existing farm.js action whose payload satisfies this task.
  linked_action   text,
  linked_fields   jsonb,                -- {"required":[...],"optional":[...]}
  -- When true, recording a health treatment auto-creates a follow-up chain.
  -- followup_days is the interval (e.g. 1 = tomorrow).
  auto_followup   boolean not null default false,
  followup_days   int,
  sort_order      int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── follow-up chains ─────────────────────────────────────────────────────────
-- A chain links a sequence of follow-up tasks to one triggering P1-P4 event.
-- source_id is stored as uuid without a typed FK so one column can reference
-- any P1-P4 table (health_events, vaccinations, incidents, …).

create table if not exists poultry_followup_chains (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  batch_id        uuid not null references poultry_batches(id) on delete cascade,
  chain_type      text not null
    check (chain_type in ('health','vaccination','incident','manual')),
  status          text not null default 'active'
    check (status in ('active','resolved','cancelled')),
  severity        text not null default 'normal'
    check (severity in ('urgent','high','normal')),
  title           text not null,
  source_type     text not null
    check (source_type in ('health_event','vaccination','incident','manual')),
  -- P1-P4 row that triggered the chain; null for manually-created chains.
  source_id       uuid,
  batch_day       int not null,
  triggered_by    text not null,        -- users.id (stored as text)
  triggered_at    timestamptz not null default now(),
  resolution_notes text,
  resolved_at     timestamptz,
  resolved_by     text,
  client_uuid     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_followup_chains_batch
  on poultry_followup_chains (batch_id, triggered_at desc)
  where deleted_at is null;
create index if not exists idx_followup_chains_space_status
  on poultry_followup_chains (space_id, status)
  where deleted_at is null;
create unique index if not exists idx_followup_chains_client_uuid
  on poultry_followup_chains (space_id, client_uuid)
  where client_uuid is not null and deleted_at is null;

-- ── batch tasks ───────────────────────────────────────────────────────────────
-- One row per task instance per batch per scheduled date.
-- chain_id = null  → generated from a template (routine schedule task).
-- chain_id ≠ null  → follow-up chain task.
-- linked_record_id holds the P1-P4 row id set when the task is completed.

create table if not exists poultry_batch_tasks (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  batch_id        uuid not null references poultry_batches(id) on delete cascade,
  chain_id        uuid references poultry_followup_chains(id),
  template_id     text references poultry_task_templates(id),
  task_type       text not null
    check (task_type in
      ('data_recording','monitoring_check','physical_task','incident_task','chain_followup')),
  category        text not null,
  scheduled_date  date not null,
  batch_day       int not null,
  title           text not null,
  priority        text not null default 'normal'
    check (priority in ('urgent','high','normal','low')),
  status          text not null default 'pending'
    check (status in
      ('pending','in_progress','completed','skipped','overdue','blocked','cancelled')),
  started_at      timestamptz,
  completed_at    timestamptz,
  completed_by    text,
  skipped_at      timestamptz,
  skipped_by      text,
  skipped_reason  text,
  cancelled_at    timestamptz,
  cancelled_by    text,
  cancelled_reason text,
  -- P1-P4 row created when the task was completed (data_recording tasks only).
  linked_record_id   uuid,
  linked_record_type text,             -- 'daily_record'|'weight'|'feed_log'|'health_event'|'vaccination'
  source          text not null default 'engine'
    check (source in ('engine','reactive','manager','farmer','ai')),
  -- Why this task was created / raised; shown as context in the UI.
  reason          text,
  notes           text,
  sort_order      int not null default 0,
  client_uuid     text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_batch_tasks_batch_date
  on poultry_batch_tasks (batch_id, scheduled_date)
  where deleted_at is null;
create index if not exists idx_batch_tasks_chain
  on poultry_batch_tasks (chain_id)
  where chain_id is not null and deleted_at is null;
create index if not exists idx_batch_tasks_space_status
  on poultry_batch_tasks (space_id, status)
  where deleted_at is null;
create unique index if not exists idx_batch_tasks_client_uuid
  on poultry_batch_tasks (space_id, client_uuid)
  where client_uuid is not null and deleted_at is null;

-- ── follow-up outcomes ───────────────────────────────────────────────────────
-- One row per completed follow-up check. next_followup_days > 0 triggers
-- creation of the next task in the same chain.

create table if not exists poultry_followup_outcomes (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  chain_id        uuid not null references poultry_followup_chains(id) on delete cascade,
  -- Unique: one outcome per task (a task cannot be completed twice).
  task_id         uuid not null references poultry_batch_tasks(id),
  batch_day       int not null,
  recorded_at     timestamptz not null default now(),
  recorded_by     text not null,
  outcome         text not null
    check (outcome in
      ('improved','same','worse','recovered','resolved','deceased')),
  observation_notes text,
  action_taken    text
    check (action_taken is null or action_taken in
      ('no_action','repeat_treatment','new_treatment','resolved','escalated')),
  -- If a P1-P4 record was created as part of the action, link it here.
  next_linked_event_type text,
  next_linked_event_id   uuid,
  -- null = chain resolved; >= 1 = schedule follow-up in N days.
  next_followup_days     int,
  client_uuid     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_followup_outcomes_chain
  on poultry_followup_outcomes (chain_id, created_at);
create unique index if not exists idx_followup_outcomes_task
  on poultry_followup_outcomes (task_id);
create unique index if not exists idx_followup_outcomes_client_uuid
  on poultry_followup_outcomes (space_id, client_uuid)
  where client_uuid is not null;

-- ── incidents ─────────────────────────────────────────────────────────────────
-- Farmer-reported problems. batch_context is a batchMetrics() snapshot taken
-- at report time — never updated, so it always reflects the state when the
-- problem was observed. guided_response is computed synchronously at report
-- time from the rule table in poultryWorkflow.js (no AI in Phase A).

create table if not exists poultry_incidents (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references farm_spaces(id) on delete cascade,
  batch_id        uuid not null references poultry_batches(id) on delete cascade,
  -- Set when a follow-up chain is auto-created for high/urgent incidents.
  chain_id        uuid references poultry_followup_chains(id),
  batch_day       int not null,
  status          text not null default 'open'
    check (status in ('open','investigating','resolved','escalated')),
  severity        text not null
    check (severity in ('urgent','high','normal')),
  description     text not null,
  batch_context   jsonb not null,
  guided_response jsonb,
  resolution_notes text,
  resolved_at     timestamptz,
  resolved_by     text,
  reported_by     text not null,
  client_uuid     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_incidents_batch
  on poultry_incidents (batch_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_incidents_space_status
  on poultry_incidents (space_id, status)
  where deleted_at is null;
create unique index if not exists idx_incidents_client_uuid
  on poultry_incidents (space_id, client_uuid)
  where client_uuid is not null and deleted_at is null;

-- ── row-level security ───────────────────────────────────────────────────────
-- Enabling RLS with no permissive policies produces implicit DENY ALL for the
-- anon and authenticated roles on the Supabase Data API. The Vercel server
-- connection bypasses RLS through its role grant (verified separately), so no
-- policy is needed to allow application reads/writes through the API layer.
alter table poultry_task_templates    enable row level security;
alter table poultry_followup_chains   enable row level security;
alter table poultry_batch_tasks       enable row level security;
alter table poultry_followup_outcomes enable row level security;
alter table poultry_incidents         enable row level security;

-- ── seed: task templates ──────────────────────────────────────────────────────
-- Default schedule for broiler farms. These rows are configuration, not
-- hard-coded logic — changing a `followup_days` or `trigger_config.day` here
-- changes the engine's behavior without a code deploy.

insert into poultry_task_templates
  (id, category, task_type, title, description,
   poultry_types, trigger_type, trigger_config,
   day_from, day_to, default_priority,
   linked_action, linked_fields,
   auto_followup, followup_days, sort_order)
values
  -- Daily mortality: must be recorded first; it unlocks environment + water.
  ('daily-mortality', 'daily_ops', 'data_recording',
   'Record mortality and culls',
   'Count and record any birds that died or were culled today.',
   null, 'daily', null, 0, null, 'high',
   'poultry.daily.upsert',
   '{"required":["mortality","culls"],"optional":["symptoms","remarks"]}',
   false, null, 10),

  -- Feed check: depends on water check in the dependency graph.
  ('daily-feed-check', 'feed', 'data_recording',
   'Check and record feed',
   'Check feeder levels, refill if needed, record kg consumed.',
   null, 'daily', null, 0, null, 'high',
   'poultry.feed.add',
   '{"required":["quantity_kg","kind"],"optional":["notes"]}',
   false, null, 20),

  -- Environment: depends on daily-mortality in the dependency graph.
  ('daily-env', 'daily_ops', 'monitoring_check',
   'Environment check',
   'Check shed temperature, humidity and ventilation.',
   null, 'daily', null, 0, null, 'normal',
   'poultry.daily.upsert',
   '{"required":[],"optional":["temp_c","humidity_pct","ventilation"]}',
   false, null, 30),

  -- Water: depends on daily-env in the dependency graph.
  ('daily-water', 'daily_ops', 'monitoring_check',
   'Water availability check',
   'Check water nipples / drinkers. Record water litres if metered.',
   null, 'daily', null, 0, null, 'normal',
   'poultry.daily.upsert',
   '{"required":[],"optional":["water_litres","remarks"]}',
   false, null, 35),

  -- Brooding: only broiler/country, only Days 0-14.
  ('brooding-check', 'daily_ops', 'monitoring_check',
   'Brooding temperature check',
   'Measure brooder temperature: 33–35°C at Day 0, reduce 0.5°C/day.',
   '{"broiler","country"}', 'daily', null, 0, 14, 'high',
   'poultry.daily.upsert',
   '{"required":["temp_c"],"optional":["humidity_pct"]}',
   false, null, 15),

  -- Day-0 placement confirmation milestone.
  ('day0-setup', 'milestone', 'monitoring_check',
   'Day 0: Confirm placement',
   'Confirm bird count, set up brooder, first water check.',
   null, 'on_day', '{"day":0}', null, null, 'urgent',
   null, null, false, null, 5),

  -- First weight sample on Day 7.
  ('weight-d7', 'weight', 'data_recording',
   'First weight sample — Day 7',
   'Weigh a random sample of 30–50 birds. Target: ~160–180 g for broilers.',
   null, 'on_day', '{"day":7}', null, null, 'high',
   'poultry.weights.add',
   '{"required":["total_weight_g","sample_count"],"optional":["notes"]}',
   false, null, 50),

  -- Weekly weight every 7 days starting from Day 14.
  ('weight-weekly', 'weight', 'data_recording',
   'Weekly weight sample',
   'Weigh a random sample. Compare to breed standard.',
   null, 'every_n_days', '{"every_n_days":7,"start_day":14}', 14, null, 'high',
   'poultry.weights.add',
   '{"required":["total_weight_g","sample_count"],"optional":["notes"]}',
   false, null, 50),

  -- Biosecurity check weekly starting Day 7.
  ('biosecurity-weekly', 'biosecurity', 'physical_task',
   'Weekly biosecurity check',
   'Check shed entry protocol, footbaths, visitor log.',
   null, 'every_n_days', '{"every_n_days":7,"start_day":7}', 7, null, 'normal',
   null, null, false, null, 60),

  -- Litter check every 3 days starting Day 3.
  ('cleaning-periodic', 'biosecurity', 'physical_task',
   'Litter and cleaning check',
   'Check litter quality, remove wet patches, assess ventilation.',
   null, 'every_n_days', '{"every_n_days":3,"start_day":3}', 3, null, 'normal',
   'poultry.daily.upsert',
   '{"required":[],"optional":["cleaning","disinfection","remarks"]}',
   false, null, 65),

  -- Harvest preparation: reactive type; not auto-generated in Phase A.
  ('harvest-prep', 'milestone', 'monitoring_check',
   'Harvest preparation',
   'Withdraw feed, confirm catching crew, notify market.',
   null, 'reactive', null, null, null, 'high',
   null, null, false, null, 5),

  -- Health treatment follow-up: reactive; created by the follow-up engine.
  -- auto_followup=true, followup_days=1 means the chain engine schedules
  -- a next check 1 day after the outcome is recorded (if not resolved).
  ('health-treatment-followup', 'health', 'chain_followup',
   'Health follow-up check',
   'Follow up on the health condition recorded. Observe and report current state.',
   null, 'reactive', null, null, null, 'high',
   null,
   '{"required":["outcome"],"optional":["observation_notes","action_taken"]}',
   true, 1, 10),

  -- Post-vaccination follow-up (configurable interval; default 7 days).
  ('vaccination-followup', 'health', 'chain_followup',
   'Post-vaccination follow-up',
   'Check for adverse reactions 7 days after vaccination.',
   null, 'reactive', null, null, null, 'normal',
   null,
   '{"required":["outcome"],"optional":["observation_notes"]}',
   true, 7, 15)

on conflict (id) do nothing;
