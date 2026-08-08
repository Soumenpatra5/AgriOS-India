import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { auditService } = await import("../auditService.js");

describe("auditService (WF-7)", () => {
  const clear = async () => { for (const a of await auditService.recent(999)) { /* remove via repo not exposed */ } };

  it("logs an action with employee context and timestamp", async () => {
    const rec = await auditService.log("employee.created", { employeeId: "AU1", employeeName: "Test" });
    expect(rec.action).toBe("employee.created");
    expect(rec.employeeId).toBe("AU1");
    expect(rec.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("forEmployee returns that employee's entries, newest first", async () => {
    await auditService.log("payment.recorded", { employeeId: "AU2", detail: "₹100", at: undefined });
    await auditService.log("document.verified", { employeeId: "AU2", detail: "ID" });
    await auditService.log("employee.created", { employeeId: "AU3" });
    const rows = await auditService.forEmployee("AU2");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.employeeId === "AU2")).toBe(true);
    // newest first (descending timestamps)
    expect(rows[0].at >= rows[rows.length - 1].at).toBe(true);
  });

  it("never throws even if given nothing", async () => {
    await expect(auditService.log("x")).resolves.toBeTruthy();
  });
});
