import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* In-memory storage so we can inspect the stored (prefixed) entries. */
const mem = {};
vi.mock("../../../utils/storage.js", () => ({
  storage: {
    get: (k, d) => (k in mem ? mem[k] : d),
    set: (k, v) => { mem[k] = v; },
    remove: (k) => { delete mem[k]; },
  },
}));

const { ttlCache } = await import("../ttlCache.js");

beforeEach(() => { for (const k of Object.keys(mem)) delete mem[k]; });
afterEach(() => { vi.useRealTimers(); });

describe("ttlCache", () => {
  it("namespaces stored entries under a cache: prefix", () => {
    ttlCache.set("weather", { t: 30 }, 1000);
    expect(mem["cache:weather"]).toBeTruthy();
  });

  it("get returns a fresh value and undefined once expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    ttlCache.set("k", { temp: 30 }, 1000);

    expect(ttlCache.get("k")).toEqual({ temp: 30 });
    vi.advanceTimersByTime(500);
    expect(ttlCache.get("k")).toEqual({ temp: 30 }); // still within TTL
    vi.advanceTimersByTime(600);                     // total 1100ms > 1000ms
    expect(ttlCache.get("k")).toBeUndefined();       // expired
  });

  it("get returns undefined for a missing key", () => {
    expect(ttlCache.get("absent")).toBeUndefined();
  });

  it("getStale returns the last value with a freshness flag", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    ttlCache.set("k", "v", 1000);

    expect(ttlCache.getStale("k")).toMatchObject({ value: "v", stale: false });
    expect(typeof ttlCache.getStale("k").ts).toBe("number");

    vi.advanceTimersByTime(2000);
    expect(ttlCache.getStale("k")).toMatchObject({ value: "v", stale: true }); // still returns the value
    expect(ttlCache.get("k")).toBeUndefined();                                 // but get treats it as a miss
  });

  it("getStale returns undefined for a missing key", () => {
    expect(ttlCache.getStale("absent")).toBeUndefined();
  });

  it("remove deletes the entry", () => {
    ttlCache.set("k", "v", 1000);
    ttlCache.remove("k");
    expect(ttlCache.get("k")).toBeUndefined();
    expect(ttlCache.getStale("k")).toBeUndefined();
  });
});
