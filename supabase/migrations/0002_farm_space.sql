-- AgriOS Farm Space — phase 1: tenancy, membership, invitations, audit.
--
-- Farm Space is the app's ONLY collaborative surface. Everything else in AgriOS
-- stays personal, so nothing here touches the commerce tables from 0001 beyond
-- referencing users(id) for identity.
--
-- The isolation rule this schema exists to enforce: every shared row carries a
-- non-null space_id, and every index leads with it. A query that forgets to
-- scope by space is then an obvious omission rather than a silent leak.
--
-- Applied by scripts/migrate.mjs, which runs each file in a transaction and
-- tracks it in schema_migrations. Do NOT put BEGIN/COMMIT in here.
-- Conventions follow 0001: uuid PKs, timestamptz, set_updated_at() trigger.

-- the tenant -----------------------------------------------------------------
-- Deliberately NOT the existing `farms` concept. A farm in the ERP is a record
-- one user owns inside their own data; a farm SPACE is a tenant that owns
-- members. Conflating them would turn every farm a user creates into a shared
-- workspace. An ERP farm may later be linked to a space, never merged with it.
create table if not exists farm_spaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references users(id),
  description   text,
  photo_url     text,
  location      text,
  status        text not null default 'active',      -- active|archived
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
drop trigger if exists trg_farm_spaces_updated on farm_spaces;
create trigger trg_farm_spaces_updated before update on farm_spaces
  for each row execute function set_updated_at();

create index if not exists idx_farm_spaces_owner on farm_spaces (owner_user_id);

-- membership -----------------------------------------------------------------
-- The authorization spine: every Farm Space request reads this table before it
-- reads anything else. `permissions` holds per-member overrides on top of the
-- role matrix, which is what makes custom roles possible without a schema
-- change. status lets a membership be revoked without destroying its history.
create table if not exists farm_space_memberships (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  user_id     uuid not null references users(id),
  role        text not null default 'worker',        -- owner|manager|supervisor|worker
  status      text not null default 'active',        -- active|removed
  permissions jsonb not null default '{}'::jsonb,
  invited_by  uuid references users(id),
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (space_id, user_id)
);
drop trigger if exists trg_farm_memberships_updated on farm_space_memberships;
create trigger trg_farm_memberships_updated before update on farm_space_memberships
  for each row execute function set_updated_at();

-- The membership lookup runs on EVERY request, so it gets the leading index.
create index if not exists idx_farm_memberships_user
  on farm_space_memberships (user_id, status);
create index if not exists idx_farm_memberships_space
  on farm_space_memberships (space_id, status);

-- invitations ----------------------------------------------------------------
-- Separate from membership because an invitation exists BEFORE the invited
-- person has an account: an owner invites a phone number, and the row must
-- survive until that person signs in and is mirrored into users. Binding
-- happens on accept, which is the only path that writes a membership.
create table if not exists farm_space_invitations (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references farm_spaces(id) on delete cascade,
  phone       text,
  email       text,
  role        text not null default 'worker',
  permissions jsonb not null default '{}'::jsonb,
  token       text not null unique,
  status      text not null default 'pending',       -- pending|accepted|declined|revoked|expired
  invited_by  uuid not null references users(id),
  accepted_by uuid references users(id),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- An invitation with neither contact detail could never be delivered or matched.
  constraint invitation_has_contact check (phone is not null or email is not null)
);
drop trigger if exists trg_farm_invitations_updated on farm_space_invitations;
create trigger trg_farm_invitations_updated before update on farm_space_invitations
  for each row execute function set_updated_at();

create index if not exists idx_farm_invitations_space  on farm_space_invitations (space_id, status);
create index if not exists idx_farm_invitations_phone  on farm_space_invitations (phone, status);
create index if not exists idx_farm_invitations_email  on farm_space_invitations (email, status);

-- audit ----------------------------------------------------------------------
-- The security record, distinct from the member-facing activity feed: it keeps
-- entries the feed should not surface (permission changes, document access,
-- ownership transfer) and is never trimmed for readability.
create table if not exists farm_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references farm_spaces(id) on delete cascade,
  actor_user_id  uuid references users(id),
  action         text not null,
  target_type    text,
  target_id      text,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_farm_audit_space on farm_audit_logs (space_id, created_at desc);
