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

describe("a broken Upstash config is visible, not silent", () => {
  const KEYS = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
                "KV_REST_API_URL", "KV_REST_API_TOKEN"];
  const save = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  beforeEach(() => { for (const k of KEYS) delete process.env[k]; });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of KEYS) {
      if (save[k] === undefined) delete process.env[k]; else process.env[k] = save[k];
    }
  });

  it("accepts the KV_REST_API_* names Vercel's Upstash integration creates", () => {
    /* Which pair you get depends on how the store was made. Reading only one
       would leave the limiter off while the dashboard says it is connected. */
    process.env.KV_REST_API_URL = "https://x.upstash.io";
    process.env.KV_REST_API_TOKEN = "tok";
    expect(rateLimitConfigured()).toBe(true);
  });

  it("logs when it falls back, so a wrong token cannot hide", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://x.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "wrong";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 });

    /* The complaint is throttled to once a minute so an outage cannot flood
       the log, and an earlier test in this file has already spent that
       minute. Move past it rather than depending on test order. */
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3_600_000);

    await rateLimit({ key: "k-" + Math.random(), max: 5, windowMs: 60000 });

    expect(err).toHaveBeenCalled();
    const line = err.mock.calls[0].join(" ");
    expect(line).toContain("rate_limit_degraded");
    /* The token must never reach the log. */
    expect(line).not.toContain("wrong");
  });
});
