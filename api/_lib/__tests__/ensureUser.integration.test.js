/* ensureUser() against a real Postgres engine (PGlite) — the fake-sql tests
   in ensureUser.test.js prove the JS-level retry and argument-passing logic,
   but only a real database can prove the upsert's ON CONFLICT semantics
   actually hold: that an existing user's id survives, that a fresh id is
   truly unique, and that the database — not just the application — refuses
   two rows with the same one. */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { ensureUser } from "../ensureUser.js";

let db, sql;

function makeSql(pg) {
  const run = async (strings, ...values) => {
    let text = "";
    const params = [];
    strings.forEach((chunk, i) => {
      text += chunk;
      if (i < values.length) { params.push(values[i]); text += `$${params.length}`; }
    });
    return (await pg.query(text, params)).rows;
  };
  return run;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL("../../../supabase/migrations/0001_commerce_foundation.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../../supabase/migrations/0002_farm_space.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../../supabase/migrations/0007_agrios_user_id.sql", import.meta.url), "utf8"));
  sql = makeSql(db);
}, 40000);

beforeEach(async () => {
  await db.exec("truncate users restart identity cascade");
});

describe("ensureUser against a real database", () => {
  it("gives a brand new user a valid, unique-in-the-database id", async () => {
    const user = await ensureUser(sql, { sub: "fb-1", name: "Asha" });
    expect(user.agrios_user_id).toMatch(/^AGRI-[0-9A-HJKMNP-TV-Z]{8}$/);

    const [row] = await sql`select agrios_user_id from users where firebase_uid = ${"fb-1"}`;
    expect(row.agrios_user_id).toBe(user.agrios_user_id);
  });

  it("keeps the same id across repeat calls, even as phone and name change", async () => {
    const first = await ensureUser(sql, { sub: "fb-2", name: "Raju", phone_number: "+919000000001" });
    const second = await ensureUser(sql, { sub: "fb-2", name: "Raju Kumar", phone_number: "+919000000002" });

    expect(second.agrios_user_id, "the id must not move when the profile changes").toBe(first.agrios_user_id);
    expect(second.name).toBe("Raju Kumar");
    expect(second.phone).toBe("9000000002");
  });

  it("never gives two different users the same id", async () => {
    const ids = new Set();
    for (let i = 0; i < 30; i++) {
      const user = await ensureUser(sql, { sub: `fb-many-${i}`, name: `User ${i}` });
      ids.add(user.agrios_user_id);
    }
    expect(ids.size, "30 distinct users, 30 distinct ids").toBe(30);
  });

  it("the database itself refuses a duplicate id, not just the application", async () => {
    const user = await ensureUser(sql, { sub: "fb-3", name: "Priya" });

    await expect(sql`
      insert into users (firebase_uid, name, agrios_user_id)
      values ('fb-4', 'Someone Else', ${user.agrios_user_id})
    `).rejects.toMatchObject({ code: "23505" });
  });
});
