import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { employeeService, EMPLOYEE_TYPES, DEPARTMENTS, STATUSES } =
  await import("../employeeService.js");

describe("employeeService — WF-1 profile logic", () => {
  beforeEach(() => { Object.keys(store).forEach((k) => delete store[k]); });

  describe("nextEmployeeCode", () => {
    it("starts at EMP-0001 for an empty list", () => {
      expect(employeeService.nextEmployeeCode([])).toBe("EMP-0001");
    });
    it("increments past the highest existing code", () => {
      const list = [{ code: "EMP-0001" }, { code: "EMP-0007" }, { code: "EMP-0003" }];
      expect(employeeService.nextEmployeeCode(list)).toBe("EMP-0008");
    });
    it("ignores records without a numeric code", () => {
      expect(employeeService.nextEmployeeCode([{ code: "" }, { name: "x" }])).toBe("EMP-0001");
    });
  });

  describe("label helpers", () => {
    it("resolves type, department and status labels", () => {
      expect(employeeService.typeLabel("daily_wage")).toBe("Daily Wage");
      expect(employeeService.deptLabel("poultry")).toBe("Poultry Unit");
      expect(employeeService.statusLabel("on_leave")).toBe("On Leave");
      expect(employeeService.statusTone("terminated")).toBe("red");
    });
    it("designationLabel falls back to legacy role, then Worker", () => {
      expect(employeeService.designationLabel("driver")).toBe("Driver");
      expect(employeeService.jobTitle({ designation: "farm_manager" })).toBe("Farm Manager");
      expect(employeeService.jobTitle({ role: "supervisor" })).toBe("Supervisor");
      expect(employeeService.jobTitle({})).toBe("Worker");
    });
    it("has complete taxonomies", () => {
      expect(EMPLOYEE_TYPES.length).toBe(8);
      expect(DEPARTMENTS.length).toBe(13);
      expect(STATUSES.length).toBe(8);
    });
  });

  describe("custom designations", () => {
    it("adds a custom designation and includes it in the list", () => {
      const id = employeeService.addCustomDesignation("Tractor Operator");
      expect(id).toBe("custom_tractor_operator");
      expect(employeeService.designations().some((d) => d.id === id)).toBe(true);
      expect(employeeService.designationLabel(id)).toBe("Tractor Operator");
    });
    it("keeps 'Other' last and does not duplicate", () => {
      employeeService.addCustomDesignation("Welder Sr");
      employeeService.addCustomDesignation("Welder Sr");
      const list = employeeService.designations();
      expect(list[list.length - 1].id).toBe("other");
      expect(list.filter((d) => d.id === "custom_welder_sr")).toHaveLength(1);
    });
    it("ignores blank labels", () => {
      expect(employeeService.addCustomDesignation("   ")).toBeNull();
    });
  });

  describe("add() defaults", () => {
    it("generates a code and applies status/type/joiningDate defaults", async () => {
      const rec = await employeeService.add({ name: "Ramesh" });
      expect(rec.code).toMatch(/^EMP-\d{4}$/);
      expect(rec.status).toBe("active");
      expect(rec.type).toBe("permanent");
      expect(rec.joiningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rec.name).toBe("Ramesh");
      await employeeService.remove(rec.id);
    });

    it("does not override provided values", async () => {
      const rec = await employeeService.add({ name: "Sita", status: "on_leave", type: "contract", code: "EMP-9000" });
      expect(rec.status).toBe("on_leave");
      expect(rec.type).toBe("contract");
      expect(rec.code).toBe("EMP-9000");
      await employeeService.remove(rec.id);
    });
  });
});
