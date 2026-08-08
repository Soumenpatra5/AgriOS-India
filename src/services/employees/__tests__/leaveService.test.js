import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { leaveService, leaveDays, LEAVE_TYPES } = await import("../leaveService.js");

describe("leaveService (WF-4)", () => {
  const clear = async () => {
    for (const t of LEAVE_TYPES) { /* no-op */ }
    // remove all leaves across employees used in tests
    for (const id of ["L1", "L2"]) for (const l of await leaveService.forEmployee(id)) await leaveService.remove(l.id);
  };
  beforeEach(clear);

  describe("leaveDays", () => {
    it("counts an inclusive whole-day span", () => {
      expect(leaveDays("2026-08-10", "2026-08-10")).toBe(1);
      expect(leaveDays("2026-08-10", "2026-08-12")).toBe(3);
    });
    it("defaults toDate to fromDate and rejects invalid ranges", () => {
      expect(leaveDays("2026-08-10")).toBe(1);
      expect(leaveDays("2026-08-12", "2026-08-10")).toBe(0);
      expect(leaveDays("")).toBe(0);
    });
  });

  it("apply creates a pending request with computed days", async () => {
    const l = await leaveService.apply({ employeeId: "L1", type: "casual", fromDate: "2026-08-01", toDate: "2026-08-03", reason: "family" });
    expect(l.status).toBe("pending");
    expect(l.days).toBe(3);
    expect(l.appliedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("approve/reject update status", async () => {
    const l = await leaveService.apply({ employeeId: "L1", type: "sick", fromDate: "2026-08-05" });
    await leaveService.approve(l.id);
    let rows = await leaveService.forEmployee("L1");
    expect(rows.find((r) => r.id === l.id).status).toBe("approved");
    const l2 = await leaveService.apply({ employeeId: "L1", type: "casual", fromDate: "2026-08-09" });
    await leaveService.reject(l2.id);
    rows = await leaveService.forEmployee("L1");
    expect(rows.find((r) => r.id === l2.id).status).toBe("rejected");
  });

  it("balance subtracts approved days from the annual allowance", async () => {
    const a = await leaveService.apply({ employeeId: "L2", type: "casual", fromDate: "2026-03-01", toDate: "2026-03-02" }); // 2d
    await leaveService.approve(a.id);
    const b = await leaveService.apply({ employeeId: "L2", type: "casual", fromDate: "2026-04-01" }); // pending, not counted
    const bal = await leaveService.balance("L2", 2026);
    const casual = bal.find((x) => x.type === "casual");
    expect(casual.allowance).toBe(12);
    expect(casual.used).toBe(2);        // only the approved one
    expect(casual.remaining).toBe(10);
  });
});
