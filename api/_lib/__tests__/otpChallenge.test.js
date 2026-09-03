/* OTP challenge lifecycle — the security core of phone sign-in.

   Real Postgres via PGlite with the real migration, as with the Farm Space
   suites. These are the cases where a mistake is an account takeover rather
   than a bug, so they are written from the attacker's side: replay it, guess
   it, race it, read it out of the table, keep an old one alive after a resend. */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { toCanonical, toE164, forDisplay, forLog } from "../otp/phone.js";
import {
  createChallenge, verifyChallenge, issuanceState, generateCode, hashCode,
  purgeExpired, otpConfig,
} from "../otp/challenge.js";

let db, sql;

function makeSql(pg) {
  const run = async (strings, ...values) => {
    let text = ""; const params = [];
    strings.forEach((chunk, i) => {
      text += chunk;
      if (i < values.length) { params.push(values[i]); text += `$${params.length}`; }
    });
    return (await pg.query(text, params)).rows;
  };
  run.begin = async (fn) => {
    await pg.exec("begin");
    try { const out = await fn(run); await pg.exec("commit"); return out; }
    catch (err) { await pg.exec("rollback"); throw err; }
  };
  return run;
}

const mig = (n) => new URL(`../../../supabase/migrations/${n}`, import.meta.url);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(mig("0001_commerce_foundation.sql"), "utf8"));
  await db.exec(await readFile(mig("0006_otp_challenges.sql"), "utf8"));
  sql = makeSql(db);
}, 40000);

const PHONE = "9876543210";

beforeEach(async () => {
  await db.exec("truncate otp_challenges restart identity cascade");
  process.env.OTP_PEPPER = "test-pepper-at-least-16-chars";
  delete process.env.OTP_TTL_SECONDS;
  delete process.env.OTP_MAX_ATTEMPTS;
  delete process.env.OTP_RESEND_COOLDOWN_SECONDS;
});

async function statusOf(fn) {
  try { await fn(); return 200; } catch (e) { return e?.status ?? 500; }
}

/* ── phone normalisation ─────────────────────────────────────────────────── */

describe("phone normalisation", () => {
  it("accepts what a person actually types", () => {
    for (const raw of ["9876543210", "+91 98765 43210", "098765-43210", "919876543210", " +919876543210 "]) {
      expect(toCanonical(raw), raw).toBe("9876543210");
    }
  });

  it("rejects anything that is not an Indian mobile", () => {
    /* Landlines, short numbers and junk must be refused before a message is
       paid for. Indian mobiles start 6-9. */
    for (const raw of ["1234567890", "5876543210", "98765", "abcdefghij", "", null, undefined]) {
      expect(toCanonical(raw), String(raw)).toBeNull();
    }
  });

  it("adds +91 only at the provider boundary", () => {
    expect(toE164("9876543210")).toBe("+919876543210");
    expect(toE164("+91 98765 43210")).toBe("+919876543210");
    expect(toE164("nonsense")).toBeNull();
  });

  it("never puts a whole number in a log line", () => {
    expect(forLog(PHONE)).toBe("••••••3210");
    expect(forLog(PHONE)).not.toContain("9876");
    expect(forDisplay(PHONE)).toBe("98765 43210");
  });
});

/* ── the code itself ─────────────────────────────────────────────────────── */

