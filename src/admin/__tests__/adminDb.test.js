import { describe, it, expect } from "vitest";
import { openDb, uid, repo } from "../adminDb.js";

describe("adminDb", () => {
  it("generates unique ids", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it("opens the database", async () => {
    const db = await openDb();
    expect(db.name).toBe("agrios-admin");
  });

  it("repo CRUD works", async () => {
    const r = repo("auditLogs");
    const rec = await r.add({ action: "test", entity: "unit" });
    expect(rec.id).toBeTruthy();
    expect(rec.action).toBe("test");

    const all = await r.getAll();
    expect(all.length).toBeGreaterThanOrEqual(1);

    const found = await r.getById(rec.id);
    expect(found.entity).toBe("unit");

    const updated = await r.update(rec.id, { entity: "updated" });
    expect(updated.entity).toBe("updated");

    await r.remove(rec.id);
    const gone = await r.getById(rec.id);
    expect(gone).toBeNull();
  });
});
