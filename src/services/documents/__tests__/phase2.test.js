import { describe, it, expect, beforeEach } from "vitest";
import { repo } from "../../erp/erpDb.js";
import { storage as local } from "../../../utils/storage.js";
import { documentService, storagePathFor } from "../documentService.js";
import { filterDocuments, facets, matches } from "../documentSearch.js";
import {
  isPending, uploadState, dueNow, queueSummary, UPLOAD_STATE, MAX_ATTEMPTS,
} from "../uploadQueue.js";

const docs = repo("documents");
const versions = repo("documentVersions");

const clear = async () => {
  for (const d of await docs.getAll()) await docs.purge(d.id);
  for (const v of await versions.getAll()) await versions.purge(v.id);
};
beforeEach(clear);

const pdf = (name = "a.pdf") =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });

describe("version history", () => {
  it("keeps the superseded file for record types where it matters", async () => {
    const d = await documentService.add(
      { subjectType: "owner", category: "land", title: "Plot 42" }, pdf("v1.pdf"));

    await documentService.replaceFile(d.id, pdf("v2.pdf"), { changeNote: "re-surveyed" });

    const v = await documentService.versions(d.id);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ version: 1, fileName: "v1.pdf", changeNote: "re-surveyed" });
    expect(v[0].fileData).toBeTruthy(); // the actual previous file, not just its name

    const now = await documentService.getById(d.id);
    expect(now.fileName).toBe("v2.pdf");
    expect(now.previousFileName).toBe("v1.pdf");
  });

  it("numbers versions in order across repeated replacements", async () => {
    const d = await documentService.add({ subjectType: "owner", category: "lease", title: "Lease" }, pdf("a.pdf"));
    await documentService.replaceFile(d.id, pdf("b.pdf"));
    await documentService.replaceFile(d.id, pdf("c.pdf"));

    const v = await documentService.versions(d.id);
    expect(v.map((x) => [x.version, x.fileName])).toEqual([[2, "b.pdf"], [1, "a.pdf"]]);
  });

  it("does not version routine records — a re-photographed soil card is churn", async () => {
    const d = await documentService.add({ subjectType: "owner", category: "soil", title: "Soil card" }, pdf("old.pdf"));
    await documentService.replaceFile(d.id, pdf("new.pdf"));
    expect(await documentService.versions(d.id)).toHaveLength(0);
    expect(documentService.isVersioned("soil")).toBe(false);
    expect(documentService.isVersioned("land")).toBe(true);
  });

  it("versions employment agreements, which are the employee-side equivalent", async () => {
    const d = await documentService.add(
      { subjectType: "employee", subjectId: "E1", category: "agreement", title: "Contract" }, pdf("2024.pdf"));
    await documentService.replaceFile(d.id, pdf("2025.pdf"));
    expect(await documentService.versions(d.id)).toHaveLength(1);
  });

  it("records nothing when the document had no file to supersede", async () => {
    const d = await documentService.add({ subjectType: "owner", category: "land", title: "Plot 42" });
    await documentService.replaceFile(d.id, pdf("first.pdf"));
    expect(await documentService.versions(d.id)).toHaveLength(0);
  });
});

