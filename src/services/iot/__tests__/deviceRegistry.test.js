import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `d${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (f, v) => rows.filter((r) => r[f] === v),
      getById: async (id) => rows.find((r) => r.id === id) || null,
      update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
      remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
      reset: () => { rows = []; seq = 0; },
    };
  };
  const repo = (name) => (stores[name] ||= make());
  const resetAll = () => Object.values(stores).forEach((s) => s.reset());
  return { repo, resetAll };
});

vi.mock("../../erp/erpDb.js", () => ({ repo: held.repo, uid: () => "uid" }));

const { deviceRegistry, DEVICE_TYPES, PROTOCOLS } = await import("../deviceRegistry.js");

beforeEach(() => { held.resetAll(); });
afterEach(() => { vi.useRealTimers(); });

describe("deviceRegistry — devices", () => {
  it("register defaults status to active, honouring an override", async () => {
    expect((await deviceRegistry.register({ name: "Barn temp", type: "temp" })).status).toBe("active");
    expect((await deviceRegistry.register({ name: "Old", status: "inactive" })).status).toBe("inactive");
  });

  it("scopes getAll to a farm, or returns everything", async () => {
    await deviceRegistry.register({ farmId: "f1", name: "A" });
    await deviceRegistry.register({ farmId: "f2", name: "B" });
    expect(await deviceRegistry.getAll("f1")).toHaveLength(1);
    expect(await deviceRegistry.getAll()).toHaveLength(2);
  });

  it("update / remove work", async () => {
    const d = await deviceRegistry.register({ name: "X" });
    expect((await deviceRegistry.update(d.id, { status: "inactive" })).status).toBe("inactive");
    await deviceRegistry.remove(d.id);
    expect(await deviceRegistry.getAll()).toHaveLength(0);
  });
});

describe("deviceRegistry — telemetry", () => {
  it("recordTelemetry coerces the value and stamps date/time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z"));
    const d = await deviceRegistry.register({ name: "Temp", type: "temp" });
    const rec = await deviceRegistry.recordTelemetry(d.id, "25.5");
    expect(rec.value).toBe(25.5);       // string → number
    expect(rec.date).toBe("2026-05-01");
    expect(rec.at).toBe("2026-05-01T10:00:00.000Z");
  });

  it("getTelemetry returns newest-first and honours the limit", async () => {
    vi.useFakeTimers();
    const d = await deviceRegistry.register({ name: "Temp" });
    for (const [t, v] of [["10:00", 25], ["11:00", 26], ["12:00", 27]]) {
      vi.setSystemTime(new Date(`2026-05-01T${t}:00Z`));
      await deviceRegistry.recordTelemetry(d.id, v);
    }
    expect((await deviceRegistry.getTelemetry(d.id)).map((x) => x.value)).toEqual([27, 26, 25]);
    expect((await deviceRegistry.getTelemetry(d.id, 2)).map((x) => x.value)).toEqual([27, 26]);
  });

  it("latestReadings pairs each device with its most recent reading (or null)", async () => {
    const a = await deviceRegistry.register({ farmId: "f1", name: "A" });
    await deviceRegistry.register({ farmId: "f1", name: "B" }); // no telemetry
    await deviceRegistry.recordTelemetry(a.id, 42);
    const readings = await deviceRegistry.latestReadings("f1");
    expect(readings).toHaveLength(2);
    const byName = Object.fromEntries(readings.map((r) => [r.device.name, r.latest]));
    expect(byName.A.value).toBe(42);
    expect(byName.B).toBeNull();
  });
});

describe("deviceRegistry — metadata", () => {
  it("typeMeta resolves a type, falling back to the first", () => {
    expect(deviceRegistry.typeMeta("humidity").label).toBe("Humidity Sensor");
    expect(deviceRegistry.typeMeta("nope").id).toBe("temp"); // first type
  });
  it("exposes the device-type and protocol vocabularies", () => {
    expect(DEVICE_TYPES).toHaveLength(7);
    expect(PROTOCOLS).toContain("MQTT");
  });
});
