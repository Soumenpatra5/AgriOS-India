import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const { getFavorites, toggleFavorite, isFavorite } = await import("../favorites.js");

describe("favorites", () => {
  beforeEach(() => { Object.keys(store).forEach((k) => delete store[k]); });

  it("starts empty", () => {
    expect(getFavorites()).toEqual([]);
    expect(isFavorite("cropExpert")).toBe(false);
  });

  it("toggle adds then removes an id", () => {
    toggleFavorite("cropExpert");
    expect(isFavorite("cropExpert")).toBe(true);
    expect(getFavorites()).toEqual(["cropExpert"]);

    toggleFavorite("cropExpert");
    expect(isFavorite("cropExpert")).toBe(false);
    expect(getFavorites()).toEqual([]);
  });

  it("keeps multiple favorites independent", () => {
    toggleFavorite("a");
    toggleFavorite("b");
    expect(getFavorites()).toEqual(["a", "b"]);
    toggleFavorite("a");
    expect(getFavorites()).toEqual(["b"]);
  });

  it("returns the updated list from toggle", () => {
    const list = toggleFavorite("x");
    expect(list).toEqual(["x"]);
  });
});
