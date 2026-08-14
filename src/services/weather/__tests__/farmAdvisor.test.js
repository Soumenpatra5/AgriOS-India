import { describe, it, expect } from "vitest";
import { buildFarmAdvice } from "../farmAdvisor.js";

const RANK = { critical: 0, danger: 1, warn: 2, info: 3, good: 4 };
const ids = (advice) => advice.map((a) => a.id);
const byId = (advice, id) => advice.find((a) => a.id === id);

/* Build `n` identical hourly slots. */
const hourly = (n, slot) => Array.from({ length: n }, () => ({ ...slot }));

describe("buildFarmAdvice — guards", () => {
  it("returns [] for null / undefined / empty weather", () => {
    expect(buildFarmAdvice(null)).toEqual([]);
    expect(buildFarmAdvice(undefined)).toEqual([]);
    expect(buildFarmAdvice({})).toEqual([]);
  });
});

describe("buildFarmAdvice — spraying window", () => {
  it("flags a good spraying window in calm, dry, mild conditions", () => {
    const advice = buildFarmAdvice({
      current: { temp: 28, humidity: 40, windSpeed: 5, windGust: 8 },
      hourly: hourly(6, { precipProb: 10, precip: 0, humidity: 40, weatherCode: 1 }),
      daily: [{ tempMax: 30, tempMin: 20, windMax: 8, windGustMax: 10, uvMax: 5 }],
    });
    expect(advice).toHaveLength(1);
    expect(advice[0]).toMatchObject({ id: "spray-ok", category: "spraying", severity: "good" });
  });
});

describe("buildFarmAdvice — heavy rain", () => {
  const advice = buildFarmAdvice({
    current: { temp: 24, humidity: 90, windSpeed: 10 },
    hourly: hourly(48, { precipProb: 80, precip: 5, humidity: 90, weatherCode: 65 }),
    daily: [{ tempMax: 30, tempMin: 22, uvMax: 5 }],
  });
  it("raises the full wet-weather advisory set", () => {
    expect(ids(advice)).toEqual(
      expect.arrayContaining([
        "spray-rain", "fert-rain", "harvest-rain", "harvest-dry",
        "irr-rain", "fish-rain", "bee-rain", "disease-risk",
      ]),
    );
    expect(advice).toHaveLength(8);
  });
  it("sorts most-severe first (danger before warn before info)", () => {
    const ranks = advice.map((a) => RANK[a.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(advice[0].severity).toBe("danger");
    expect(advice[advice.length - 1].id).toBe("irr-rain"); // the only info-level item
  });
  it("every advice carries all three languages (en/hi/bn)", () => {
    for (const a of advice) {
      expect(a.title.en && a.title.hi && a.title.bn).toBeTruthy();
      expect(a.body.en && a.body.hi && a.body.bn).toBeTruthy();
    }
  });
});

describe("buildFarmAdvice — heat wave (>=42C)", () => {
  const advice = buildFarmAdvice({
    current: { temp: 43, humidity: 30, windSpeed: 5 },
    hourly: hourly(6, { precipProb: 0, precip: 0, humidity: 30, weatherCode: 1 }),
    daily: [{ tempMax: 44, tempMin: 28, uvMax: 9 }],
  });
  it("raises heat + high-UV advisories across categories", () => {
    expect(ids(advice)).toEqual(
      expect.arrayContaining(["fert-heat", "irr-heat", "irr-uv", "live-heat", "fish-heat", "bee-heat"]),
    );
    expect(advice).toHaveLength(6);
  });
  it("suppresses spraying when it is too hot (>34C)", () => {
    expect(advice.find((a) => a.category === "spraying")).toBeUndefined();
  });
  it("interpolates the live temperature into the irrigation advice", () => {
    expect(byId(advice, "irr-heat").body.en).toContain("44°C");
  });
});

describe("buildFarmAdvice — cold wave (<=4C)", () => {
  const advice = buildFarmAdvice({
    current: { temp: 5, humidity: 50 },
    hourly: hourly(6, { precipProb: 0, precip: 0, humidity: 50, weatherCode: 1 }),
    daily: [{ tempMax: 15, tempMin: 3, uvMax: 3 }],
  });
  it("protects seedlings and livestock from cold", () => {
    expect(ids(advice)).toEqual(expect.arrayContaining(["sow-cold", "live-cold"]));
    expect(byId(advice, "sow-cold").body.en).toContain("3°C");
  });
});

describe("buildFarmAdvice — cyclone / severe storm", () => {
  const advice = buildFarmAdvice({
    current: { temp: 26, humidity: 88, windSpeed: 45, windGust: 60 },
    hourly: hourly(10, { precipProb: 90, precip: 10, humidity: 88, weatherCode: 95 }),
    daily: [{ tempMax: 30, tempMin: 24, windMax: 45, windGustMax: 65, uvMax: 4 }],
  });
  it("surfaces the critical livestock emergency first", () => {
    expect(advice[0]).toMatchObject({
      id: "live-storm", category: "livestock", severity: "critical", icon: "AlertTriangle",
    });
  });
});
