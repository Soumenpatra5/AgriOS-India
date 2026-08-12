import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { memLimited, rateLimitConfigured, rateLimit } from "../rateLimit.js";

describe("memLimited (in-memory fallback)", () => {
  it("allows up to `max` in the window, then blocks", () => {
    const key = "k-" + Math.random();
    const t0 = 1_000_000;
    expect(memLimited(key, 2, 1000, t0)).toBe(false);      // 1st
    expect(memLimited(key, 2, 1000, t0 + 10)).toBe(false); // 2nd
    expect(memLimited(key, 2, 1000, t0 + 20)).toBe(true);  // 3rd -> over
  });

  it("forgets hits older than the window", () => {
    const key = "k-" + Math.random();
    const t0 = 2_000_000;
    memLimited(key, 1, 1000, t0);
    expect(memLimited(key, 1, 1000, t0 + 50)).toBe(true);     // still in window
    expect(memLimited(key, 1, 1000, t0 + 2000)).toBe(false);  // window elapsed
  });
});

describe("rateLimitConfigured", () => {
  const save = { u: process.env.UPSTASH_REDIS_REST_URL, t: process.env.UPSTASH_REDIS_REST_TOKEN };
  afterEach(() => {
    if (save.u === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = save.u;
    if (save.t === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = save.t;
  });
  it("reflects Upstash env presence", () => {
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(rateLimitConfigured()).toBe(false);
    process.env.UPSTASH_REDIS_REST_URL = "https://x.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    expect(rateLimitConfigured()).toBe(true);
  });
});

describe("rateLimit with Upstash", () => {
  const save = { u: process.env.UPSTASH_REDIS_REST_URL, t: process.env.UPSTASH_REDIS_REST_TOKEN };
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://x.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (save.u === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = save.u;
    if (save.t === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = save.t;
  });

  it("blocks when the Upstash INCR count exceeds max", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => [{ result: 11 }, { result: 1 }] });
    expect(await rateLimit({ key: "orders:u1", max: 10, windowMs: 60000 })).toBe(true);
  });

  it("allows when count is within max", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => [{ result: 3 }, { result: 0 }] });
    expect(await rateLimit({ key: "orders:u1", max: 10, windowMs: 60000 })).toBe(false);
  });

  it("degrades to the in-memory limiter if Upstash errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    // First call under mem limit -> allowed (proves it didn't just throw).
    expect(await rateLimit({ key: "orders:u2-" + Math.random(), max: 5, windowMs: 60000 })).toBe(false);
  });
});
