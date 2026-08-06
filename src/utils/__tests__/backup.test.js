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

// Seed a real IndexedDB (fake-indexeddb is loaded globally via setupFiles).
function deleteDb(name) {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

function seedDb(dbName, storeName, rows) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(storeName, "readwrite");
      rows.forEach((r) => tx.objectStore(storeName).put(r));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function readDb(dbName, storeName) {
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
      const g = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
      g.onsuccess = () => { db.close(); resolve(g.result); };
      g.onerror = () => { db.close(); resolve([]); };
    };
    req.onerror = () => resolve([]);
  });
}

describe("backup — IndexedDB round-trip", () => {
  // "agrios-livestock" / "animals" is a real store in dbRegistry's CORE_DBS.
  const DB = "agrios-livestock";
  const STORE = "animals";

  // A prior createBackup() may have created this DB empty (no stores), which
  // would block seedDb's upgrade. Delete it first so seedDb owns the schema.
  beforeEach(async () => { await deleteDb(DB); });

  it("captures IndexedDB store rows into the backup", async () => {
    await seedDb(DB, STORE, [{ id: "cow1", name: "Lakshmi" }, { id: "goat1", name: "Raja" }]);
    const backup = await createBackup();
    const animals = backup.indexedDB[DB]?.[STORE] || [];
    expect(animals).toHaveLength(2);
    expect(animals.map((a) => a.id).sort()).toEqual(["cow1", "goat1"]);
  });

  it("restores IndexedDB rows from a backup after the store is wiped", async () => {
    await seedDb(DB, STORE, [{ id: "cow1", name: "Lakshmi" }]);
    const backup = await createBackup();

    // Wipe the store, confirm it's empty, then restore.
    await new Promise((res) => {
      const req = indexedDB.open(DB);
      req.onsuccess = () => { const db = req.result; const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = () => { db.close(); res(); }; };
    });
    expect(await readDb(DB, STORE)).toHaveLength(0);

    await restoreBackup({ text: async () => JSON.stringify(backup) });
    const restored = await readDb(DB, STORE);
    expect(restored.some((r) => r.id === "cow1")).toBe(true);
  });
});
