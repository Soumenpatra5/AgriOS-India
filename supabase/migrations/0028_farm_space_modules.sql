-- Farm Space Modules configuration
-- Tracks which modules are enabled and their custom sort order per space.

alter table farm_spaces add column if not exists configuration_version integer not null default 1;

create table if not exists farm_space_modules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references farm_spaces(id) on delete cascade,
  module_id text not null,
  enabled boolean not null default true,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_farm_space_modules_updated on farm_space_modules;
create trigger trg_farm_space_modules_updated before update on farm_space_modules
  for each row execute function set_updated_at();

create unique index if not exists idx_farm_space_modules_space_module on farm_space_modules (space_id, module_id);
create index if not exists idx_farm_space_modules_space on farm_space_modules (space_id);

-- Backfill existing spaces with deterministic default order.
-- Core:
-- 0: farmSpaceTeam
-- 1: farmSpaceTasks
-- 2: farmSpaceAttendance
-- 3: farmSpaceAnnouncements
-- 4: farmSpaceChat
-- 5: farmSpaceActivity
-- 6: farmSpaceNotifications
-- Optional:
-- 7: poultryDashboard
-- 8: dairyDashboard
-- 9: goatDashboard
-- 10: pigDashboard
-- 11: fishDashboard
-- 12: beeDashboard
-- 13: cropDashboard
-- 14: farmSpaceAnalytics

insert into farm_space_modules (space_id, module_id, sort_order, enabled)
select id, m.module_id, m.sort_order, true
from farm_spaces
cross join (
  values 
    ('farmSpaceTeam', 0),
    ('farmSpaceTasks', 1),
    ('farmSpaceAttendance', 2),
    ('farmSpaceAnnouncements', 3),
    ('farmSpaceChat', 4),
    ('farmSpaceActivity', 5),
    ('farmSpaceNotifications', 6),
    ('poultryDashboard', 7),
    ('dairyDashboard', 8),
    ('goatDashboard', 9),
    ('pigDashboard', 10),
    ('fishDashboard', 11),
    ('beeDashboard', 12),
    ('cropDashboard', 13),
    ('farmSpaceAnalytics', 14)
) as m(module_id, sort_order)
on conflict do nothing;

-- RLS
alter table farm_space_modules enable row level security;

drop policy if exists "farm_space_modules_select" on farm_space_modules;
create policy "farm_space_modules_select" on farm_space_modules
  for select using (
    exists (
      select 1 from farm_space_memberships
      where space_id = farm_space_modules.space_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Only owners and managers (via farm.settings.manage API) will modify this,
-- but the RLS acts as a fallback. 
drop policy if exists "farm_space_modules_modify" on farm_space_modules;
create policy "farm_space_modules_modify" on farm_space_modules
  for all using (
    exists (
      select 1 from farm_space_memberships
      where space_id = farm_space_modules.space_id
        and user_id = auth.uid()
        and status = 'active'
        and (role = 'owner' or role = 'manager')
    )
  );
