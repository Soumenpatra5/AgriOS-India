import { describe, it, expect, vi, beforeEach } from "vitest";

/* Brief §29: metadata and stored file must not drift apart.

   The dangerous half is "file stored, metadata write failed": the bytes are
   sitting in the device's file system and nothing in the app will ever
   reference them again, so nothing will ever clean them up either. This proves
   the write is rolled back when the row cannot be saved.

   The other half — metadata written, file not stored — is not an orphan at
   all: the record is complete and readable from its inline copy, and the
   migration sweep moves it later. That path is covered in phase2.test.js.

   Documents live on the device now, so the store being exercised here is OPFS
   rather than Firebase Storage. The test environment has no file system, so
   fileStore is mocked to make the device branch reachable at all. */

const written = [];
const removed = [];

vi.mock("../fileStore.js", () => ({
  available: () => Promise.resolve(true),
  put: (_blob, ext) => {
    const key = `key${written.length + 1}${ext ? `.${ext}` : ""}`;
    written.push(key);
    return Promise.resolve(key);
  },
  get: () => Promise.resolve(null),
  remove: (key) => { removed.push(key); return Promise.resolve(true); },
  has: () => Promise.resolve(false),
  usage: () => Promise.resolve({ files: 0, bytes: 0 }),
  pruneOrphans: () => Promise.resolve(0),
  newKey: () => "key",
}));

/* Make the metadata write fail, leaving everything else real. */
let failAdd = false;
vi.mock("../../erp/erpDb.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    repo: (name, opts) => {
      const real = actual.repo(name, opts);
      if (name !== "documents") return real;
      return { ...real, add: (d) => (failAdd ? Promise.reject(new Error("quota exceeded")) : real.add(d)) };
    },
  };
});

const { documentService } = await import("../documentService.js");

const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "deed.pdf", { type: "application/pdf" });

beforeEach(() => {
  written.length = 0; removed.length = 0; failAdd = false;
});

describe("orphaned document files", () => {
  it("deletes the stored file when the metadata row cannot be written", async () => {
    failAdd = true;

    await expect(
      documentService.add({ subjectType: "owner", category: "land", title: "Plot 42" }, pdf())
    ).rejects.toThrow("quota exceeded");

    expect(written, "the file did reach the device store").toHaveLength(1);
    expect(removed, "and was cleaned up again").toEqual(written);
  });

  it("keeps the file when the metadata row is written successfully", async () => {
    const saved = await documentService.add(
      { subjectType: "owner", category: "land", title: "Plot 42" }, pdf());

    expect(saved.storage).toBe("device");
    expect(saved.fileKey).toBe(written[0]);
    expect(saved.fileData, "no inline copy once the file store has it").toBe("");
    expect(removed).toEqual([]);
  });
});
