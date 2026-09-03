import { describe, it, expect } from "vitest";
import { ensureUser, normalizePhone } from "../ensureUser.js";

/* A fake `sql` tagged-template client: records the interpolated values and
   returns a canned row echoing them, so we can assert the token -> row mapping
   without a real database. */
function fakeSql(returnRow) {
  const calls = [];
  const tag = (_strings, ...values) => {
    calls.push(values);
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
    const sql = fakeSql(([firebase_uid, phone, name]) => ({ id: "u1", firebase_uid, phone, name }));
    const user = await ensureUser(sql, { sub: "fb-123", phone_number: "+919876543210", name: "Asha" });

    expect(user.firebase_uid).toBe("fb-123");
    expect(user.phone).toBe("9876543210");
    expect(user.name).toBe("Asha");
    // first interpolated value is the uid
    expect(sql.calls[0][0]).toBe("fb-123");
  });

  it("defaults missing phone/name to null", async () => {
    const sql = fakeSql(([firebase_uid, phone, name]) => ({ id: "u2", firebase_uid, phone, name }));
    const user = await ensureUser(sql, { sub: "fb-456" });
    expect(user.phone).toBe(null);
    expect(user.name).toBe(null);
  });

  it("throws when the token has no subject", async () => {
    const sql = fakeSql(() => ({}));
    await expect(ensureUser(sql, {})).rejects.toThrow(/no subject/);
  });

  it("generates and passes an AgriOS User ID on every insert attempt", async () => {
    const sql = fakeSql(([firebase_uid, phone, name, agrios_user_id]) => ({ id: "u1", firebase_uid, phone, name, agrios_user_id }));
    const user = await ensureUser(sql, { sub: "fb-123" });
    expect(user.agrios_user_id).toMatch(/^AGRI-[0-9A-HJKMNP-TV-Z]{8}$/);
    // the 4th interpolated value is the candidate id
    expect(sql.calls[0][3]).toBe(user.agrios_user_id);
  });
});

/* A fake that throws on its first N calls, so the retry-on-collision path can
   be exercised without a real database ever actually colliding. */
function flakySql(failures, err, returnRow) {
  const calls = [];
  let n = 0;
  const tag = (_strings, ...values) => {
    calls.push(values);
    if (n++ < failures) return Promise.reject(err);
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
    expect(sql.calls).toHaveLength(3);
    /* Each attempt generated its own candidate — the one that finally
       succeeded is whichever the third call happened to produce. */
    expect(user.agrios_user_id).toBe(sql.calls[2][3]);
    expect(sql.calls[0][3]).not.toBe(sql.calls[2][3]);
  });

  it("gives up after 5 attempts rather than retrying forever", async () => {
    const sql = flakySql(Infinity, collision, () => { throw new Error("unreachable"); });
    await expect(ensureUser(sql, { sub: "fb-123" })).rejects.toMatchObject({ code: "23505" });
    expect(sql.calls).toHaveLength(5);
  });

  it("does not retry an error unrelated to the id collision", async () => {
    const other = { code: "23503", message: "foreign key violation" };
    const sql = flakySql(1, other, () => { throw new Error("unreachable"); });
    await expect(ensureUser(sql, { sub: "fb-123" })).rejects.toMatchObject({ code: "23503" });
    expect(sql.calls).toHaveLength(1);
  });
});
