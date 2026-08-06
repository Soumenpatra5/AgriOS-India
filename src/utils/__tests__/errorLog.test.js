import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});
vi.stubGlobal("location", { href: "http://localhost/test" });

const { errorLog } = await import("../errorLog.js");

describe("errorLog", () => {
  beforeEach(() => { Object.keys(store).forEach((k) => delete store[k]); });

  it("starts empty", () => {
    expect(errorLog.all()).toEqual([]);
    expect(errorLog.count()).toBe(0);
  });

  it("records an Error with message, stack, url and time", () => {
    const err = new Error("kaboom");
    errorLog.record(err, { componentStack: "at <Home>" });
    const [e] = errorLog.all();
    expect(e.message).toBe("kaboom");
    expect(e.stack).toContain("kaboom");
    expect(e.component).toBe("at <Home>");
    expect(e.url).toBe("http://localhost/test");
    expect(typeof e.time).toBe("number");
  });

  it("stores newest first", () => {
    errorLog.record(new Error("first"));
    errorLog.record(new Error("second"));
    expect(errorLog.all().map((e) => e.message)).toEqual(["second", "first"]);
  });

  it("caps the log at 20 entries", () => {
    for (let i = 0; i < 30; i++) errorLog.record(new Error("e" + i));
    const all = errorLog.all();
    expect(all).toHaveLength(20);
    // newest retained, oldest dropped
    expect(all[0].message).toBe("e29");
    expect(all.some((e) => e.message === "e9")).toBe(false);
  });

  it("tolerates a non-Error value", () => {
    errorLog.record("just a string");
    expect(errorLog.all()[0].message).toBe("just a string");
  });

  it("handles a missing info argument", () => {
    errorLog.record(new Error("no info"));
    expect(errorLog.all()[0].component).toBe("");
  });

  it("truncates very long messages", () => {
    errorLog.record(new Error("x".repeat(1000)));
    expect(errorLog.all()[0].message.length).toBeLessThanOrEqual(300);
  });

  it("clear empties the log", () => {
    errorLog.record(new Error("boom"));
    errorLog.clear();
    expect(errorLog.count()).toBe(0);
  });
});
