import { describe, it, expect, vi, beforeEach } from "vitest";

/* Brief §19: a deleted document must stop consuming storage.

   The catch is that deletes are SOFT so they can be undone, and a restore is
   worthless if the file was destroyed the moment the row was deleted. So the
   file outlives the delete by a retention window, and a sweep destroys it
   afterwards. These tests pin both halves: nothing is lost early, nothing is
   kept forever. */

const deleted = [];
vi.mock("../../firebase/storage.js", () => ({
  deleteImage: (path) => { deleted.push(path); return Promise.resolve(); },
  uploadFileResumable: (path) => ({ promise: Promise.resolve(`https://s/${path}`), cancel() {} }),
  uploadImage: () => Promise.resolve("https://s/x"),
}));

const { repo } = await import("../../erp/erpDb.js");
const { documentService } = await import("../documentService.js");

const docs = repo("documents");
const versions = repo("documentVersions");

const DAY = 86400000;
const cloudDoc = (over = {}) => ({
  subjectType: "owner", category: "land", title: "Plot 42",
  storage: "cloud", storagePath: "users/U1/documents/owner/land/abc.pdf",
  fileUrl: "https://s/abc.pdf", fileName: "deed.pdf", uploadDate: "2026-01-01",
  ...over,
});

beforeEach(async () => {
  deleted.length = 0;
  for (const d of [...(await docs.getAll()), ...(await docs.deleted())]) await docs.purge(d.id);
  for (const v of await versions.getAll()) await versions.purge(v.id);
});

describe("soft delete keeps the file", () => {
  it("does not touch storage when a document is deleted", async () => {
    const d = await docs.add(cloudDoc());
    await documentService.remove(d.id);

    expect(deleted, "the file must survive the retention window").toEqual([]);
    expect(await documentService.getById(d.id)).toBe(null); // hidden from the app
  });

  it("restores a deleted document, file intact", async () => {
    const d = await docs.add(cloudDoc());
    await documentService.remove(d.id);

    const back = await documentService.restore(d.id);
    expect(back).toMatchObject({ title: "Plot 42", fileUrl: "https://s/abc.pdf" });
    expect(await documentService.getById(d.id)).toBeTruthy();
    expect(deleted).toEqual([]);
  });
});

describe("purge frees storage", () => {
  it("destroys the file and the row", async () => {
    const d = await docs.add(cloudDoc());
    const r = await documentService.purge(d.id);

    expect(deleted).toEqual(["users/U1/documents/owner/land/abc.pdf"]);
    expect(r).toMatchObject({ filesDeleted: 1 });
    expect(await documentService.getById(d.id)).toBe(null);
    expect((await docs.deleted()).find((x) => x.id === d.id)).toBeUndefined();
  });

  it("also destroys superseded version files, which nothing else would ever reach", async () => {
    const d = await docs.add(cloudDoc());
    await versions.add({ documentId: d.id, version: 1, storagePath: "users/U1/.../v1.pdf", fileName: "v1.pdf" });
    await versions.add({ documentId: d.id, version: 2, storagePath: "users/U1/.../v2.pdf", fileName: "v2.pdf" });

    const r = await documentService.purge(d.id);

    expect(deleted.sort()).toEqual([
      "users/U1/.../v1.pdf", "users/U1/.../v2.pdf", "users/U1/documents/owner/land/abc.pdf",
    ].sort());
    expect(r.versions).toBe(2);
    expect(await versions.getBy("documentId", d.id)).toHaveLength(0);
  });

  it("purges an already soft-deleted document", async () => {
    const d = await docs.add(cloudDoc());
    await documentService.remove(d.id);
    const r = await documentService.purge(d.id);
    expect(r.filesDeleted).toBe(1);
    expect(deleted).toHaveLength(1);
  });

  it("removes the row even when the file cannot be deleted", async () => {
    /* Offline, or an object already gone. A file we cannot reach is a smaller
       problem than a row that never goes away. */
    const d = await docs.add(cloudDoc({ storagePath: "boom" }));
    const mod = await import("../../firebase/storage.js");
    const spy = vi.spyOn(mod, "deleteImage").mockRejectedValueOnce(new Error("offline"));

    await documentService.purge(d.id);
    expect(await documentService.getById(d.id)).toBe(null);
    spy.mockRestore();
  });

  it("handles a document with no stored file", async () => {
    const d = await docs.add({ subjectType: "owner", category: "bank", title: "Passbook", storage: "none" });
    const r = await documentService.purge(d.id);
    expect(r.filesDeleted).toBe(0);
    expect(deleted).toEqual([]);
  });
});

