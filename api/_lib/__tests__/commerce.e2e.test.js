/* Commerce backend END-TO-END tests.

   Exercises the ACTUAL serverless handlers (auth → validation → transaction →
   webhook → fulfilment) against a real Postgres engine — PGlite exposed over a
   local Postgres wire socket, so the handlers' real porsager SQL runs for real.
   Only the two external edges are doubled: Firebase token verification (a test
   uid header) and Razorpay's network calls (order/refund). The webhook signature
   is verified for real. This closes the "the handlers have never actually run"
   gap without any cloud provisioning. */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

const WEBHOOK_SECRET = "whsec_e2e_test";
const held = vi.hoisted(() => ({ sql: null }));

// Firebase auth → trust an x-test-uid header (unauth when absent).
vi.mock("../../_middleware/verifyAuth.js", () => ({
  verifyToken: async (req) => (req.headers?.["x-test-uid"] ? { sub: req.headers["x-test-uid"] } : null),
}));
// DB client → the socket-backed porsager client (real SQL, real Postgres).
vi.mock("../../_lib/db.js", () => ({ getSql: () => held.sql }));
// Razorpay network calls doubled; verifyWebhookSignature stays real.
vi.mock("../../_lib/razorpay.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createRazorpayOrder: async ({ amountPaise }) => ({ id: "rzp_" + crypto.randomUUID().slice(0, 8), amount: amountPaise }),
  refundPayment: async () => ({ id: "rfnd_1", status: "processed" }),
}));

const listingsHandler    = (await import("../../commerce/listings.js")).default;
const listingItemHandler = (await import("../../commerce/listings/[id].js")).default;
const ordersHandler      = (await import("../../commerce/orders.js")).default;
const orderItemHandler   = (await import("../../commerce/orders/[id].js")).default;
const webhookHandler     = (await import("../../commerce/payments/webhook.js")).default;
const reviewsHandler     = (await import("../../commerce/reviews.js")).default;
const meHandler          = (await import("../../commerce/me.js")).default;

let pglite, server;

beforeAll(async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  pglite = await PGlite.create();
  await pglite.exec(await readFile(new URL("../../../supabase/migrations/0001_commerce_foundation.sql", import.meta.url), "utf8"));
  /* ensureUser() is shared with Farm Space, used at the start of every
     authenticated request here too, and 0007 touches farm_space_invitations
     as well as users — so 0002 has to exist first, exactly as it always does
     in any real environment (0007 has never once run without it already
     being there). */
  await pglite.exec(await readFile(new URL("../../../supabase/migrations/0002_farm_space.sql", import.meta.url), "utf8"));
  await pglite.exec(await readFile(new URL("../../../supabase/migrations/0007_agrios_user_id.sql", import.meta.url), "utf8"));
  // Bind to an OS-assigned ephemeral port (port 0) so parallel vitest workers
  // never collide on a fixed port; getServerConn() reports the resolved host:port.
  server = new PGLiteSocketServer({ db: pglite, port: 0, host: "127.0.0.1" });
  await server.start();
  held.sql = postgres(`postgres://postgres@${server.getServerConn()}/postgres`, { prepare: false, ssl: false, max: 1 });
}, 30000);

afterAll(async () => {
  await held.sql?.end();
  await server?.stop();
  await pglite?.close();
});

function mockRes() {
  return {
    statusCode: 0, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(c, h) { this.statusCode = c; Object.assign(this.headers, h || {}); return this; },
    write() {}, end(o) { if (o !== undefined) this.body = o; return this; },
    headersSent: false,
  };
}

async function call(handler, { method = "GET", uid, query = {}, body, headers = {}, rawBody } = {}) {
  const h = { ...headers };
  if (uid) h["x-test-uid"] = uid;
  const req = { method, headers: h, query, body };
  if (rawBody != null) req[Symbol.asyncIterator] = async function* () { yield Buffer.from(rawBody); };
  const res = mockRes();
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
}