describe("code generation and storage", () => {
  it("is always six digits, including leading zeros", () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("never stores the code, only a peppered hash", async () => {
    const { code } = await createChallenge(sql, { phone: PHONE, channel: "whatsapp", ip: "1.2.3.4" });
    const [row] = await sql`select * from otp_challenges limit 1`;

    /* The table must not contain the code in any column. */
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds the hash to the phone, so it cannot be replayed onto another number", () => {
    const a = hashCode("123456", "9876543210");
    const b = hashCode("123456", "9000000001");
    expect(a).not.toBe(b);
  });

  it("is useless without the pepper", () => {
    const withOne = hashCode("123456", PHONE);
    process.env.OTP_PEPPER = "a-different-pepper-16-chars";
    expect(hashCode("123456", PHONE)).not.toBe(withOne);
  });

  it("refuses to run at all without a pepper", () => {
    /* Falling back to an unpeppered hash would silently downgrade the scheme,
       so a missing pepper is a loud configuration error. */
    delete process.env.OTP_PEPPER;
    expect(() => hashCode("123456", PHONE)).toThrow();
    process.env.OTP_PEPPER = "short";
    expect(() => hashCode("123456", PHONE)).toThrow();
  });

  it("hashes the IP rather than storing it", async () => {
    await createChallenge(sql, { phone: PHONE, channel: "whatsapp", ip: "203.0.113.9" });
    const [row] = await sql`select ip_hash from otp_challenges limit 1`;
    expect(row.ip_hash).toBeTruthy();
    expect(row.ip_hash).not.toContain("203.0.113.9");
  });
});

/* ── verification ────────────────────────────────────────────────────────── */

describe("verifying a code", () => {
  it("accepts the right code once", async () => {
    const c = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    const out = await verifyChallenge(sql, { challengeId: c.id, code: c.code });
    expect(out.phone).toBe(PHONE);
  });

  it("refuses the same code a second time", async () => {
    const c = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    await verifyChallenge(sql, { challengeId: c.id, code: c.code });
    /* Replay is the attack this single-use rule exists for. */
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: c.code }))).toBe(401);
  });

  it("refuses a wrong code and counts the attempt", async () => {
    const c = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: "000000" }))).toBe(401);
    const [row] = await sql`select attempts from otp_challenges where id = ${c.id}`;
    expect(row.attempts).toBe(1);
  });

  it("locks the challenge after the attempt limit", async () => {
    process.env.OTP_MAX_ATTEMPTS = "3";
    const c = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });

    for (let i = 0; i < 3; i++) {
      expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: "000000" }))).toBe(401);
    }
    /* The next guess is refused as rate-limited, and the RIGHT code no longer
       works either — otherwise the limit would only slow an attacker down. */
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: "000000" }))).toBe(429);
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: c.code }))).toBe(401);
  });

  it("refuses an expired code", async () => {
    const c = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    await sql`update otp_challenges set expires_at = now() - interval '1 minute' where id = ${c.id}`;
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: c.code }))).toBe(401);
  });

  it("invalidates the previous code when a new one is issued", async () => {
    const first = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    const second = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });

    /* A farmer who taps resend must not be left with two working codes, and an
       attacker must not be able to use the older message. */
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: first.id, code: first.code }))).toBe(401);
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: second.id, code: second.code }))).toBe(200);
  });

  it("rejects a malformed code before touching the database", async () => {
    const c = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    for (const bad of ["12345", "1234567", "abcdef", "", null, "12 34 56"]) {
      expect(await statusOf(() => verifyChallenge(sql, { challengeId: c.id, code: bad })), String(bad)).toBe(400);
    }
    const [row] = await sql`select attempts from otp_challenges where id = ${c.id}`;
    expect(row.attempts, "a malformed code must not spend an attempt").toBe(0);
  });

  it("refuses an unknown challenge id with the same message as a used one", async () => {
    expect(await statusOf(() => verifyChallenge(sql,
      { challengeId: "00000000-0000-0000-0000-000000000000", code: "123456" }))).toBe(401);
  });

  it("cannot be verified with another phone's challenge", async () => {
    const mine = await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    const theirs = await createChallenge(sql, { phone: "9000000001", channel: "whatsapp" });
    /* Their code against my challenge must fail even if both are live. */
    expect(await statusOf(() => verifyChallenge(sql, { challengeId: mine.id, code: theirs.code }))).toBe(401);
  });
});

/* ── issuance limits ─────────────────────────────────────────────────────── */

describe("resend cooldown and hourly cap", () => {
  it("reports a cooldown right after a request", async () => {
    await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    const state = await issuanceState(sql, PHONE);
    expect(state.cooldownRemainingMs).toBeGreaterThan(0);
    expect(state.overHourlyCap).toBe(false);
  });

  it("reports no cooldown for a number that has never asked", async () => {
    const state = await issuanceState(sql, "9000000009");
    expect(state.cooldownRemainingMs).toBe(0);
    expect(state.inLastHour).toBe(0);
  });

  it("flags the hourly cap once it is reached", async () => {
    for (let i = 0; i < otpConfig().maxPerPhonePerHour; i++) {
      await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    }
    expect((await issuanceState(sql, PHONE)).overHourlyCap).toBe(true);
    /* Another number is unaffected — the limit is per phone, not global. */
    expect((await issuanceState(sql, "9000000002")).overHourlyCap).toBe(false);
  });
});

/* ── input validation ────────────────────────────────────────────────────── */

describe("issuing rejects bad input", () => {
  it("refuses an invalid number or channel", async () => {
    expect(await statusOf(() => createChallenge(sql, { phone: "12345", channel: "whatsapp" }))).toBe(400);
    expect(await statusOf(() => createChallenge(sql, { phone: PHONE, channel: "pigeon" }))).toBe(400);
    expect(await statusOf(() => createChallenge(sql, { phone: PHONE, channel: "whatsapp" }))).toBe(200);
  });

  it("stores the canonical ten digits whatever was typed", async () => {
    await createChallenge(sql, { phone: "+91 98765 43210", channel: "whatsapp" });
    const [row] = await sql`select phone from otp_challenges limit 1`;
    /* Ten digits, matching users.phone and Farm Space invitations. */
    expect(row.phone).toBe("9876543210");
  });
});

describe("housekeeping", () => {
  it("purges old challenges", async () => {
    await createChallenge(sql, { phone: PHONE, channel: "whatsapp" });
    await sql`update otp_challenges set expires_at = now() - interval '48 hours'`;
    expect((await purgeExpired(sql)).purged).toBe(1);
    expect(await sql`select id from otp_challenges`).toEqual([]);
  });
});
