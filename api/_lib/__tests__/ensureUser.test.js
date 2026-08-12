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
});
