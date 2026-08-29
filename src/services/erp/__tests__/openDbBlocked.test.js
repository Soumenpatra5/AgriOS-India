import { describe, it, expect, vi, afterEach } from "vitest";

/* Regression: an IndexedDB upgrade that another open tab blocks fires 'blocked'
   and then NEITHER onsuccess NOR onerror. openDb() used to return a promise
   that simply never settled, so every repo call awaited forever — the symptom
   was a save button stuck on "Uploading…" with no error ever shown.

   openDb() must reject on 'blocked' so callers can surface it, and it must not
   itself hold the DB open when another tab needs to upgrade. */

const realIndexedDB = globalThis.indexedDB;
afterEach(() => { globalThis.indexedDB = realIndexedDB; vi.resetModules(); });

/* A fake open() that only ever fires the event we ask for. */
function fakeIndexedDB(fire) {
  return {
    open() {
      const req = {};
      queueMicrotask(() => fire(req));
      return req;
    },
  };
}

describe("openDb when another tab blocks the upgrade", () => {
  it("rejects instead of hanging forever", async () => {
    globalThis.indexedDB = fakeIndexedDB((req) => req.onblocked?.());
    const { openDb } = await import("../erpDb.js");

    const settled = await Promise.race([
      openDb().then(() => "resolved", (e) => ({ rejected: String(e.message) })),
      new Promise((r) => setTimeout(() => r("HUNG"), 300)),
    ]);

    expect(settled).not.toBe("HUNG");
    expect(settled.rejected).toMatch(/blocked by another open tab/i);
  });

  it("releases its handle when another tab needs to upgrade, so it is not the blocker", async () => {
    const close = vi.fn();
    const db = { close, objectStoreNames: { contains: () => true } };
    globalThis.indexedDB = fakeIndexedDB((req) => req.onsuccess?.({ target: { result: db } }));
    const { openDb } = await import("../erpDb.js");

    const opened = await openDb();
    expect(opened).toBe(db);
    expect(typeof db.onversionchange).toBe("function");

    db.onversionchange();
    expect(close).toHaveBeenCalledOnce();

    /* Handle dropped, so the next call re-opens rather than handing back a
       closed connection. */
    globalThis.indexedDB = fakeIndexedDB((req) => req.onblocked?.());
    await expect(openDb()).rejects.toThrow(/blocked/i);
  });

  it("still rejects on a genuine open error", async () => {
    globalThis.indexedDB = fakeIndexedDB((req) => { req.error = new Error("quota"); req.onerror?.(); });
    const { openDb } = await import("../erpDb.js");
    await expect(openDb()).rejects.toThrow("quota");
  });
});
