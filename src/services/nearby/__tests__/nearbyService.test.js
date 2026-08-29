import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* In-memory ttlCache (mirrors the real freshness/stale semantics). */
const H = vi.hoisted(() => {
  const store = new Map();
  const ttlCache = {
    get: (k) => { const e = store.get(k); if (!e) return undefined; if (Date.now() > e.exp) return undefined; return e.v; },
    getStale: (k) => { const e = store.get(k); if (!e) return undefined; return { value: e.v, ts: e.ts, stale: Date.now() > e.exp }; },
    set: (k, v, ttl) => { store.set(k, { v, exp: Date.now() + ttl, ts: Date.now() }); },
    remove: (k) => store.delete(k),
  };
  return { store, ttlCache };
});

vi.mock("../../cache/ttlCache.js", () => ({ ttlCache: H.ttlCache }));

const { nearbyService, NEARBY_CATEGORIES, getCategory } = await import("../nearbyService.js");

const origin = { categoryId: "vet", lat: 22.0, lon: 87.0, radiusKm: 15 };

/* Out-of-distance-order so the sort is actually exercised. */
const elements = [
  { id: 3, lat: 22.0, lon: 87.2, tags: { name: "Far Vet" } },      // ~20.6 km
  { id: 1, lat: 22.0, lon: 87.0, tags: { name: "Near Vet", "addr:street": "MG Road", "addr:city": "Jhargram" } }, // 0 km
  { id: 2, lat: 22.1, lon: 87.0 },                                 // ~11.1 km, no tags
  { id: 99, tags: { name: "No Coords" } },                         // dropped (no lat/lon)
];

const stubFetchOk = (els) => { const f = vi.fn(async () => ({ ok: true, json: async () => ({ elements: els }) })); vi.stubGlobal("fetch", f); return f; };

beforeEach(() => { H.store.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("getCategory / categories", () => {
  it("resolves a known category and falls back to the first for unknown", () => {
    expect(getCategory("bank").id).toBe("bank");
    expect(getCategory("nope").id).toBe("vet"); // first category
  });
  it("exposes the six nearby categories", () => {
    expect(NEARBY_CATEGORIES.map((c) => c.id)).toEqual(["vet", "market", "agri", "bank", "fuel", "hospital"]);
    expect(nearbyService.categories).toBe(NEARBY_CATEGORIES);
  });
});

describe("nearbyService.find — success", () => {
  it("maps, computes distance, sorts nearest-first and drops coordless nodes", async () => {
    const fetchMock = stubFetchOk(elements);
    const items = await nearbyService.find(origin);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[0][1].body).toContain("veterinary");

    expect(items.map((i) => i.id)).toEqual(["1", "2", "3"]); // sorted by distance, "99" dropped
    expect(items[0].distanceKm).toBe(0);
    expect(items[1].distanceKm).toBe(11.1);
    expect(items[2].distanceKm).toBe(20.6);
    // distances are non-decreasing
    expect(items.every((it, i) => i === 0 || items[i - 1].distanceKm <= it.distanceKm)).toBe(true);
  });

  it("fills name from tags or the category label, and joins the address", async () => {
    stubFetchOk(elements);
    const items = await nearbyService.find(origin);
    expect(items[0]).toMatchObject({ name: "Near Vet", address: "MG Road, Jhargram", category: "vet" });
    expect(items[1].name).toBe("Veterinary"); // no tags.name → category label
  });

  it("serves the cached result on a second call without refetching", async () => {
    const fetchMock = stubFetchOk(elements);
    await nearbyService.find(origin);
    await nearbyService.find(origin);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("nearbyService.find — offline / errors", () => {
  it("falls back to the stale cache when the network fails", async () => {
    stubFetchOk(elements);
    const first = await nearbyService.find(origin); // populates cache

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const offline = await nearbyService.find({ ...origin, force: true }); // bypass fresh cache → fetch → fail → stale
    expect(offline).toEqual(first);
  });

  it("rethrows when the network fails and nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await expect(nearbyService.find(origin)).rejects.toThrow(/network down/);
  });

  it("throws on a non-ok Overpass response with no cache", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(nearbyService.find(origin)).rejects.toThrow(/overpass error/);
  });
});

/* A saturated Overpass instance accepts the connection and then never answers.
   Without a deadline the promise never settles and the screen spins forever. */
describe("nearbyService.find — a stalled Overpass instance", () => {
  /* Never resolves on its own; only the abort signal ends it. */
  const stubFetchHang = () => vi.stubGlobal("fetch", vi.fn((url, { signal } = {}) => new Promise((_, reject) => {
    signal?.addEventListener("abort", () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      reject(e);
    });
  })));

  it("gives up instead of hanging, and says it timed out", async () => {
    stubFetchHang();
    const err = await nearbyService.find(origin, { timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.timedOut).toBe(true);
  });

  it("prefers stale results over an error when the instance stalls", async () => {
    stubFetchOk(elements);
    const first = await nearbyService.find(origin);

    stubFetchHang();
    const stale = await nearbyService.find({ ...origin, force: true }, { timeoutMs: 20 });
    expect(stale).toEqual(first);
  });

  it("still honours a caller's own abort signal", async () => {
    stubFetchHang();
    const ctrl = new AbortController();
    const p = nearbyService.find({ ...origin, categoryId: "fuel" }, { signal: ctrl.signal, timeoutMs: 5000 });
    ctrl.abort();
    const err = await p.catch((e) => e);
    expect(err.name).toBe("AbortError");
    expect(err.timedOut).toBeUndefined(); // cancelled by the caller, not by the deadline
  });
});
