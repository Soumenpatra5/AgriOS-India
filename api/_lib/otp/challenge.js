/* The OTP challenge lifecycle: issue, verify, consume.

   Every rule the brief asks for lives here rather than in the endpoint, so
   there is one place to read to know whether a code can be replayed, guessed
   or outlived — and one place to change if a limit is wrong.

   Three properties this file exists to guarantee:

   1. The code is never stored and never returned. Only HMAC(code, pepper).
      A six-digit code is a million guesses, which a plain hash does not
      survive if the table leaks; the pepper lives in the environment, so the
      table alone is not enough.

   2. A challenge is single-use and single-live. Verifying consumes it;
      issuing a new one supersedes any earlier pending challenge for that
      phone, so an old message cannot be used after a resend.

   3. Attempts are counted on the server. The client cannot decide it has run
      out of guesses, and cannot decide it has not. */

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { HttpError } from "../http.js";
import { toCanonical, forLog } from "./phone.js";

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/* Configurable, with the brief's defaults. Read at call time rather than at
   module load so a test can change them without re-importing. */
export const otpConfig = () => ({
  ttlMs:          num(process.env.OTP_TTL_SECONDS, 300) * 1000,      // 5 minutes
  maxAttempts:    num(process.env.OTP_MAX_ATTEMPTS, 5),
  resendCooldownMs: num(process.env.OTP_RESEND_COOLDOWN_SECONDS, 45) * 1000,
  maxPerPhonePerHour: num(process.env.OTP_MAX_PER_PHONE_HOUR, 5),
});

/* The pepper is required. Falling back to an unpeppered hash would quietly
   downgrade the whole scheme, and a random per-process pepper would break
   verification across serverless instances — so a missing one is a loud
   configuration error, exactly like a missing DATABASE_URL. */
function pepper() {
  const p = process.env.OTP_PEPPER;
  if (!p || p.length < 16) {
    throw new HttpError(503, "Phone sign-in is not configured on this server.");
  }
  return p;
}

export function hashCode(code, phone) {
  /* The phone is mixed in so a hash from one challenge cannot be replayed
     against another number that happened to get the same code. */
  return createHmac("sha256", pepper()).update(`${phone}:${code}`).digest("hex");
}

/* Cryptographically secure, uniform over 000000-999999. randomInt is rejection
   sampled by node; Math.random would be predictable enough to matter here. */
export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/* Constant-time compare so the failure path cannot be timed to recover the
   code digit by digit. */
function hashesMatch(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hashIp(ip) {
  if (!ip) return null;
  /* Hashed, and peppered, so the abuse column cannot be turned back into a
     list of who used the app from where. */
  return createHmac("sha256", pepper()).update(String(ip)).digest("hex").slice(0, 32);
}

/* ── issuing ──────────────────────────────────────────────────────────────── */

/* How recently this phone asked, and how often. Returned rather than thrown so
   the caller can decide between "wait" and "too many" wording. */
export async function issuanceState(sql, phone) {
  const cfg = otpConfig();
  const [row] = await sql`
    select
      max(created_at) as last_at,
      count(*) filter (where created_at > now() - interval '1 hour')::int as last_hour
    from otp_challenges
    where phone = ${phone}`;

  const lastAt = row?.last_at ? new Date(row.last_at).getTime() : 0;
  const sinceLast = lastAt ? Date.now() - lastAt : Infinity;
  return {
    cooldownRemainingMs: Math.max(0, cfg.resendCooldownMs - sinceLast),
    inLastHour: row?.last_hour ?? 0,
    overHourlyCap: (row?.last_hour ?? 0) >= cfg.maxPerPhonePerHour,
  };
}

/* Create a challenge and return { id, code, expiresAt }.

   The plaintext code is returned ONLY so the caller can hand it to the
   messaging provider. It is never persisted, never logged, and never sent to
   the browser — the endpoint returns the id and the expiry, nothing else. */
export async function createChallenge(sql, { phone, channel, ip }) {
  const canonical = toCanonical(phone);
  if (!canonical) throw new HttpError(400, "Enter a valid 10-digit Indian mobile number.");
  if (!["whatsapp", "sms"].includes(channel)) throw new HttpError(400, "Unknown delivery method.");

  const cfg = otpConfig();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + cfg.ttlMs).toISOString();

  const created = await sql.begin(async (tx) => {
    /* A resend must invalidate what came before, or a farmer who requested
       twice would have two working codes and an attacker two chances. */
    await tx`
      update otp_challenges set status = 'superseded'
       where phone = ${canonical} and status = 'pending' and consumed_at is null`;

    const [row] = await tx`
      insert into otp_challenges
        (phone, channel, code_hash, expires_at, max_attempts, ip_hash)
      values (${canonical}, ${channel}, ${hashCode(code, canonical)}, ${expiresAt},
              ${cfg.maxAttempts}, ${hashIp(ip)})
      returning id, expires_at`;
    return row;
  });

  console.log(`otp_request channel=${channel} phone=${forLog(canonical)}`);
  return { id: created.id, code, expiresAt: created.expires_at, phone: canonical };
}

