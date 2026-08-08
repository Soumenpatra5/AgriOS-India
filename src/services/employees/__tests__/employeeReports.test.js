import { describe, it, expect, vi } from "vitest";

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const { employeeReports } = await import("../employeeReports.js");

describe("employeeReports (WF-7)", () => {
  it("rosterRows maps employees to labelled CSV columns", () => {
    const rows = employeeReports.rosterRows([
      { code: "EMP-0001", name: "Ramesh", designation: "farm_manager", department: "dairy", type: "permanent", status: "active", phone: "999", dailyWage: 400, joiningDate: "2026-01-01" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Code: "EMP-0001", Name: "Ramesh", Designation: "Farm Manager",
      Department: "Dairy Unit", Type: "Permanent", Status: "Active", Phone: "999",
      "Daily Wage": 400, Joined: "2026-01-01",
    });
  });

  it("rosterRows handles legacy role fallback and empty fields", () => {
    const [r] = employeeReports.rosterRows([{ name: "Old", role: "worker" }]);
    expect(r.Designation).toBe("Worker");
    expect(r.Department).toBe("");
    expect(r.Code).toBe("");
  });

  it("wageRows maps wage summaries to CSV columns", () => {
    const rows = employeeReports.wageRows([
      { employee: { code: "EMP-0002", name: "Bimal" }, daysWorked: 20, overtimeHours: 3, gross: 8180 },
    ]);
    expect(rows[0]).toEqual({ Code: "EMP-0002", Name: "Bimal", "Days Worked": 20, "Overtime Hrs": 3, Gross: 8180 });
  });
});
