import { describe, it, expect } from "vitest";

const { experimentTracker } = await import("../experimentTracker.js");

/* compare() feeds the comparison screen, so what it drops the screen can never
   show. These cover the shape that screen depends on. */
describe("experimentTracker.compare", () => {
  it("carries final metrics through, not just the inputs", async () => {
    const a = await experimentTracker.create({ name: "baseline" });
    await experimentTracker.logParams(a.id, { epochs: 10 });
    await experimentTracker.complete(a.id, { finalMetrics: { accuracy: 0.91 } });

    const [row] = await experimentTracker.compare([a.id]);
    expect(row.name).toBe("baseline");
    expect(row.params).toEqual({ epochs: 10 });
    expect(row.finalMetrics).toEqual({ accuracy: 0.91 });
    expect(row.status).toBe("completed");
  });

  it("gives a run with no metrics an empty object, so callers need no guard", async () => {
    const a = await experimentTracker.create({ name: "untouched" });
    const [row] = await experimentTracker.compare([a.id]);
    expect(row.finalMetrics).toEqual({});
    expect(row.status).toBe("created");
  });

  it("keeps the requested order and silently skips ids that do not exist", async () => {
    const a = await experimentTracker.create({ name: "first" });
    const b = await experimentTracker.create({ name: "second" });

    const rows = await experimentTracker.compare([a.id, "exp-missing", b.id]);
    expect(rows.map((r) => r.name)).toEqual(["first", "second"]);
  });

  it("returns nothing for an empty selection rather than throwing", async () => {
    expect(await experimentTracker.compare([])).toEqual([]);
  });
});
