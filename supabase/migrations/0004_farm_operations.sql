-- AgriOS Farm Space — phase 4: attendance and announcements.
--
-- Note what is NOT here: there is no farm_activity table. The activity feed is
-- a read over farm_task_events and farm_audit_logs, both of which already
-- record what happened. A third table holding the same events would be a copy
-- to keep in sync, and the brief is explicit about not creating duplicates.

-- attendance -----------------------------------------------------------------
-- Shared operational data: a manager needs to see who is working, and a worker
-- needs to see their own record. The role matrix narrows the rows; this table
-- just has to make the narrowing cheap and the uniqueness real.
create table if not exists farm_attendance (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  user_id     uuid not null references users(id),
  date        date not null,
  status      text not null default 'present',       -- present|absent|leave|half_day
  check_in    timestamptz,
  check_out   timestamptz,
  note        text,
  marked_by   uuid references users(id),             -- null when self-marked
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One record per person per day. Without this, a double tap on "check in"
  -- would quietly create a second day's attendance for the same day.
  unique (space_id, user_id, date)
);
drop trigger if exists trg_farm_attendance_updated on farm_attendance;
create trigger trg_farm_attendance_updated before update on farm_attendance
  for each row execute function set_updated_at();

-- "Today, for this farm" is the query the attendance screen opens with.
create index if not exists idx_farm_attendance_space_date
  on farm_attendance (space_id, date desc);
-- "My record" is the worker's narrowed view.
create index if not exists idx_farm_attendance_user
  on farm_attendance (space_id, user_id, date desc);

-- announcements --------------------------------------------------------------
create table if not exists farm_announcements (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  created_by  uuid not null references users(id),
  kind        text not null default 'notice',
  -- notice|meeting|vaccination|weather|emergency
  message     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
drop trigger if exists trg_farm_announcements_updated on farm_announcements;
create trigger trg_farm_announcements_updated before update on farm_announcements
  for each row execute function set_updated_at();

create index if not exists idx_farm_announcements_space
  on farm_announcements (space_id, created_at desc);
