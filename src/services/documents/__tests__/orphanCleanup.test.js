import { describe, it, expect, vi, beforeEach } from "vitest";

/* Brief §29: metadata and stored file must not drift apart.

   The dangerous half is "upload succeeded, metadata write failed": the bytes
   are sitting in the farmer's storage quota and nothing in the app will ever
   reference them again, so nothing will ever clean them up either. This proves
   the upload is rolled back when the row cannot be written.

   The other half — metadata written, upload failed — is not an orphan at all:
   the record is complete and readable, its file is on the device, and
   uploadQueue retries it. That path is covered in phase2.test.js. */

const deleted = [];
const uploaded = [];

vi.mock("../../firebase/storage.js", () => ({
  uploadFileResumable: (path) => {
    uploaded.push(path);
    return { promise: Promise.resolve(`https://storage.example/${path}`), cancel() {} };
  },
  deleteImage: (path) => { deleted.push(path); return Promise.resolve(); },
  uploadImage: () => Promise.resolve("https://storage.example/x"),
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
const { storage: local } = await import("../../../utils/storage.js");

const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "deed.pdf", { type: "application/pdf" });

beforeEach(() => {
  deleted.length = 0; uploaded.length = 0; failAdd = false;
  /* A signed-in owner with a configured project is what sends putFile down the
     cloud branch rather than storing on the device. */
  local.set("user", { uid: "U1" });
  import.meta.env.VITE_FB_API_KEY ||= "test-key";
});

describe("orphaned uploads", () => {
  it("deletes the uploaded file when the metadata row cannot be written", async () => {
    failAdd = true;

    await expect(
      documentService.add({ subjectType: "owner", category: "land", title: "Plot 42" }, pdf(), { ownerId: "U1" })
    ).rejects.toThrow("quota exceeded");

    expect(uploaded, "the file did reach storage").toHaveLength(1);
    expect(deleted, "and was cleaned up again").toEqual(uploaded);
  });

  it("keeps the file when the metadata row is written successfully", async () => {
    const saved = await documentService.add(
      { subjectType: "owner", category: "land", title: "Plot 42" }, pdf(), { ownerId: "U1" });

    expect(saved.storage).toBe("cloud");
    expect(saved.fileUrl).toContain("https://storage.example/users/U1/documents/owner/land/");
    expect(deleted).toEqual([]);
  });
});
