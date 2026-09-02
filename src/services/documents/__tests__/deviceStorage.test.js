import { describe, it, expect, vi, beforeEach } from "vitest";

/* Documents are stored on the device's own file system rather than pushed to
   the cloud. These cover the parts that can silently lose or leak a farmer's
   file: where the bytes go, whether they can be read back, whether a delete
   actually frees them, and what happens on a browser that will not give us a
   file system at all. */

/* A stand-in for OPFS. The test environment has no file system, and the real
   navigator.storage.getDirectory() is not something jsdom provides. */
function fakeOpfs() {
  const files = new Map();
  const dirHandle = {
    async getFileHandle(name, opts) {
      if (!files.has(name)) {
        if (!opts?.create) throw new Error("NotFoundError");
        files.set(name, new Blob([]));
      }
      return {
        kind: "file",
        async getFile() { return files.get(name); },
        async createWritable() {
          let buf = null;
          return {
            async write(blob) { buf = blob; },
            async close() { files.set(name, buf ?? new Blob([])); },
          };
        },
      };
    },
    async removeEntry(name) {
      if (!files.has(name)) throw new Error("NotFoundError");
      files.delete(name);
    },
    async *entries() {
      for (const [name] of files) yield [name, await dirHandle.getFileHandle(name)];
    },
  };
  return { files, dirHandle };
}

const { files, dirHandle } = fakeOpfs();

beforeEach(async () => {
  files.clear();
  const fileStore = await import("../fileStore.js");
  fileStore._resetForTests();
  globalThis.navigator ??= {};
  Object.defineProperty(globalThis.navigator, "storage", {
    configurable: true,
    value: { getDirectory: async () => ({ getDirectoryHandle: async () => dirHandle }) },
  });
});

describe("device file store", () => {
  it("keeps anything user-supplied out of the filename", async () => {
    const { newKey } = await import("../fileStore.js");
    /* A document named "../../other" must not become a path that escapes the
       directory — the extension is the only caller-influenced part, and it is
       stripped to letters and digits. */
    for (const bad of ["../../etc", "pdf/../..", "p df", "PDF", ".."]) {
      const key = newKey(bad);
      expect(key).not.toMatch(/[/\\]/);
      expect(key).toMatch(/^[a-zA-Z0-9]+(\.[a-z0-9]+)?$/);
    }
  });

  it("round-trips a file and frees it on remove", async () => {
    const { put, get, remove, usage } = await import("../fileStore.js");
    const key = await put(new Blob([new Uint8Array([1, 2, 3, 4])]), "pdf");

    expect(key).toMatch(/\.pdf$/);
    expect((await get(key)).size).toBe(4);
    expect((await usage()).files).toBe(1);

    expect(await remove(key)).toBe(true);
    expect(await get(key)).toBeNull();
    expect((await usage()).files).toBe(0);
  });

  it("reports a missing key rather than throwing", async () => {
    const { get, remove } = await import("../fileStore.js");
    expect(await get("nope.pdf")).toBeNull();
    /* A key that is already gone is a success: delete is idempotent, so a
       retried purge must not fail on the second pass. */
    expect(await remove("nope.pdf")).toBe(false);
  });

  it("prunes files no record references any more", async () => {
    const { put, pruneOrphans, usage } = await import("../fileStore.js");
    const keep = await put(new Blob(["a"]), "pdf");
    await put(new Blob(["b"]), "pdf");
    await put(new Blob(["c"]), "pdf");

    expect(await pruneOrphans([keep])).toBe(2);
    expect((await usage()).files).toBe(1);
  });

  it("degrades to no-file-system instead of throwing", async () => {
    const fileStore = await import("../fileStore.js");
    fileStore._resetForTests();
    Object.defineProperty(globalThis.navigator, "storage", { configurable: true, value: undefined });

    expect(await fileStore.available()).toBe(false);
    /* null is the signal to keep the bytes inline — the document is still
       saved, just less efficiently. */
    expect(await fileStore.put(new Blob(["x"]), "pdf")).toBeNull();
    expect(await fileStore.get("x.pdf")).toBeNull();
    expect(await fileStore.usage()).toEqual({ files: 0, bytes: 0 });
  });
});

describe("documents on the device", () => {
  it("stores the file and keeps no inline copy", async () => {
    const { documentService } = await import("../documentService.js");
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "deed.pdf", { type: "application/pdf" });

    const saved = await documentService.add(
      { subjectType: "owner", category: "land", title: "Plot 42" }, pdf);

    expect(saved.storage).toBe("device");
    expect(saved.fileKey).toBeTruthy();
    expect(saved.fileData).toBe("");
    /* No cloud fields are invented on the way through. */
    expect(saved.fileUrl).toBe("");
    expect(saved.storagePath).toBe("");
  });

  it("reads the file back through openable()", async () => {
    const { documentService } = await import("../documentService.js");
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "deed.pdf", { type: "application/pdf" });
    const saved = await documentService.add(
      { subjectType: "owner", category: "land", title: "Plot 9" }, pdf);

    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const opened = await documentService.openable(saved);
    expect(opened.url).toBe("blob:fake");
    expect(createObjectURL).toHaveBeenCalledOnce();

    opened.revoke();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    vi.unstubAllGlobals();
  });

  it("frees the device file when the document is purged", async () => {
    const { documentService } = await import("../documentService.js");
    const { get } = await import("../fileStore.js");
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "deed.pdf", { type: "application/pdf" });

    const saved = await documentService.add(
      { subjectType: "owner", category: "land", title: "Plot 7" }, pdf);
    expect(await get(saved.fileKey)).toBeTruthy();

    const res = await documentService.purge(saved.id);
    expect(res.filesDeleted).toBe(1);
    /* The bytes are actually gone, not just unreferenced — otherwise a
       deleted ID scan would sit in the farmer's storage forever. */
    expect(await get(saved.fileKey)).toBeNull();
  });
});
