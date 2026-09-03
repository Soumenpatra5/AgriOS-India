-- AgriOS India — OTP challenges for phone sign-in (WhatsApp, SMS fallback).
--
-- Server-side only. The browser never decides whether a code was correct: it
-- posts the code, and this table is the sole record of what the right answer
-- was. The predecessor to this feature put the OTP inside a JWT handed to the
-- client, which meant anyone could read it without receiving the message;
-- that endpoint has been deleted and this table exists so the mistake cannot
-- be repeated.
--
-- The code itself is NEVER stored. Only an HMAC of it, keyed with a server
-- pepper, so a leak of this table alone does not hand an attacker a working
-- code — a 6-digit number is a million guesses, which is nothing against a
-- plain hash but useless without the pepper.

create table if not exists otp_challenges (
  id            uuid primary key default gen_random_uuid(),

  -- Ten digits, no country code — the canonical form used by users.phone and
  -- by Farm Space invitations. E.164 is produced only at the provider
  -- boundary, so the formats cannot drift apart.
  phone         text not null,
  channel       text not null,                        -- whatsapp|sms
  code_hash     text not null,                        -- HMAC-SHA256, hex

  expires_at    timestamptz not null,
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  consumed_at   timestamptz,

  -- Abuse metadata, never the address itself: enough to spot one source
  -- hammering the endpoint, not enough to track a person.
  ip_hash       text,
  provider_message_id text,

  status        text not null default 'pending',      -- pending|verified|superseded|failed
  created_at    timestamptz not null default now()
);

-- The two reads this table serves: "the live challenge for this phone" and
-- "how many has this phone asked for lately".
create index if not exists idx_otp_phone_created
  on otp_challenges (phone, created_at desc);

-- A sweep can drop expired rows without scanning the table.
create index if not exists idx_otp_expires
  on otp_challenges (expires_at);
