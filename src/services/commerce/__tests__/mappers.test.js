import { describe, it, expect } from "vitest";
import {
  listingToProduct, productToListingPayload, serverOrderToClient,
  clientStatusToAction, cartLinesToOrderItems, sellersInCart,
} from "../mappers.js";

describe("listingToProduct", () => {
  it("maps API listing fields to the client product shape", () => {
    const p = listingToProduct({
      id: "l1", sellerId: "s1", sellerName: "Asha", title: "Paddy", category: "crop",
      unit: "quintal", price: 2300, qtyAvailable: 40, status: "active",
      description: "Fresh", media: [{ url: "u0", sort: 0 }], createdAt: "t",
    });
    expect(p).toMatchObject({
      id: "l1", sellerId: "s1", sellerName: "Asha", name: "Paddy", category: "crop",
      unit: "quintal", price: 2300, stock: 40, status: "published", reserved: 0,
    });
    expect(p.media).toEqual([{ url: "u0", sort: 0 }]);
  });

  it("maps non-active statuses so drafts/paused read as unpublished", () => {
    expect(listingToProduct({ status: "draft" }).status).toBe("draft");
    expect(listingToProduct({ status: "paused" }).status).toBe("draft");
    expect(listingToProduct({ status: "archived" }).status).toBe("archived");
  });
});

describe("productToListingPayload", () => {
  it("maps a product form to the API payload with server field names", () => {
    const payload = productToListingPayload({
      name: "Paddy", description: "d", category: "crop", unit: "quintal",
      price: 2300, stock: 40, minOrder: 2, status: "published", state: "WB", media: [],
    });
    expect(payload).toMatchObject({
      title: "Paddy", category: "crop", unit: "quintal", price: 2300,
      qty_available: 40, min_order: 2, status: "active", state: "WB",
    });
    expect(payload).not.toHaveProperty("district"); // omitted when absent
  });
});

describe("serverOrderToClient", () => {
  it("maps status vocabulary and item lines", () => {
    const o = serverOrderToClient({
      id: "o1", buyerId: "b", sellerId: "s", status: "confirmed",
      subtotal: 4800, total: 4800, deliveryAddr: { district: "Jhargram" },
      items: [{ listingId: "a", title: "Paddy", unitPrice: 2300, quantity: 2, lineTotal: 4600 }],
      createdAt: "t",
    });
    expect(o.status).toBe("processing");
    expect(o.serverStatus).toBe("confirmed");
    expect(o.paid).toBe(true);
    expect(o.items[0]).toMatchObject({ productId: "a", name: "Paddy", qty: 2, unitPrice: 2300, lineTotal: 4600 });
  });

  it("maps pending_payment -> pending (unpaid)", () => {
    const o = serverOrderToClient({ id: "o", status: "pending_payment", items: [] });
    expect(o.status).toBe("pending");
    expect(o.paid).toBe(false);
  });
});

describe("clientStatusToAction", () => {
  it("maps client statuses to server transition actions", () => {
    expect(clientStatusToAction("shipped")).toBe("ship");
    expect(clientStatusToAction("delivered")).toBe("deliver");
    expect(clientStatusToAction("cancelled")).toBe("cancel");
    expect(clientStatusToAction("processing")).toBe(null);
  });
});

describe("cart helpers", () => {
  const lines = [
    { product: { id: "l1", sellerId: "s1" }, qty: 2, saved: false, problem: null },
    { product: { id: "l2", sellerId: "s1" }, qty: 1, saved: false, problem: null },
    { product: { id: "l3", sellerId: "s2" }, qty: 5, saved: true, problem: null },   // saved -> excluded
    { product: { id: "l4", sellerId: "s3" }, qty: 1, saved: false, problem: "stock" }, // problem -> excluded
  ];
  it("builds server order items from valid lines only", () => {
    expect(cartLinesToOrderItems(lines)).toEqual([
      { listingId: "l1", quantity: 2 },
      { listingId: "l2", quantity: 1 },
    ]);
  });
  it("lists distinct sellers among valid lines", () => {
    expect(sellersInCart(lines)).toEqual(["s1"]);
  });
});
