import { describe, it, expect } from "vitest";
import { can, requiresPin, roleRank, CAPABILITIES } from "../permissions.js";

describe("can (permission matrix)", () => {
  it("owner has every capability", () => {
    for (const cap of CAPABILITIES) expect(can("owner", cap)).toBe(true);
  });

  it("worker has no sensitive capabilities (but keeps the roster)", () => {
    expect(can("worker", "team.view")).toBe(true);
    for (const cap of CAPABILITIES.filter((c) => c !== "team.view")) {
      expect(can("worker", cap), cap).toBe(false);
    }
  });

  it("keeps backup/erase and the owner's money and papers to the owner alone", () => {
    for (const cap of ["data.manage", "profile.manage"]) {
      expect(can("owner", cap), cap).toBe(true);
      expect(can("manager", cap), cap).toBe(false);
      expect(can("worker", cap), cap).toBe(false);
    }
  });

  it("manager manages team + views salary/docs/finance, but can't delete records or change settings", () => {
    for (const cap of ["team.view", "team.manage", "salary.view", "documents.view", "finance.view", "payroll.manage"]) {
      expect(can("manager", cap)).toBe(true);
    }
    expect(can("manager", "records.delete")).toBe(false);
    expect(can("manager", "settings.manage")).toBe(false);
  });

  it("treats an unknown/missing role as the most restricted", () => {
    expect(can("intruder", "salary.view")).toBe(false);
    expect(can(undefined, "team.manage")).toBe(false);
    expect(can("intruder", "team.view")).toBe(true); // worker-level default
  });
});

describe("requiresPin", () => {
  it("needs a PIN to elevate when one is set", () => {
    expect(requiresPin("worker", "owner", true)).toBe(true);
    expect(requiresPin("worker", "manager", true)).toBe(true);
    expect(requiresPin("manager", "owner", true)).toBe(true);
  });
  it("is free to drop to a lower/equal role", () => {
    expect(requiresPin("owner", "worker", true)).toBe(false);
    expect(requiresPin("manager", "manager", true)).toBe(false);
  });
  it("is free when no PIN is set", () => {
    expect(requiresPin("worker", "owner", false)).toBe(false);
  });
  it("ranks owner > manager > worker", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("manager"));
    expect(roleRank("manager")).toBeGreaterThan(roleRank("worker"));
  });
});
