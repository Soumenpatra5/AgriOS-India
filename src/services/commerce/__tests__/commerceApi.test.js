import { describe, it, expect, vi, beforeEach } from "vitest";

/* Mock authFetch so the API client is tested without Firebase or a network. */
const authFetch = vi.fn();
vi.mock("../../firebase/authFetch.js", () => ({ authFetch: (...a) => authFetch(...a) }));

const { commerceApi } = await import("../commerceApi.js");

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok, status, json: async () => body,
});

beforeEach(() => authFetch.mockReset());

describe("commerceApi request building", () => {
  it("GET listings encodes query params and drops empties", async () => {
    authFetch.mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));
    await commerceApi.listings({ q: "paddy", category: "crop", state: "", price_max: null });
    const [url, opts] = authFetch.mock.calls[0];
    expect(url).toBe("/api/commerce/listings?q=paddy&category=crop");
    expect(opts.method).toBe("GET");
  });

  it("POST createOrder sends a JSON body with content-type", async () => {
    authFetch.mockResolvedValue(jsonResponse({ order: {}, payment: {} }, { status: 201 }));
    await commerceApi.createOrder({ items: [{ listingId: "a", quantity: 1 }] });
    const [url, opts] = authFetch.mock.calls[0];
    expect(url).toBe("/api/commerce/orders");
    expect(opts.method).toBe("POST");
    expect(opts.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(opts.body)).toEqual({ items: [{ listingId: "a", quantity: 1 }] });
  });

  it("PATCH orderAction targets the id and sends the action", async () => {
    authFetch.mockResolvedValue(jsonResponse({ order: {} }));
    await commerceApi.orderAction("o1", "ship");
    const [url, opts] = authFetch.mock.calls[0];
    expect(url).toBe("/api/commerce/orders/o1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ action: "ship" });
  });

  it("throws an Error carrying status + server message on non-2xx", async () => {
    authFetch.mockResolvedValue(jsonResponse({ error: { message: "Not enough stock" } }, { ok: false, status: 409 }));
    await expect(commerceApi.createOrder({ items: [] })).rejects.toMatchObject({
      message: "Not enough stock",
      status: 409,
    });
  });
});