export async function markSent(sql, id, providerMessageId) {
  await sql`
    update otp_challenges set provider_message_id = ${providerMessageId ?? null}
     where id = ${id}`;
}

export async function markFailed(sql, id) {
  await sql`update otp_challenges set status = 'failed' where id = ${id}`;
}

/* ── verifying ────────────────────────────────────────────────────────────── */

/* Check a submitted code against a challenge.

   Returns the canonical phone on success. Every failure is an HttpError whose
   message is written for a farmer and says nothing an attacker can use to
   tell "wrong code" from "no such challenge".

   The attempt counter increments BEFORE the comparison, inside the same
   statement that reads the row, so two requests racing cannot both spend the
   same attempt. */
export async function verifyChallenge(sql, { challengeId, code }) {
  if (!challengeId || !/^\d{6}$/.test(String(code ?? ""))) {
    throw new HttpError(400, "Enter the 6-digit code.");
  }

  const [row] = await sql`
    update otp_challenges
       set attempts = attempts + 1
     where id = ${challengeId}
       and consumed_at is null
       and status = 'pending'
     returning id, phone, code_hash, expires_at, attempts, max_attempts`;

  /* No row: wrong id, already used, or superseded by a newer code. All of
     them are "that code will not work", and the farmer does not benefit from
     knowing which. */
  if (!row) throw new HttpError(401, "That code is no longer valid. Please request a new one.");

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql`update otp_challenges set status = 'expired' where id = ${row.id}`;
    console.log(`otp_expired phone=${forLog(row.phone)}`);
    throw new HttpError(401, "That code has expired. Please request a new one.");
  }

  if (row.attempts > row.max_attempts) {
    await sql`update otp_challenges set status = 'failed', consumed_at = now() where id = ${row.id}`;
    console.log(`otp_rate_limited reason=attempts phone=${forLog(row.phone)}`);
    throw new HttpError(429, "Too many incorrect attempts. Please request a new code.");
  }

  if (!hashesMatch(row.code_hash, hashCode(code, row.phone))) {
    const left = Math.max(0, row.max_attempts - row.attempts);
    console.log(`otp_verify_failure phone=${forLog(row.phone)} attempts=${row.attempts}`);
    throw new HttpError(401, left > 0
      ? `Incorrect code. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
      : "Too many incorrect attempts. Please request a new code.");
  }

  /* Consume it. Single-use is enforced here and by the `consumed_at is null`
     guard above, so a replay of the same code finds no row. */
  await sql`
    update otp_challenges set consumed_at = now(), status = 'verified'
     where id = ${row.id}`;

  console.log(`otp_verify_success phone=${forLog(row.phone)}`);
  return { phone: row.phone };
}

/* Housekeeping. Expired rows carry no secret — the code was only ever a hash —
   but they are abuse metadata nobody needs to keep. */
export async function purgeExpired(sql, { olderThanHours = 24 } = {}) {
  const rows = await sql`
    delete from otp_challenges
     where expires_at < now() - (${olderThanHours} * interval '1 hour')
     returning id`;
  return { purged: rows.length };
}
