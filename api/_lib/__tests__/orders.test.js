import { describe, it, expect } from "vitest";
import { validateOrderInput, computeOrderTotals, publicOrder } from "../orders.js";

describe("validateOrderInput", () => {
  it("accepts items and merges duplicate listing ids", () => {
    const { value, error } = validateOrderInput({
      items: [{ listingId: "a", quantity: 2 }, { listingId: "a", quantity: 3 }, { listingId: "b", quantity: 1 }],
      deliveryAddr: { line1: "Village Rd", district: "Jhargram" },
    });
    expect(error).toBeUndefined();
    expect(value.items).toEqual([{ listingId: "a", quantity: 5 }, { listingId: "b", quantity: 1 }]);
    expect(value.deliveryAddr).toEqual({ line1: "Village Rd", district: "Jhargram" });
  });

  it("rejects empty / malformed items", () => {
    expect(validateOrderInput({ items: [] }).error).toMatch(/items/);
    expect(validateOrderInput({}).error).toMatch(/items/);
    expect(validateOrderInput({ items: [{ quantity: 1 }] }).error).toMatch(/listingId/);
    expect(validateOrderInput({ items: [{ listingId: "a", quantity: 0 }] }).error).toMatch(/quantity/);
    expect(validateOrderInput({ items: [{ listingId: "a", quantity: -2 }] }).error).toMatch(/quantity/);
  });

  it("ignores a non-object delivery address", () => {
    const { value } = validateOrderInput({ items: [{ listingId: "a", quantity: 1 }], deliveryAddr: "somewhere" });
    expect(value.deliveryAddr).toBe(null);
  });
});

describe("computeOrderTotals", () => {
  it("computes line and order totals in paise", () => {
    const lines = [
      { listing: { id: "a", title: "Paddy", price_paise: 230000 }, quantity: 2 },
      { listing: { id: "b", title: "Seed",  price_paise: 4000 },   quantity: 5 },
    ];
    const t = computeOrderTotals(lines);
    expect(t.items[0]).toMatchObject({ listing_id: "a", unit_price_paise: 230000, quantity: 2, line_total_paise: 460000 });
    expect(t.subtotal_paise).toBe(480000);   // 460000 + 20000
    expect(t.total_paise).toBe(480000);       // no shipping
  });

  it("handles bigint columns returned as strings and adds shipping", () => {
    const lines = [{ listing: { id: "a", title: "X", price_paise: "150000" }, quantity: 3 }];
    const t = computeOrderTotals(lines, 5000);
    expect(t.subtotal_paise).toBe(450000);
    expect(t.shipping_paise).toBe(5000);
    expect(t.total_paise).toBe(455000);
  });
});

describe("publicOrder", () => {
  it("maps DB rows to rupees + item lines", () => {
    const out = publicOrder(
      { id: "o1", buyer_id: "b", seller_id: "s", status: "confirmed",
        subtotal_paise: "480000", shipping_paise: "0", total_paise: "480000",
        currency: "INR", delivery_addr: { district: "Jhargram" },
        created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z" },
      [{ listing_id: "a", title_snapshot: "Paddy", unit_price_paise: "230000", quantity: "2", line_total_paise: "460000" }],
    );
    expect(out).toMatchObject({ id: "o1", status: "confirmed", total: 4800, totalPaise: 480000 });
    expect(out.deliveryAddr).toEqual({ district: "Jhargram" });
    expect(out.items[0]).toEqual({ listingId: "a", title: "Paddy", unitPrice: 2300, quantity: 2, lineTotal: 4600 });
  });
});
