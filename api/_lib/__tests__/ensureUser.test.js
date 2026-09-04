import { describe, it, expect } from "vitest";
import { ensureUser, normalizePhone } from "../ensureUser.js";

/* ensureUser now runs a read-fast-path SELECT before the upsert (so the
   per-request cost is an indexed read, not an unconditional write). The
   fakes model that call sequence explicitly: call 0 is the SELECT (one
   interpolated value — the uid), later calls are upsert attempts. */

/* A fake `sql` tagged-template client: `selectRows` answers the SELECT,
   `returnRow` answers each upsert; all interpolated values are recorded so
   the token -> row mapping can be asserted without a real database. */
function fakeSql(selectRows, returnRow) {
  const calls = [];
  const tag = (_strings, ...values) => {
    calls.push(values);
    if (calls.length === 1) return Promise.resolve(selectRows);
    return Promise.resolve([returnRow(values)]);
  };
  tag.calls = calls;
  return tag;
}

describe("normalizePhone", () => {
  it("strips a leading +91 and blanks empty values", () => {
    expect(normalizePhone("+919876543210")).toBe("9876543210");
    expect(normalizePhone("9876543210")).toBe("9876543210");
    expect(normalizePhone("")).toBe(null);
    expect(normalizePhone(undefined)).toBe(null);
  });
});

describe("ensureUser", () => {
  it("maps token claims to the upsert (uid passthrough, phone normalized)", async () => {
    const sql = fakeSql([], ([firebase_uid, phone, name]) => ({ id: "u1", firebase_uid, phone, name }));
    const user = await ensureUser(sql, { sub: "fb-123", phone_number: "+919876543210", name: "Asha" });

    expect(user.firebase_uid).toBe("fb-123");
    expect(user.phone).toBe("9876543210");
    expect(user.name).toBe("Asha");
    // call 0 is the fast-path SELECT (uid only); call 1 the upsert
    expect(sql.calls[0]).toEqual(["fb-123"]);
    expect(sql.calls[1][0]).toBe("fb-123");
  });

  it("defaults missing phone/name to null", async () => {
    const sql = fakeSql([], ([firebase_uid, phone, name]) => ({ id: "u2", firebase_uid, phone, name }));
    const user = await ensureUser(sql, { sub: "fb-456" });
    expect(user.phone).toBe(null);
    expect(user.name).toBe(null);
  });

  it("throws when the token has no subject", async () => {
    const sql = fakeSql([], () => ({}));
    await expect(ensureUser(sql, {})).rejects.toThrow(/no subject/);
  });

  it("generates and passes an AgriOS User ID on every insert attempt", async () => {
    const sql = fakeSql([], ([firebase_uid, phone, name, agrios_user_id]) => ({ id: "u1", firebase_uid, phone, name, agrios_user_id }));
    const user = await ensureUser(sql, { sub: "fb-123" });
    expect(user.agrios_user_id).toMatch(/^AGRI-[0-9A-HJKMNP-TV-Z]{8}$/);
    // the upsert is call 1; its 4th interpolated value is the candidate id
    expect(sql.calls[1][3]).toBe(user.agrios_user_id);
  });
});

describe("ensureUser read fast-path", () => {
  const stored = { id: "u1", firebase_uid: "fb-123", phone: "9876543210", name: "Asha", agrios_user_id: "AGRI-AAAAAAAA" };

  it("returns the existing row with a single read when claims match", async () => {
    const sql = fakeSql([stored], () => { throw new Error("upsert must not run"); });
    const user = await ensureUser(sql, { sub: "fb-123", phone_number: "+919876543210", name: "Asha" });
    expect(user).toBe(stored);
    expect(sql.calls).toHaveLength(1);
  });

  it("treats null incoming claims as current (mirrors the upsert's coalesce)", async () => {
    /* The upsert would keep stored values for null claims, so the stored
       row already IS the post-upsert state — no write needed. */
    const sql = fakeSql([stored], () => { throw new Error("upsert must not run"); });
    const user = await ensureUser(sql, { sub: "fb-123" });
    expect(user).toBe(stored);
    expect(sql.calls).toHaveLength(1);
  });

  it("falls through to the upsert when a claim changed", async () => {
    const sql = fakeSql([stored], ([firebase_uid, phone, name]) => ({ ...stored, firebase_uid, phone, name }));
    const user = await ensureUser(sql, { sub: "fb-123", phone_number: "+919876543210", name: "Asha Devi" });
    expect(user.name).toBe("Asha Devi");
    expect(sql.calls).toHaveLength(2);
  });
});

/* A fake whose SELECT finds nothing and whose upserts throw for the first N
   attempts, so the retry-on-collision path can be exercised without a real
   database ever actually colliding. */
function flakySql(failures, err, returnRow) {
  const calls = [];
  let upserts = 0;
  const tag = (_strings, ...values) => {
    calls.push(values);
    if (calls.length === 1) return Promise.resolve([]); // the fast-path SELECT: no user yet
    if (upserts++ < failures) return Promise.reject(err);
    return Promise.resolve([returnRow(values)]);
  };
  tag.calls = calls;
  return tag;
}

describe("ensureUser retries a unique-violation on the generated id", () => {
  const collision = { code: "23505", message: "duplicate key value violates unique constraint \"users_agrios_user_id_unique\"" };

  it("retries with a fresh candidate and succeeds", async () => {
    const sql = flakySql(2, collision, ([firebase_uid, phone, name, agrios_user_id]) => ({ id: "u1", firebase_uid, phone, name, agrios_user_id }));
    const user = await ensureUser(sql, { sub: "fb-123" });
    expect(sql.calls).toHaveLength(4); // 1 select + 3 upsert attempts
    /* Each attempt generated its own candidate — the one that finally
       succeeded is whichever the last call happened to produce. */
    expect(user.agrios_user_id).toBe(sql.calls[3][3]);
    expect(sql.calls[1][3]).not.toBe(sql.calls[3][3]);
  });

  it("gives up after 5 attempts rather than retrying forever", async () => {
    const sql = flakySql(Infinity, collision, () => { throw new Error("unreachable"); });
    await expect(ensureUser(sql, { sub: "fb-123" })).rejects.toMatchObject({ code: "23505" });
    expect(sql.calls).toHaveLength(6); // 1 select + 5 upsert attempts
  });

  it("does not retry an error unrelated to the id collision", async () => {
    const other = { code: "23503", message: "foreign key violation" };
    const sql = flakySql(1, other, () => { throw new Error("unreachable"); });
    await expect(ensureUser(sql, { sub: "fb-123" })).rejects.toMatchObject({ code: "23503" });
    expect(sql.calls).toHaveLength(2); // 1 select + the single failed upsert
  });
});
