/* Thin client for the commerce backend (/api/commerce/*). Every call carries the
   Firebase ID token via authFetch; responses are JSON. Non-2xx responses throw
   an Error with `.status` and the server's message, so callers can show it.

   authFetch is imported lazily (inside req) so that merely importing this client
   — which the marketplace services do at module load — never drags in the
   Firebase SDK. It loads only when a commerce call is actually made. */

async function req(path, { method = "GET", body, query } = {}) {
  const { authFetch } = await import("../firebase/authFetch.js");
  let url = "/api/commerce" + path;
  if (query) {
    const pairs = Object.entries(query).filter(([, v]) => v != null && v !== "");
    const qs = new URLSearchParams(pairs).toString();
    if (qs) url += "?" + qs;
  }
  const res = await authFetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const commerceApi = {
  // identity — verify -> ensureUser -> the row, including agrios_user_id
  me: () => req("/me"),                                            // { user }
  updateMe: (patch) => req("/me", { method: "PATCH", body: patch }), // { user }

  // listings
  listings: (params) => req("/listings", { query: params }),        // { items, nextCursor }
  listing: (id) => req(`/listings/${encodeURIComponent(id)}`),      // { listing }
  createListing: (payload) => req("/listings", { method: "POST", body: payload }),
  updateListing: (id, patch) => req(`/listings/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  deleteListing: (id) => req(`/listings/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // orders
  createOrder: (payload) => req("/orders", { method: "POST", body: payload }), // { order, payment }
  orders: (role) => req("/orders", { query: { role } }),            // { orders }
  order: (id) => req(`/orders/${encodeURIComponent(id)}`),          // { order }
  orderAction: (id, action) => req(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: { action } }),

  // reviews
  reviews: (subjectType, subjectId) => req("/reviews", { query: { subjectType, subjectId } }),
  createReview: (payload) => req("/reviews", { method: "POST", body: payload }),
};
