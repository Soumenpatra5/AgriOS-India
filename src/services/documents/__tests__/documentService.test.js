import { describe, it, expect, beforeEach } from "vitest";
import { repo } from "../../erp/erpDb.js";
import { storage as local } from "../../../utils/storage.js";
import {
  documentService, categoriesFor, categoryOf, expiryState, migrateOnce, _resetMigrationForTests,
} from "../documentService.js";

const docs = repo("documents");
const clear = async () => {
  for (const d of await docs.getAll()) await docs.purge(d.id);
};

beforeEach(clear);

describe("categories", () => {
  it("keeps every category the two old modules offered", () => {
    const ids = categoriesFor("owner").map((c) => c.id);
    /* The originals from the farmer's Documents screen — none may disappear. */
    for (const id of ["land", "kcc", "insurance", "soil", "bank", "other"]) {
      expect(ids, id).toContain(id);
    }
    const emp = categoriesFor("employee").map((c) => c.id);
    for (const id of ["id_proof", "bank_proof", "medical", "agreement", "other"]) {
      expect(emp, id).toContain(id);
    }
  });

  it("does not offer employee categories to the farmer, or vice versa", () => {
    expect(categoriesFor("owner").map((c) => c.id)).not.toContain("medical");
    expect(categoriesFor("employee").map((c) => c.id)).not.toContain("kcc");
  });

  it("falls back to Other for an unknown category", () => {
    expect(categoryOf("nonsense").id).toBe("other");
  });
});

describe("add", () => {
  it("stores an owner document with no file", async () => {
    const d = await documentService.add({
      subjectType: "owner", category: "land", title: "Plot 42", note: "in the almirah",
    });
    expect(d).toMatchObject({
      subjectType: "owner", subjectId: "", category: "land",
      title: "Plot 42", storage: "none", status: "uploaded",
    });
  });

  it("titles a document from its category when none is given", async () => {
    const d = await documentService.add({ subjectType: "owner", category: "kcc" });
    expect(d.title).toBe("Kisan Credit Card");
  });

  it("keeps owner and employee documents in one store but separate lists", async () => {
    await documentService.add({ subjectType: "owner", category: "land", title: "Plot 42" });
    await documentService.add({ subjectType: "employee", subjectId: "E1", category: "id_proof", title: "Aadhaar" });
    await documentService.add({ subjectType: "employee", subjectId: "E2", category: "medical", title: "Fitness" });

    expect(await documentService.all()).toHaveLength(3);
    expect((await documentService.list("owner")).map((d) => d.title)).toEqual(["Plot 42"]);
    expect((await documentService.list("employee", "E1")).map((d) => d.title)).toEqual(["Aadhaar"]);
    expect(await documentService.list("employee")).toHaveLength(2);
  });
});

describe("expiry", () => {
  const ref = "2026-06-01";
  it("classifies valid, expiring and expired", () => {
    expect(expiryState({}, ref)).toBe("valid");
    expect(expiryState({ expiryDate: "2026-05-01" }, ref)).toBe("expired");
    expect(expiryState({ expiryDate: "2026-06-10" }, ref)).toBe("expiring_soon");
    expect(expiryState({ expiryDate: "2027-01-01" }, ref)).toBe("valid");
  });

  it("summarises across BOTH subjects — a farmer's expired land record counts", async () => {
    await documentService.add({ subjectType: "owner", category: "land", title: "Lease", expiryDate: "2000-01-01" });
    await documentService.add({ subjectType: "employee", subjectId: "E1", category: "id_proof", title: "DL", expiryDate: "2000-01-01" });
    const s = await documentService.expirySummary();
    expect(s.expired.map((d) => d.title).sort()).toEqual(["DL", "Lease"]);
  });
});

describe("lifecycle", () => {
  it("verifies and stamps a date", async () => {
    const d = await documentService.add({ subjectType: "owner", category: "land", title: "Plot 42" });
    await documentService.setStatus(d.id, "verified");
    const after = await documentService.getById(d.id);
    expect(after.status).toBe("verified");
    expect(after.verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("soft-deletes so the record stays recoverable and auditable", async () => {
    const d = await documentService.add({ subjectType: "owner", category: "land", title: "Plot 42" });
    await documentService.remove(d.id);
    expect(await documentService.getById(d.id)).toBe(null);
    expect(await documentService.list("owner")).toHaveLength(0);
    await docs.restore(d.id);
    expect(await documentService.getById(d.id)).toBeTruthy();
  });
});

describe("migration from the two legacy stores", () => {
  const flag = "docs:migrated:v1";

  beforeEach(async () => {
    /* Earlier tests already ran (and memoised) the migration, so both the flag
       and the in-process memo have to be cleared for these to mean anything. */
    _resetMigrationForTests();
    local.remove(flag);
    local.remove("docs:list");
    for (const r of await repo("employeeDocuments").getAll()) {
      await repo("employeeDocuments").purge(r.id);
    }
  });

  it("carries employee documents over with their fields and ids intact", async () => {
    await repo("employeeDocuments").add({
      employeeId: "E9", type: "id_proof", name: "Aadhaar", number: "1234",
      expiryDate: "2030-01-01", status: "verified", fileName: "a.pdf",
      mimeType: "application/pdf", storage: "cloud", fileUrl: "https://x/y",
    });
    const [legacy] = await repo("employeeDocuments").getAll();

    await migrateOnce();

    const moved = await documentService.getById(legacy.id);
    expect(moved).toMatchObject({
      subjectType: "employee", subjectId: "E9", category: "id_proof",
      title: "Aadhaar", number: "1234", status: "verified",
      fileName: "a.pdf", storage: "cloud", fileUrl: "https://x/y",
    });
  });

  it("carries the farmer's localStorage list over, files and all (there were none)", async () => {
    local.set("docs:list", [
      { id: "abc", type: "land", title: "Plot 42", note: "almirah", ts: 1700000000000 },
      { id: "def", type: "kcc", title: "KCC", note: "", ts: 1700000000001 },
    ]);

    await migrateOnce();

    const list = await documentService.list("owner");
    expect(list.map((d) => d.title).sort()).toEqual(["KCC", "Plot 42"]);
    expect(await documentService.getById("abc")).toMatchObject({
      subjectType: "owner", category: "land", note: "almirah", storage: "none",
    });
  });

  it("never duplicates when run twice, and leaves the legacy data in place", async () => {
    local.set("docs:list", [{ id: "abc", type: "land", title: "Plot 42", ts: 1 }]);
    await repo("employeeDocuments").add({ employeeId: "E9", type: "medical", name: "Fitness" });

    await migrateOnce();
    const first = (await documentService.all()).length;

    /* Re-arm the flag to simulate a migration that was interrupted before it
       could record completion — the id-preserving upsert must make it safe. */
    local.remove(flag);
    _resetMigrationForTests();
    await migrateOnce();

    expect((await documentService.all()).length).toBe(first);
    expect(await repo("employeeDocuments").getAll()).toHaveLength(1); // originals untouched
    expect(local.get("docs:list")).toHaveLength(1);
  });
});
