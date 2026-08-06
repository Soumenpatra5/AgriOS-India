import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { priceAlertService } = await import("../priceAlerts.js");

const base = { cropId: "paddy", cropName: "Paddy", targetPrice: 2500, direction: "above" };

describe("priceAlertService", () => {
  beforeEach(() => { Object.keys(store).forEach((k) => delete store[k]); });

  it("starts empty", () => {
    expect(priceAlertService.getAll()).toEqual([]);
  });

  it("adds an alert with generated id and defaults", () => {
    const a = priceAlertService.add(base);
    expect(a.id).toBeTruthy();
    expect(a.enabled).toBe(true);
    expect(a.triggeredAt).toBeNull();
    expect(a.targetPrice).toBe(2500);
    expect(priceAlertService.getAll()).toHaveLength(1);
  });

  it("coerces targetPrice to a number", () => {
    const a = priceAlertService.add({ ...base, targetPrice: "1800" });
    expect(a.targetPrice).toBe(1800);
  });

  it("removes an alert by id", () => {
    const a = priceAlertService.add(base);
    priceAlertService.remove(a.id);
    expect(priceAlertService.getAll()).toEqual([]);
  });

  it("toggles enabled state", () => {
    const a = priceAlertService.add(base);
    expect(priceAlertService.toggle(a.id)).toBe(false);
    expect(priceAlertService.toggle(a.id)).toBe(true);
  });

  it("forCrop filters by cropId", () => {
    priceAlertService.add(base);
    priceAlertService.add({ ...base, cropId: "wheat" });
    expect(priceAlertService.forCrop("paddy")).toHaveLength(1);
    expect(priceAlertService.forCrop("wheat")).toHaveLength(1);
    expect(priceAlertService.forCrop("maize")).toHaveLength(0);
  });

  describe("check", () => {
    it("triggers an 'above' alert when price meets or exceeds target", () => {
      priceAlertService.add(base);
      expect(priceAlertService.check("paddy", 2600)).toHaveLength(1);
      expect(priceAlertService.check("paddy", 2500)).toHaveLength(1);
      expect(priceAlertService.check("paddy", 2400)).toHaveLength(0);
    });

    it("triggers a 'below' alert when price is at or under target", () => {
      priceAlertService.add({ ...base, direction: "below" });
      expect(priceAlertService.check("paddy", 2400)).toHaveLength(1);
      expect(priceAlertService.check("paddy", 2600)).toHaveLength(0);
    });

    it("ignores disabled or already-triggered alerts", () => {
      const a = priceAlertService.add(base);
      priceAlertService.toggle(a.id); // disable
      expect(priceAlertService.check("paddy", 3000)).toHaveLength(0);

      priceAlertService.toggle(a.id); // re-enable
      priceAlertService.markTriggered(a.id);
      expect(priceAlertService.check("paddy", 3000)).toHaveLength(0);
    });
  });
});
