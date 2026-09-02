-- AgriOS Farm Space — phase 3: shared tasks.
--
-- The collaboration payload: a manager creates work, a worker accepts and does
-- it, a supervisor verifies it. Everything here is scoped by space_id like the
-- rest of Farm Space, and the index leads with it so a query that forgets to
-- scope is an obvious omission rather than a silent leak.
--
-- Distinct from the app's local `tasks` store, which stays personal: that one
-- lives in the farmer's own IndexedDB and belongs to nobody else.

create table if not exists farm_tasks (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references farm_spaces(id) on delete cascade,

  title         text not null,
  description   text,
  unit          text,                                  -- farm unit: shed 1, field 3…

  assigned_to   uuid references users(id),             -- null = unassigned
  created_by    uuid not null references users(id),
  verified_by   uuid references users(id),

  priority      text not null default 'medium',        -- high|medium|low
  status        text not null default 'pending',
  -- pending|accepted|in_progress|completed|verified|rejected|cancelled
  -- "overdue" is deliberately NOT stored. It is a function of due_date and
  -- status, so persisting it would need a scheduled job to stay true and would
  -- be wrong between runs. The API derives it on read.

  start_date    date,
  due_date      date,
  remind_at     timestamptz,

  notes         text,                                  -- worker's note on completion
  attachments   jsonb not null default '[]'::jsonb,    -- [{name,size,type}] — bytes stay on the device
  completed_at  timestamptz,
  verified_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
drop trigger if exists trg_farm_tasks_updated on farm_tasks;
create trigger trg_farm_tasks_updated before update on farm_tasks
  for each row execute function set_updated_at();

-- The list query is always "this space, newest or soonest first".
create index if not exists idx_farm_tasks_space
  on farm_tasks (space_id, status, due_date);

-- A worker's list is "assigned to me, in this space" — the narrowing the role
-- matrix calls scope "own". Indexed so that path is not a scan of the farm.
create index if not exists idx_farm_tasks_assignee
  on farm_tasks (space_id, assigned_to, status);

-- Every status change, so "who marked this done" survives the row being edited
-- again. The activity feed and the task history both read from here.
create table if not exists farm_task_events (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references farm_spaces(id) on delete cascade,
  task_id       uuid not null references farm_tasks(id) on delete cascade,
  actor_user_id uuid references users(id),
  from_status   text,
  to_status     text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_farm_task_events_task
  on farm_task_events (task_id, created_at desc);
create index if not exists idx_farm_task_events_space
  on farm_task_events (space_id, created_at desc);
