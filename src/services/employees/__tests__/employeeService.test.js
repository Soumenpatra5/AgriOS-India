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

  describe("attendance (WF-2)", () => {
    const clearEmployees = async () => {
      for (const e of await employeeService.getAll()) await employeeService.remove(e.id);
    };

    it("workedValue maps statuses to day fractions", () => {
      expect(employeeService.workedValue("present")).toBe(1);
      expect(employeeService.workedValue("late")).toBe(1);
      expect(employeeService.workedValue("overtime")).toBe(1);
      expect(employeeService.workedValue("halfday")).toBe(0.5);
      expect(employeeService.workedValue("absent")).toBe(0);
      expect(employeeService.workedValue("weekly_off")).toBe(0);
    });

    it("mark stores extra fields and upserts one row per day", async () => {
      const e = await employeeService.add({ name: "AttTest" });
      await employeeService.mark(e.id, { status: "present", checkIn: "09:00", overtimeHours: 2 }, "2026-08-10");
      let rows = await employeeService.getAttendance(e.id);
      expect(rows[0].checkIn).toBe("09:00");
      expect(rows[0].overtimeHours).toBe(2);
      await employeeService.mark(e.id, "absent", "2026-08-10"); // legacy string, same day
      rows = await employeeService.getAttendance(e.id);
      expect(rows.filter((r) => r.date === "2026-08-10")).toHaveLength(1);
      expect(rows.find((r) => r.date === "2026-08-10").status).toBe("absent");
      await employeeService.remove(e.id);
    });

    it("monthAttendance aggregates counts, overtime hours and percent", async () => {
      const e = await employeeService.add({ name: "MonthTest" });
      await employeeService.mark(e.id, { status: "present" }, "2026-09-01");
      await employeeService.mark(e.id, { status: "present", overtimeHours: 3 }, "2026-09-02");
      await employeeService.mark(e.id, { status: "halfday" }, "2026-09-03");
      await employeeService.mark(e.id, { status: "absent" }, "2026-09-04");
      await employeeService.mark(e.id, { status: "weekly_off" }, "2026-09-05");
      const m = await employeeService.monthAttendance(e.id, "2026-09");
      expect(m.counts.present).toBe(2);
      expect(m.counts.halfday).toBe(1);
      expect(m.counts.absent).toBe(1);
      expect(m.overtimeHours).toBe(3);
      expect(m.worked).toBe(2.5);        // 2 + 0.5
      expect(m.workingDays).toBe(4);     // excludes the weekly_off
      expect(m.percent).toBe(63);        // round(2.5 / 4 * 100)
      await employeeService.remove(e.id);
    });

    it("attendanceSummary rolls up today's statuses", async () => {
      await clearEmployees();
      const a = await employeeService.add({ name: "SumA" });
      const b = await employeeService.add({ name: "SumB" });
      const c = await employeeService.add({ name: "SumC" });
      await employeeService.mark(a.id, "present");
      await employeeService.mark(b.id, "absent");
      // c left unmarked
      const s = await employeeService.attendanceSummary();
      expect(s.total).toBe(3);
      expect(s.present).toBe(1);
      expect(s.absent).toBe(1);
      expect(s.notMarked).toBe(1);
      await clearEmployees();
    });
  });
});
