import { describe, it, expect } from "vitest";
import {
  rupeesToPaise, paiseToRupees, validateListingInput, publicListing,
  encodeCursor, decodeCursor, clampLimit,
} from "../listings.js";

describe("money conversion", () => {
  it("rupees -> paise rounds and rejects bad input", () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(10.005)).toBe(1001);   // rounds
    expect(rupeesToPaise("2500")).toBe(250000);
    expect(rupeesToPaise(0)).toBe(0);
    expect(rupeesToPaise(-1)).toBe(null);
    expect(rupeesToPaise("abc")).toBe(null);
  });
  it("paise -> rupees", () => {
    expect(paiseToRupees(250000)).toBe(2500);
    expect(paiseToRupees(1001)).toBe(10.01);
  });
});

describe("validateListingInput (create)", () => {
  const good = { title: " Fresh Paddy ", category: "crop", unit: "quintal", price: 2300, qty_available: 40 };

  it("accepts a valid listing and converts price to paise", () => {
    const { value, error } = validateListingInput(good);
    expect(error).toBeUndefined();
    expect(value.title).toBe("Fresh Paddy");        // trimmed
    expect(value.price_paise).toBe(230000);
    expect(value).not.toHaveProperty("price");
    expect(value.qty_available).toBe(40);
    expect(value.media).toEqual([]);
  });

  it("rejects missing required fields", () => {
    expect(validateListingInput({}).error).toMatch(/title/);
    expect(validateListingInput({ ...good, category: "widgets" }).error).toMatch(/category/);
    expect(validateListingInput({ ...good, unit: "furlong" }).error).toMatch(/unit/);
    expect(validateListingInput({ ...good, price: -5 }).error).toMatch(/price/);
    expect(validateListingInput({ ...good, qty_available: -1 }).error).toMatch(/qty_available/);
  });

  it("normalizes and caps media to 8 entries", () => {
    const media = Array.from({ length: 12 }, (_, i) => ({ url: `u${i}` }));
    const { value } = validateListingInput({ ...good, media });
    expect(value.media).toHaveLength(8);
    expect(value.media[0]).toEqual({ url: "u0", sort: 0 });
    // junk entries dropped
    expect(validateListingInput({ ...good, media: [{ nope: 1 }, { url: "" }] }).value.media).toEqual([]);
  });
});

describe("validateListingInput (partial / PATCH)", () => {
  it("only validates supplied fields", () => {
    const { value, error } = validateListingInput({ price: 99, status: "paused" }, { partial: true });
    expect(error).toBeUndefined();
    expect(value.price_paise).toBe(9900);
    expect(value.status).toBe("paused");
    expect(value).not.toHaveProperty("title");
  });
  it("still rejects an invalid supplied field", () => {
    expect(validateListingInput({ status: "bogus" }, { partial: true }).error).toMatch(/status/);
    expect(validateListingInput({ price: "x" }, { partial: true }).error).toMatch(/price/);
  });
});

describe("publicListing", () => {
  it("maps a DB row to the API shape with rupees + paise", () => {
    const out = publicListing({
      id: "l1", seller_id: "s1", seller_name: "Asha", title: "Paddy",
      category: "crop", unit: "quintal", price_paise: 230000, currency: "INR",
      qty_available: "40", min_order: "1", state: "WB", district: "Jhargram",
      status: "active", created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z",
      media: [{ url: "u0", sort: 0 }],
    });
    expect(out).toMatchObject({
      id: "l1", sellerId: "s1", sellerName: "Asha",
      price: 2300, pricePaise: 230000, qtyAvailable: 40, minOrder: 1,
      status: "active", media: [{ url: "u0", sort: 0 }],
    });
  });
});

describe("cursor + limit", () => {
  it("round-trips a keyset cursor and rejects garbage", () => {
    const c = encodeCursor({ created_at: "2026-08-12T00:00:00Z", id: "abc" });
    expect(decodeCursor(c)).toEqual({ createdAt: "2026-08-12T00:00:00Z", id: "abc" });
    expect(decodeCursor("not-base64!!")).toBe(null);
    expect(decodeCursor("")).toBe(null);
  });
  it("clamps the page size", () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(5)).toBe(5);
    expect(clampLimit(9999)).toBe(40);
    expect(clampLimit(-3)).toBe(20);
  });
});
