import { describe, it, expect, beforeEach } from "vitest";
import { serviceHubService } from "../serviceHubService.js";

/* The node test env has no localStorage (only fake-indexeddb is set up); the
   storage wrapper silently no-ops without it. Polyfill a minimal Map-backed
   localStorage so these tests exercise real persistence. */
class MemLocalStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => { globalThis.localStorage = new MemLocalStorage(); });

describe("serviceHubService — favorites", () => {
  it("starts empty", () => {
    expect(serviceHubService.getFavorites()).toEqual([]);
    expect(serviceHubService.isFavorite("ledger")).toBe(false);
  });

  it("toggles a favorite on and off", () => {
    expect(serviceHubService.toggleFavorite("ledger")).toBe(true);
    expect(serviceHubService.isFavorite("ledger")).toBe(true);
    expect(serviceHubService.toggleFavorite("ledger")).toBe(false);
    expect(serviceHubService.isFavorite("ledger")).toBe(false);
  });

  it("preserves insertion order across multiple favorites", () => {
    serviceHubService.toggleFavorite("a");
    serviceHubService.toggleFavorite("b");
    serviceHubService.toggleFavorite("c");
    expect(serviceHubService.getFavorites()).toEqual(["a", "b", "c"]);
  });

  it("reorders a favorite up and down", () => {
    ["a", "b", "c"].forEach((id) => serviceHubService.toggleFavorite(id));
    expect(serviceHubService.reorderFavorite("c", -1)).toEqual(["a", "c", "b"]);
    expect(serviceHubService.reorderFavorite("a", 1)).toEqual(["c", "a", "b"]);
  });

  it("reorder is a no-op at the boundaries", () => {
    ["a", "b"].forEach((id) => serviceHubService.toggleFavorite(id));
    expect(serviceHubService.reorderFavorite("a", -1)).toEqual(["a", "b"]);
    expect(serviceHubService.reorderFavorite("b", 1)).toEqual(["a", "b"]);
  });
});

describe("serviceHubService — recents", () => {
  it("moves the most-recently-used service to the front", () => {
    serviceHubService.recordUse("a");
    serviceHubService.recordUse("b");
    serviceHubService.recordUse("a");
    expect(serviceHubService.getRecents()).toEqual(["a", "b"]);
  });

  it("de-duplicates recents", () => {
    serviceHubService.recordUse("x");
    serviceHubService.recordUse("x");
    expect(serviceHubService.getRecents()).toEqual(["x"]);
  });

  it("caps recents at 12, dropping the oldest", () => {
    for (let i = 0; i < 15; i++) serviceHubService.recordUse(`svc-${i}`);
    const recents = serviceHubService.getRecents();
    expect(recents).toHaveLength(12);
    expect(recents[0]).toBe("svc-14"); // most recent
    expect(recents).not.toContain("svc-0"); // oldest dropped
  });

  it("clearRecents empties the list", () => {
    serviceHubService.recordUse("a");
    serviceHubService.clearRecents();
    expect(serviceHubService.getRecents()).toEqual([]);
  });
});

describe("serviceHubService — usage / frequentlyUsed", () => {
  it("counts uses and ranks by frequency", () => {
    serviceHubService.recordUse("a");
    serviceHubService.recordUse("a");
    serviceHubService.recordUse("a");
    serviceHubService.recordUse("b");
    serviceHubService.recordUse("b");
    serviceHubService.recordUse("c");
    const usage = serviceHubService.getUsage();
    expect(usage.a).toBe(3);
    expect(usage.b).toBe(2);
    expect(serviceHubService.frequentlyUsed(2)).toEqual(["a", "b"]);
  });

  it("frequentlyUsed respects the limit", () => {
    ["a", "b", "c", "d"].forEach((id) => serviceHubService.recordUse(id));
    expect(serviceHubService.frequentlyUsed(2)).toHaveLength(2);
  });

  it("returns an empty list when nothing has been used", () => {
    expect(serviceHubService.frequentlyUsed()).toEqual([]);
  });
});
