import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockStorage = {
  getItem: vi.fn((k) => store[k] ?? null),
  setItem: vi.fn((k, v) => { store[k] = String(v); }),
  removeItem: vi.fn((k) => { delete store[k]; }),
};
Object.keys(store).forEach((k) => delete store[k]);

vi.stubGlobal("localStorage", mockStorage);

const { storage } = await import("../storage.js");

describe("storage", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.clearAllMocks();
  });

  it("set + get round-trips a value", () => {
    storage.set("test_key", { a: 1 });
    expect(storage.get("test_key")).toEqual({ a: 1 });
  });

  it("returns fallback for missing key", () => {
    expect(storage.get("nope", 42)).toBe(42);
  });

  it("remove deletes a key", () => {
    storage.set("x", "hello");
    storage.remove("x");
    expect(storage.get("x", null)).toBeNull();
  });

  it("stores primitives correctly", () => {
    storage.set("str", "hi");
    storage.set("num", 99);
    storage.set("bool", true);
    expect(storage.get("str")).toBe("hi");
    expect(storage.get("num")).toBe(99);
    expect(storage.get("bool")).toBe(true);
  });
});
