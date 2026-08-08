import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { paymentService } = await import("../paymentService.js");

describe("paymentService (WF-3)", () => {
  const clear = async () => { for (const p of await paymentService.all()) await paymentService.remove(p.id); };
  beforeEach(clear);

  it("coerces numeric fields and defaults status/date", async () => {
    const p = await paymentService.add({ employeeId: "e1", gross: "8000", bonus: "500", net: "8500" });
    expect(p.gross).toBe(8000);
    expect(p.bonus).toBe(500);
    expect(p.net).toBe(8500);
    expect(p.status).toBe("paid");
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("forEmployee returns only that employee's payments, newest first", async () => {
    await paymentService.add({ employeeId: "e1", net: 100, date: "2026-08-01" });
    await paymentService.add({ employeeId: "e1", net: 200, date: "2026-08-15" });
    await paymentService.add({ employeeId: "e2", net: 999, date: "2026-08-10" });
    const list = await paymentService.forEmployee("e1");
    expect(list).toHaveLength(2);
    expect(list[0].date).toBe("2026-08-15"); // newest first
  });

  it("monthTotals sums paid vs pending for the month", async () => {
    await paymentService.add({ employeeId: "e1", net: 5000, date: "2026-09-05", status: "paid" });
    await paymentService.add({ employeeId: "e2", net: 3000, date: "2026-09-20", status: "pending" });
    await paymentService.add({ employeeId: "e3", net: 111, date: "2026-08-01", status: "paid" });
    const t = await paymentService.monthTotals("2026-09");
    expect(t.count).toBe(2);
    expect(t.paid).toBe(5000);
    expect(t.pending).toBe(3000);
  });
});