function signedWebhook(rzpOrderId, eventId, paymentId = "pay_" + eventId) {
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: rzpOrderId } } } });
  const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  return { rawBody: raw, headers: { "x-razorpay-signature": sig, "x-razorpay-event-id": eventId } };
}

describe("commerce e2e (real handlers on Postgres)", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await call(listingsHandler, { method: "GET" })).status).toBe(401);
  });

  it("runs the full seller→buyer→pay→ship→deliver→review lifecycle", async () => {
    const create = await call(listingsHandler, { method: "POST", uid: "seller-1",
      body: { title: "Fresh Paddy", category: "crop", unit: "quintal", price: 2300, qty_available: 3, status: "active" } });
    expect(create.status).toBe(201);
    const listingId = create.body.listing.id;

    const browse = await call(listingsHandler, { method: "GET", uid: "buyer-1", query: { q: "paddy" } });
    expect(browse.status).toBe(200);
    expect(browse.body.items.some((l) => l.id === listingId)).toBe(true);

    const order = await call(ordersHandler, { method: "POST", uid: "buyer-1",
      body: { items: [{ listingId, quantity: 2 }], deliveryAddr: { district: "Jhargram" } } });
    expect(order.status).toBe(201);
    expect(order.body.order.total).toBe(4600);
    const orderId = order.body.order.id;
    const rzpOrderId = order.body.payment.razorpayOrderId;

    // stock reserved (3 - 2)
    const afterOrder = await call(listingItemHandler, { method: "GET", uid: "buyer-1", query: { id: listingId } });
    expect(afterOrder.body.listing.qtyAvailable).toBe(1);

    // webhook confirms payment; a redelivery is idempotent
    const wh = await call(webhookHandler, { method: "POST", ...signedWebhook(rzpOrderId, "evt_1") });
    expect(wh.status).toBe(200);
    const dup = await call(webhookHandler, { method: "POST", ...signedWebhook(rzpOrderId, "evt_1") });
    expect(dup.body.duplicate).toBe(true);

    const paid = await call(orderItemHandler, { method: "GET", uid: "buyer-1", query: { id: orderId } });
    expect(paid.body.order.status).toBe("confirmed");

    // an unsigned webhook is rejected
    const bad = await call(webhookHandler, { method: "POST", rawBody: "{}", headers: { "x-razorpay-signature": "nope" } });
    expect(bad.status).toBe(401);

    // seller ships then delivers
    expect((await call(orderItemHandler, { method: "PATCH", uid: "seller-1", query: { id: orderId }, body: { action: "ship" } })).body.order.status).toBe("shipped");
    expect((await call(orderItemHandler, { method: "PATCH", uid: "seller-1", query: { id: orderId }, body: { action: "deliver" } })).body.order.status).toBe("delivered");

    // buyer reviews the delivered order
    const review = await call(reviewsHandler, { method: "POST", uid: "buyer-1",
      body: { orderId, subjectType: "listing", subjectId: listingId, rating: 5, comment: "Great" } });
    expect(review.status).toBe(201);
    const revs = await call(reviewsHandler, { method: "GET", uid: "buyer-1", query: { subjectType: "listing", subjectId: listingId } });
    expect(revs.body).toMatchObject({ count: 1, average: 5 });
  });

  it("prevents overselling the last unit (409)", async () => {
    const create = await call(listingsHandler, { method: "POST", uid: "seller-2",
      body: { title: "Last Unit Seed", category: "seed", unit: "kg", price: 100, qty_available: 1, status: "active" } });
    const listingId = create.body.listing.id;
    const first  = await call(ordersHandler, { method: "POST", uid: "buyer-2", body: { items: [{ listingId, quantity: 1 }] } });
    const second = await call(ordersHandler, { method: "POST", uid: "buyer-3", body: { items: [{ listingId, quantity: 1 }] } });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("refunds a confirmed order: order refunded + stock restored", async () => {
    const create = await call(listingsHandler, { method: "POST", uid: "seller-3",
      body: { title: "Refundable", category: "feed", unit: "kg", price: 500, qty_available: 5, status: "active" } });
    const listingId = create.body.listing.id;
    const order = await call(ordersHandler, { method: "POST", uid: "buyer-4", body: { items: [{ listingId, quantity: 2 }] } });
    const orderId = order.body.order.id;
    await call(webhookHandler, { method: "POST", ...signedWebhook(order.body.payment.razorpayOrderId, "evt_r") });

    const refund = await call(orderItemHandler, { method: "PATCH", uid: "seller-3", query: { id: orderId }, body: { action: "refund" } });
    expect(refund.status).toBe(200);
    expect(refund.body.order.status).toBe("refunded");

    const detail = await call(listingItemHandler, { method: "GET", uid: "seller-3", query: { id: listingId } });
    expect(detail.body.listing.qtyAvailable).toBe(5); // 5 - 2 + 2
  });

  it("forbids a non-participant from viewing an order", async () => {
    const create = await call(listingsHandler, { method: "POST", uid: "seller-4",
      body: { title: "Private", category: "crop", unit: "kg", price: 100, qty_available: 2, status: "active" } });
    const order = await call(ordersHandler, { method: "POST", uid: "buyer-5", body: { items: [{ listingId: create.body.listing.id, quantity: 1 }] } });
    const stranger = await call(orderItemHandler, { method: "GET", uid: "buyer-6", query: { id: order.body.order.id } });
    expect(stranger.status).toBe(403);
  });
});