describe("upload queue state", () => {
  it("treats a device-held file as owing the cloud an upload", () => {
    expect(isPending({ storage: "local", fileData: "data:..." })).toBe(true);
    expect(isPending({ storage: "pending" })).toBe(true);
  });

  it("ignores records with nothing to send", () => {
    expect(isPending({ storage: "cloud", fileUrl: "https://x" })).toBe(false);
    expect(isPending({ storage: "none" })).toBe(false);
    expect(isPending({ storage: "local", fileData: "x", deletedAt: "2026-01-01" })).toBe(false);
  });

  it("reports queued until the attempt ceiling, then failed", () => {
    const d = { storage: "local", fileData: "x" };
    expect(uploadState(d)).toBe(UPLOAD_STATE.QUEUED);
    expect(uploadState({ ...d, uploadAttempts: MAX_ATTEMPTS })).toBe(UPLOAD_STATE.FAILED);
    expect(uploadState({ storage: "cloud" })).toBe(UPLOAD_STATE.UPLOADED);
  });

  it("summarises what is waiting", async () => {
    await docs.add({ subjectType: "owner", category: "land", title: "A", storage: "local", fileData: "x" });
    await docs.add({ subjectType: "owner", category: "land", title: "B", storage: "local", fileData: "x", uploadAttempts: MAX_ATTEMPTS });
    await docs.add({ subjectType: "owner", category: "land", title: "C", storage: "cloud", fileUrl: "https://x" });

    expect(await queueSummary()).toEqual({ queued: 1, failed: 1, total: 2 });
  });

  it("backs off between attempts instead of retrying a file that will not move", () => {
    /* The ladder is in seconds now, not minutes: moving bytes between two
       places on the same device does not wait on a network, so a retry that
       is going to work will work almost immediately. */
    const now = Date.parse("2026-06-01T12:00:00Z");
    expect(dueNow({ uploadAttempts: 0 }, now)).toBe(true);
    /* One attempt a minute ago: the second try is long due. */
    expect(dueNow({ uploadAttempts: 1, lastAttemptAt: "2026-06-01T11:59:00Z" }, now)).toBe(true);
    /* Two attempts, ten seconds ago: the third waits thirty. */
    expect(dueNow({ uploadAttempts: 2, lastAttemptAt: "2026-06-01T11:59:50Z" }, now)).toBe(false);
    /* Past the ceiling it stops asking entirely. */
    expect(dueNow({ uploadAttempts: MAX_ATTEMPTS, lastAttemptAt: "2020-01-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("storage paths", () => {
  it("puts nothing user-supplied into the path", () => {
    const p = storagePathFor({
      ownerId: "UID1", subjectType: "owner", subjectId: "", category: "land", ext: "pdf",
    });
    expect(p).toMatch(/^users\/UID1\/documents\/owner\/land\/[a-zA-Z0-9]+\.pdf$/);
  });

  it("cannot be escaped by a malicious filename, because the name is never used", () => {
    const p = storagePathFor({
      ownerId: "UID1", subjectType: "employee", subjectId: "E1", category: "id_proof",
      ext: "pdf", fileName: "../../../other-user/steal",
    });
    expect(p).not.toContain("..");
    expect(p).toMatch(/^users\/UID1\/documents\/employee\/E1\/id_proof\//);
  });

  it("gives two uploads of the same file different paths", () => {
    const args = { ownerId: "U", subjectType: "owner", subjectId: "", category: "land", ext: "pdf" };
    expect(storagePathFor(args)).not.toBe(storagePathFor(args));
  });
});

describe("search and filter", () => {
  const list = [
    { id: "1", title: "Plot 42 record", category: "land", fileName: "plot42.pdf", note: "almirah", uploadDate: "2026-03-01", status: "verified", fileUrl: "u" },
    { id: "2", title: "KCC card", category: "kcc", fileName: "", uploadDate: "2026-05-01", status: "uploaded", expiryDate: "2020-01-01" },
    { id: "3", title: "Crop insurance", category: "insurance", fileName: "policy.pdf", uploadDate: "2026-01-01", status: "uploaded", fileData: "d", expiryDate: "2099-01-01" },
    { id: "4", title: "Deleted one", category: "land", uploadDate: "2026-06-01", deletedAt: "2026-06-02" },
  ];

  it("finds by title, file name and category — in any language", () => {
    expect(matches(list[0], "plot")).toBe(true);
    expect(matches(list[0], "plot42.pdf")).toBe(true);
    expect(matches(list[0], "land record")).toBe(true);
    expect(matches(list[0], "জমির")).toBe(true); // the category's Bengali name
    expect(matches(list[0], "tractor")).toBe(false);
  });

  it("matches all words in any order", () => {
    expect(matches(list[0], "42 plot")).toBe(true);
    expect(matches(list[0], "plot tractor")).toBe(false);
  });

  it("always hides soft-deleted records", () => {
    expect(filterDocuments(list).map((d) => d.id)).not.toContain("4");
  });

  it("filters by category, status, attachment and expiry", () => {
    expect(filterDocuments(list, { category: "kcc" }).map((d) => d.id)).toEqual(["2"]);
    expect(filterDocuments(list, { status: "verified" }).map((d) => d.id)).toEqual(["1"]);
    expect(filterDocuments(list, { hasFile: false }).map((d) => d.id)).toEqual(["2"]);
    expect(filterDocuments(list, { expiry: "expired" }).map((d) => d.id)).toEqual(["2"]);
    expect(filterDocuments(list, { expiry: "none" }).map((d) => d.id)).toEqual(["1"]);
  });

  it("filters by taxonomy group, not just exact category", () => {
    /* kcc is banking; land is farm. */
    expect(filterDocuments(list, { group: "banking" }).map((d) => d.id)).toEqual(["2"]);
  });

  it("sorts, putting the soonest expiry first and no-expiry last", () => {
    expect(filterDocuments(list, { sort: "recent" }).map((d) => d.id)).toEqual(["2", "1", "3"]);
    expect(filterDocuments(list, { sort: "oldest" }).map((d) => d.id)).toEqual(["3", "1", "2"]);
    expect(filterDocuments(list, { sort: "title" }).map((d) => d.id)).toEqual(["3", "2", "1"]);
    expect(filterDocuments(list, { sort: "expiry" }).map((d) => d.id)).toEqual(["2", "3", "1"]);
  });

  it("counts facets for the filter chips", () => {
    expect(facets(list)).toEqual({
      total: 3, withFile: 2, expired: 1, expiringSoon: 0, verified: 1,
    });
  });
});
