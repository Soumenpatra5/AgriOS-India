-- AgriOS Farm Space — phase 5: farm chat.
--
-- A channel per Farm Space, readable only by its members. Not a global chat
-- system: there is no direct messaging, no cross-farm thread, and no way to
-- address someone who is not in the space. The whole point of the feature is
-- that it is bounded by the same membership every other Farm Space table is.

create table if not exists farm_chat_messages (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references farm_spaces(id) on delete cascade,
  sender_user_id uuid not null references users(id),

  body           text,
  -- Attachments describe a file; the bytes stay on the device that produced
  -- them, as with task attachments. Farm Space has no file store, and pushing
  -- a farmer's photo into a shared table would be a second document system.
  attachments    jsonb not null default '[]'::jsonb,

  -- A message can point at a task, so "done, see photo" has something to be
  -- about. Nulled rather than cascaded if the task goes: losing the
  -- conversation because a task was cancelled would be worse than a dangling
  -- reference the UI can simply not render.
  task_id        uuid references farm_tasks(id) on delete set null,

  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  -- An empty message with no attachment is not a message.
  constraint chat_message_has_content
    check (coalesce(nullif(btrim(body), ''), null) is not null
           or jsonb_array_length(attachments) > 0)
);

-- The only read this table serves: this space's messages, newest first, paged.
create index if not exists idx_farm_chat_space
  on farm_chat_messages (space_id, created_at desc);
