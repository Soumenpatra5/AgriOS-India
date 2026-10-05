-- Migration 0030: Farm Space Collaboration Phase 2 (Typing Indicators)

-- 1. Farm Space Memberships: Group chat ephemeral typing timestamp
alter table farm_space_memberships
  add column if not exists typing_chat_at timestamptz;

-- 2. Direct Messages: 1:1 conversation ephemeral typing timestamps
alter table farm_dm_conversations
  add column if not exists member_a_typing_at timestamptz,
  add column if not exists member_b_typing_at timestamptz;

-- 3. Partial index for active group chat typing queries
create index if not exists idx_farm_space_memberships_typing
  on farm_space_memberships (space_id, typing_chat_at)
  where typing_chat_at is not null;