describe("commerce/me (real handler on Postgres)", () => {
  it("rejects unauthenticated requests, both GET and PATCH", async () => {
    expect((await call(meHandler, { method: "GET" })).status).toBe(401);
    expect((await call(meHandler, { method: "PATCH", body: { name: "X" } })).status).toBe(401);
  });

  it("GET creates/loads the caller's own row — the B0 acceptance criterion", async () => {
    const first = await call(meHandler, { method: "GET", uid: "me-user-1" });
    expect(first.status).toBe(200);
    expect(first.body.user.firebase_uid).toBe("me-user-1");

    /* Same uid again must be the SAME row, not a second one. */
    const second = await call(meHandler, { method: "GET", uid: "me-user-1" });
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it("PATCH sets the caller's own name — the fix for FarmDetails.jsx's old device-local-only save", async () => {
    await call(meHandler, { method: "GET", uid: "me-user-2" }); // creates the row
    const patch = await call(meHandler, { method: "PATCH", uid: "me-user-2", body: { name: "Priya Das" } });
    expect(patch.status).toBe(200);
    expect(patch.body.user.name).toBe("Priya Das");

    /* Persisted, not just echoed back. */
    const reread = await call(meHandler, { method: "GET", uid: "me-user-2" });
    expect(reread.body.user.name).toBe("Priya Das");
  });

  it("can only ever update the CALLER's own row, never one named by the client", async () => {
    /* There is no id in the PATCH payload at all — current.id comes from
       the verified token, never from anything the client sends — but this
       proves the outcome: a second user's PATCH cannot touch the first. */
    await call(meHandler, { method: "GET", uid: "me-user-3" });
    await call(meHandler, { method: "GET", uid: "me-user-4" });
    await call(meHandler, { method: "PATCH", uid: "me-user-4", body: { name: "Only Me" } });

    const other = await call(meHandler, { method: "GET", uid: "me-user-3" });
    expect(other.body.user.name).not.toBe("Only Me");
  });

  it("rejects an empty or missing name", async () => {
    await call(meHandler, { method: "GET", uid: "me-user-5" });
    expect((await call(meHandler, { method: "PATCH", uid: "me-user-5", body: { name: "   " } })).status).toBe(400);
    expect((await call(meHandler, { method: "PATCH", uid: "me-user-5", body: {} })).status).toBe(400);
  });

  it("rejects a name over the length limit", async () => {
    await call(meHandler, { method: "GET", uid: "me-user-6" });
    const tooLong = await call(meHandler, { method: "PATCH", uid: "me-user-6", body: { name: "x".repeat(81) } });
    expect(tooLong.status).toBe(400);
  });
});
