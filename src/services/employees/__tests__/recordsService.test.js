import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { recordsService, SKILL_LEVELS, TRAINING_STATUSES } = await import("../recordsService.js");

describe("recordsService (WF-6)", () => {
  const clear = async () => {
    for (const kind of ["skill", "training", "performance"]) {
      for (const r of await recordsService.forEmployee("R1", kind)) await recordsService.remove(r.id);
    }
  };
  beforeEach(clear);

  it("label helpers resolve levels and statuses", () => {
    expect(recordsService.skillLevelLabel("advanced")).toBe("Advanced");
    expect(recordsService.trainingStatusLabel("completed")).toBe("Completed");
    expect(SKILL_LEVELS.length).toBe(4);
    expect(TRAINING_STATUSES.length).toBe(3);
  });

  it("adds kind-discriminated records with createdOn", async () => {
    const s = await recordsService.add("skill", { employeeId: "R1", name: "Milking", level: "expert" });
    expect(s.kind).toBe("skill");
    expect(s.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("forEmployee filters by kind", async () => {
    await recordsService.add("skill", { employeeId: "R1", name: "Driving" });
    await recordsService.add("training", { employeeId: "R1", name: "Safety 101", date: "2026-08-01" });
    await recordsService.add("performance", { employeeId: "R1", rating: "4", reviewDate: "2026-08-05" });
    expect(await recordsService.forEmployee("R1", "skill")).toHaveLength(1);
    expect(await recordsService.forEmployee("R1", "training")).toHaveLength(1);
    expect(await recordsService.forEmployee("R1", "performance")).toHaveLength(1);
    expect(await recordsService.forEmployee("R1")).toHaveLength(3); // all kinds
  });

  it("does not leak records across employees", async () => {
    await recordsService.add("skill", { employeeId: "R1", name: "A" });
    await recordsService.add("skill", { employeeId: "R2", name: "B" });
    expect(await recordsService.forEmployee("R1", "skill")).toHaveLength(1);
    for (const r of await recordsService.forEmployee("R2", "skill")) await recordsService.remove(r.id);
  });
});
