import { describe, it, expect } from "vitest";
import { severityEngine, SEVERITY_LEVELS } from "../severityEngine.js";

describe("severityEngine.parse", () => {
  it("defaults to Mild when severity is missing", () => {
    expect(severityEngine.parse(null).level).toBe("Mild");
    expect(severityEngine.parse("").level).toBe("Mild");
  });
  it("maps Claude's aliases to canonical levels", () => {
    expect(severityEngine.parse("emergency").level).toBe("Critical");
    expect(severityEngine.parse("medium").level).toBe("Moderate");
    expect(severityEngine.parse("normal").level).toBe("Healthy");
    expect(severityEngine.parse("very mild").level).toBe("VeryMild");
    expect(severityEngine.parse("unable to detect").level).toBe("Mild");
  });
  it("is case- and whitespace-insensitive", () => {
    expect(severityEngine.parse("  SEVERE  ").level).toBe("Severe");
  });
  it("falls back to Mild's attributes for an unrecognised value", () => {
    const s = severityEngine.parse("gibberish");
    expect(s.label).toBe("Mild");
    expect(s.urgency).toBe("monitor");
  });
});

describe("severityEngine.get", () => {
  it("returns the full attribute set for a level", () => {
    expect(severityEngine.get("Critical")).toMatchObject({ level: "Critical", urgency: "emergency", order: 5 });
  });
  it("falls back to Mild for an unknown level", () => {
    expect(severityEngine.get("Nope")).toMatchObject({ level: "Nope", label: "Mild" });
  });
});

describe("severityEngine ordering + urgency helpers", () => {
  it("compare orders by increasing severity", () => {
    expect(severityEngine.compare("Mild", "Severe")).toBeLessThan(0);
    expect(severityEngine.compare("Critical", "Healthy")).toBeGreaterThan(0);
    expect(severityEngine.compare("Moderate", "Moderate")).toBe(0);
  });
  it("isUrgent is true for Severe and Critical only", () => {
    expect(severityEngine.isUrgent("Severe")).toBe(true);
    expect(severityEngine.isUrgent("Critical")).toBe(true);
    expect(severityEngine.isUrgent("Moderate")).toBe(false);
    expect(severityEngine.isUrgent("Mild")).toBe(false);
  });
  it("isEmergency is true for Critical only", () => {
    expect(severityEngine.isEmergency("Critical")).toBe(true);
    expect(severityEngine.isEmergency("Severe")).toBe(false);
    expect(severityEngine.isEmergency("whatever")).toBe(false);
  });
  it("all() lists every level in order", () => {
    const all = severityEngine.all();
    expect(all).toHaveLength(SEVERITY_LEVELS.length);
    expect(all[0].level).toBe("Healthy");
    expect(all.at(-1).level).toBe("Critical");
  });
});
