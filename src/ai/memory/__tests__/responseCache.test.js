import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { responseCache } = await import("../responseCache.js");

describe("responseCache", () => {
  beforeEach(() => { Object.keys(store).forEach((k) => delete store[k]); vi.useRealTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns null on a miss", () => {
    expect(responseCache.get("how to grow paddy", "en")).toBeNull();
  });

  it("round-trips a cached answer", () => {
    responseCache.set("How to grow paddy?", "en", "Use good seed.", "cropExpert");
    const hit = responseCache.get("How to grow paddy?", "en");
    expect(hit).toEqual({ text: "Use good seed.", agentId: "cropExpert" });
  });

  it("normalizes case and whitespace for lookups", () => {
    responseCache.set("How  to   GROW paddy?", "en", "answer", "a");
    expect(responseCache.get("how to grow paddy?", "en")).toMatchObject({ text: "answer" });
  });

  it("keys separately by language", () => {
    responseCache.set("weather", "en", "sunny", "a");
    expect(responseCache.get("weather", "hi")).toBeNull();
  });

  it("does not store empty answers", () => {
    responseCache.set("q", "en", "", "a");
    expect(responseCache.get("q", "en")).toBeNull();
  });

  it("overwrites an existing key without duplicating", () => {
    responseCache.set("q", "en", "first", "a");
    responseCache.set("q", "en", "second", "a");
    expect(responseCache.get("q", "en").text).toBe("second");
    expect(JSON.parse(store["agrios:ai:respCache"])).toHaveLength(1);
  });

  it("expires entries past the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    responseCache.set("q", "en", "old", "a");
    // 8 days later — beyond the 7-day TTL
    vi.setSystemTime(new Date("2026-01-09T00:00:00Z"));
    expect(responseCache.get("q", "en")).toBeNull();
  });

  it("caps stored entries at the maximum", () => {
    for (let i = 0; i < 50; i++) responseCache.set(`q${i}`, "en", `a${i}`, "x");
    expect(JSON.parse(store["agrios:ai:respCache"]).length).toBeLessThanOrEqual(40);
  });

  it("clear empties the cache", () => {
    responseCache.set("q", "en", "a", "x");
    responseCache.clear();
    expect(responseCache.get("q", "en")).toBeNull();
  });
});
