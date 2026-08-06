import { describe, it, expect, beforeEach, vi } from "vitest";

let data = {};
vi.stubGlobal("localStorage", {
  get length() { return Object.keys(data).length; },
  key: (i) => Object.keys(data)[i] ?? null,
  getItem: (k) => data[k] ?? null,
  setItem: (k, v) => { data[k] = String(v); },
  removeItem: (k) => { delete data[k]; },
});

let lastBlob = null;
let lastLink = null;
globalThis.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; lastBlob = this; } };
globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
globalThis.URL.revokeObjectURL = vi.fn();
vi.stubGlobal("document", {
  createElement: () => (lastLink = { href: "", download: "", click: vi.fn() }),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
});

const { createBackup, downloadBackup, restoreBackup } = await import("../backup.js");

describe("backup", () => {
  beforeEach(() => { data = {}; lastBlob = null; lastLink = null; });

  it("createBackup captures agrios: localStorage keys with metadata", async () => {
    data["agrios:user"] = JSON.stringify({ name: "Soumen" });
    data["agrios:lang"] = JSON.stringify("bn");
    data["unrelated"] = "ignored";

    const backup = await createBackup();
    expect(backup.version).toBe(1);
    expect(typeof backup.createdAt).toBe("string");
    expect(backup.localStorage["agrios:user"]).toEqual({ name: "Soumen" });
    expect(backup.localStorage["agrios:lang"]).toBe("bn");
    expect(backup.localStorage).not.toHaveProperty("unrelated");
    expect(backup.indexedDB).toBeTypeOf("object");
  });

  it("downloadBackup writes a JSON blob and clicks a dated link", () => {
    downloadBackup({ version: 1, localStorage: {}, indexedDB: {} });
    expect(lastLink.click).toHaveBeenCalled();
    expect(lastLink.download).toMatch(/^agrios-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(lastBlob.opts).toEqual({ type: "application/json" });
  });

  it("restoreBackup imports localStorage keys from a valid file", async () => {
    const backup = { version: 1, localStorage: { "agrios:lang": "hi" }, indexedDB: {} };
    const file = { text: async () => JSON.stringify(backup) };
    const when = await restoreBackup(file);
    expect(data["agrios:lang"]).toBe(JSON.stringify("hi"));
    expect(when).toBeUndefined(); // no createdAt in this fixture
  });

  it("restoreBackup returns the backup's createdAt", async () => {
    const backup = { version: 1, createdAt: "2026-08-05T00:00:00Z", localStorage: {}, indexedDB: {} };
    const when = await restoreBackup({ text: async () => JSON.stringify(backup) });
    expect(when).toBe("2026-08-05T00:00:00Z");
  });

  it("restoreBackup rejects a file without version/localStorage", async () => {
    await expect(restoreBackup({ text: async () => JSON.stringify({ foo: 1 }) })).rejects.toThrow();
  });

  it("restoreBackup rejects malformed JSON", async () => {
    await expect(restoreBackup({ text: async () => "not json" })).rejects.toThrow();
  });

  it("restoreBackup ignores non-agrios keys in the file", async () => {
    const backup = { version: 1, localStorage: { "evil:key": "x", "agrios:ok": "1" }, indexedDB: {} };
    await restoreBackup({ text: async () => JSON.stringify(backup) });
    expect(data).not.toHaveProperty("evil:key");
    expect(data["agrios:ok"]).toBe(JSON.stringify("1"));
  });
});
