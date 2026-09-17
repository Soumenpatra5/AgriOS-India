-- FarmSpace notification inbox.
-- Notifications are per-member, per-space. They are generated server-side by
-- the alert check engine (api/_lib/farm/notifications.js) and consumed by the
-- FarmSpaceNotifications screen.
--
-- alert_key: dedup key — one active alert per (space_id, member_id, alert_key).
--   e.g. "hive:queenless:<hive_id>", "fish:water_check:<pond_id>"
-- severity:  info | warning | critical

create table if not exists farm_notifications (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  member_id   uuid not null references users(id) on delete cascade,

  title       text not null,
  body        text,
  severity    text not null default 'info'
                check (severity in ('info','warning','critical')),
  category    text not null default 'general',
  alert_key   text,
  link_kind   text,           -- screen kind to push (e.g. "hiveDetail")
  link_props  jsonb,          -- props to pass with the push

  is_read     boolean not null default false,
  read_at     timestamptz,
  dismissed   boolean not null default false,
  dismissed_at timestamptz,

  created_at  timestamptz not null default now()
);

create unique index if not exists farm_notifications_alert_key
  on farm_notifications(space_id, member_id, alert_key)
  where alert_key is not null and dismissed = false;

create index if not exists farm_notifications_member
  on farm_notifications(member_id, space_id)
  where dismissed = false;
