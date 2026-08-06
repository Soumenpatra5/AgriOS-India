import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { reminderService } = await import("../reminderService.js");

const future = () => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

describe("reminderService", () => {
  beforeEach(() => { Object.keys(store).forEach((k) => delete store[k]); vi.useRealTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("has() is false before setting", () => {
    expect(reminderService.has("t1")).toBe(false);
    expect(reminderService.get("t1")).toBeNull();
  });

  it("set() persists a reminder and has()/get() read it back", () => {
    const dueDate = future();
    reminderService.set("t1", { label: "Spray — Paddy", dueDate, hoursBefore: 24 });
    expect(reminderService.has("t1")).toBe(true);
    const r = reminderService.get("t1");
    expect(r.label).toBe("Spray — Paddy");
    expect(r.dueDate).toBe(dueDate);
    expect(r.hoursBefore).toBe(24);
    expect(r.fired).toBe(false);
    expect(typeof r.fireAt).toBe("number");
  });

  it("computes fireAt as hoursBefore ahead of the due date", () => {
    reminderService.set("t1", { label: "x", dueDate: "2030-06-15", hoursBefore: 24 });
    const r = reminderService.get("t1");
    const due = new Date("2030-06-15").getTime();
    expect(r.fireAt).toBe(due - 24 * 3600 * 1000);
  });

  it("remove() deletes the reminder", () => {
    reminderService.set("t1", { label: "x", dueDate: future(), hoursBefore: 24 });
    reminderService.remove("t1");
    expect(reminderService.has("t1")).toBe(false);
  });

  it("defaults hoursBefore to 24", () => {
    reminderService.set("t1", { label: "x", dueDate: future() });
    expect(reminderService.get("t1").hoursBefore).toBe(24);
  });

  it("fires the notification and marks the reminder fired when the time arrives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-14T00:00:00Z"));
    // due tomorrow, remind 1h before → fires within the hour
    reminderService.set("t1", { label: "x", dueDate: "2030-06-14", hoursBefore: -2 });
    vi.advanceTimersByTime(3 * 3600 * 1000);
    expect(reminderService.get("t1").fired).toBe(true);
  });

  it("boot() reschedules stored future reminders without throwing", () => {
    reminderService.set("t1", { label: "x", dueDate: future(), hoursBefore: 24 });
    expect(() => reminderService.boot()).not.toThrow();
    expect(reminderService.has("t1")).toBe(true);
  });

  it("count() reflects the number of reminders", () => {
    expect(reminderService.count()).toBe(0);
    reminderService.set("t1", { label: "a", dueDate: future() });
    reminderService.set("t2", { label: "b", dueDate: future() });
    expect(reminderService.count()).toBe(2);
  });

  it("clear() removes every reminder", () => {
    reminderService.set("t1", { label: "a", dueDate: future() });
    reminderService.set("t2", { label: "b", dueDate: future() });
    reminderService.clear();
    expect(reminderService.count()).toBe(0);
    expect(reminderService.has("t1")).toBe(false);
  });
});
