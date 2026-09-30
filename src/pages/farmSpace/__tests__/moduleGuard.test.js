import { describe, it, expect } from "vitest";
import { isModuleEnabled } from "../ModuleGuard.jsx";

describe("ModuleGuard — isModuleEnabled", () => {
  it("returns true when module is present and enabled", () => {
    const mods = [
      { module_id: "poultryDashboard", enabled: true, sort_order: 0 },
      { module_id: "dairyDashboard", enabled: true, sort_order: 1 },
    ];
    expect(isModuleEnabled(mods, "poultryDashboard")).toBe(true);
    expect(isModuleEnabled(mods, "dairyDashboard")).toBe(true);
  });

  it("returns false when module is present but enabled is false", () => {
    const mods = [
      { module_id: "poultryDashboard", enabled: false, sort_order: 0 },
    ];
    expect(isModuleEnabled(mods, "poultryDashboard")).toBe(false);
  });

  it("returns false when module is missing from the list", () => {
    const mods = [
      { module_id: "farmSpaceTasks", enabled: true, sort_order: 0 },
    ];
    expect(isModuleEnabled(mods, "poultryDashboard")).toBe(false);
    expect(isModuleEnabled(mods, "goatDashboard")).toBe(false);
  });

  it("returns false for empty or non-array input", () => {
    expect(isModuleEnabled([], "poultryDashboard")).toBe(false);
    expect(isModuleEnabled(null, "poultryDashboard")).toBe(false);
    expect(isModuleEnabled(undefined, "poultryDashboard")).toBe(false);
  });
});