describe("retention sweep", () => {
  const now = Date.parse("2026-06-01T00:00:00Z");

  it("leaves recent deletions alone", async () => {
    const d = await docs.add(cloudDoc());
    await docs.remove(d.id);
    await docs.update(d.id, {}); // no-op; keeps deletedAt as stamped
    const tomb = (await docs.deleted()).find((x) => x.id === d.id);
    expect(tomb.deletedAt).toBeTruthy();

    const r = await documentService.purgeExpiredDeletions({ now: Date.parse(tomb.deletedAt) + DAY });
    expect(r.purged).toBe(0);
    expect(deleted).toEqual([]);
  });

  it("destroys files for deletions past the window", async () => {
    const d = await docs.add(cloudDoc());
    await docs.remove(d.id);
    const tomb = (await docs.deleted()).find((x) => x.id === d.id);

    const r = await documentService.purgeExpiredDeletions({
      now: Date.parse(tomb.deletedAt) + 31 * DAY,
    });
    expect(r).toMatchObject({ purged: 1, filesDeleted: 1 });
    expect(deleted).toHaveLength(1);
    expect((await docs.deleted()).find((x) => x.id === d.id)).toBeUndefined();
  });

  it("honours a shorter configured window", async () => {
    const d = await docs.add(cloudDoc());
    await docs.remove(d.id);
    const tomb = (await docs.deleted()).find((x) => x.id === d.id);

    const r = await documentService.purgeExpiredDeletions({
      now: Date.parse(tomb.deletedAt) + 2 * DAY, retentionDays: 1,
    });
    expect(r.purged).toBe(1);
  });

  it("never touches live documents", async () => {
    const live = await docs.add(cloudDoc({ title: "Keep me" }));
    const gone = await docs.add(cloudDoc({ title: "Bin me" }));
    await docs.remove(gone.id);
    const tomb = (await docs.deleted()).find((x) => x.id === gone.id);

    await documentService.purgeExpiredDeletions({ now: Date.parse(tomb.deletedAt) + 99 * DAY });

    expect(await documentService.getById(live.id)).toBeTruthy();
    expect(deleted).toHaveLength(1);
  });

  it("is safe to run when nothing is due", async () => {
    expect(await documentService.purgeExpiredDeletions({ now })).toEqual({ purged: 0, filesDeleted: 0 });
  });
});

describe("listDeleted — what the restore UI shows", () => {
  it("lists deleted documents with the days they have left", async () => {
    const d = await docs.add(cloudDoc());
    await docs.remove(d.id);
    const tomb = (await docs.deleted()).find((x) => x.id === d.id);

    const [row] = await documentService.listDeleted("owner", {
      now: Date.parse(tomb.deletedAt) + 3 * DAY,
    });
    expect(row).toMatchObject({ id: d.id, title: "Plot 42" });
    expect(row.daysLeft).toBe(27); // 30-day window, deleted 3 days ago
  });

  it("hides anything already past the window, since restoring it would be a promise the next sweep breaks", async () => {
    const d = await docs.add(cloudDoc());
    await docs.remove(d.id);
    const tomb = (await docs.deleted()).find((x) => x.id === d.id);

    const late = await documentService.listDeleted("owner", {
      now: Date.parse(tomb.deletedAt) + 31 * DAY,
    });
    expect(late).toEqual([]);
  });

  it("never includes live documents", async () => {
    await docs.add(cloudDoc({ title: "Still here" }));
    expect(await documentService.listDeleted("owner")).toEqual([]);
  });

  it("separates subjects, so a worker's deleted ID does not appear in the farmer's list", async () => {
    const own = await docs.add(cloudDoc({ title: "Mine" }));
    const emp = await docs.add(cloudDoc({ subjectType: "employee", subjectId: "E1", title: "Theirs" }));
    await docs.remove(own.id); await docs.remove(emp.id);

    expect((await documentService.listDeleted("owner")).map((d) => d.title)).toEqual(["Mine"]);
    expect((await documentService.listDeleted("employee")).map((d) => d.title)).toEqual(["Theirs"]);
    expect(await documentService.listDeleted()).toHaveLength(2); // no filter = everything
  });
});
