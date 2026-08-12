/* Pure helpers for the order endpoints — no DB, no I/O, unit-testable. The
   client sends only listing ids + quantities; prices and stock are resolved
   server-side (never trusted from the client). Money is integer paise; the API
   surface also exposes rupees. */

export const ORDER_STATUSES = [
  "pending_payment", "paid", "confirmed", "shipped", "delivered", "cancelled", "refunded",
];
const MAX_LINES = 50;

/* Validate the create-order body: items [{listingId, quantity>0}] and an
   optional delivery address. Duplicate listingIds are merged (summed). Returns
   { value:{items, deliveryAddr} } or { error }. */
export function validateOrderInput(body) {
  const b = body || {};
  if (!Array.isArray(b.items) || b.items.length === 0) return { error: "items is required" };
  if (b.items.length > MAX_LINES) return { error: "too many items" };

  const merged = new Map();
  for (const it of b.items) {
    const listingId = it?.listingId;
    const quantity = Number(it?.quantity);
    if (!listingId || typeof listingId !== "string") return { error: "each item needs a listingId" };
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: "each item needs a positive quantity" };
    merged.set(listingId, (merged.get(listingId) || 0) + quantity);
  }

  const deliveryAddr = b.deliveryAddr && typeof b.deliveryAddr === "object" ? b.deliveryAddr : null;
  return {
    value: {
      items: [...merged].map(([listingId, quantity]) => ({ listingId, quantity })),
      deliveryAddr,
    },
  };
}

/* Given priced lines [{listing, quantity}] (listing has price_paise, id, title),
   compute the order_items rows and paise totals. */
export function computeOrderTotals(lines, shippingPaise = 0) {
  let subtotal = 0;
  const items = lines.map(({ listing, quantity }) => {
    const unit = Number(listing.price_paise);
    const lineTotal = unit * quantity;
    subtotal += lineTotal;
    return {
      listing_id: listing.id,
      title_snapshot: listing.title,
      unit_price_paise: unit,
      quantity,
      line_total_paise: lineTotal,
    };
  });
  const shipping = Number(shippingPaise) || 0;
  return { items, subtotal_paise: subtotal, shipping_paise: shipping, total_paise: subtotal + shipping };
}

const toRupees = (p) => (Number(p) || 0) / 100;

/* DB order row (+ optional item rows) -> API shape. */
export function publicOrder(order, itemRows = []) {
  return {
    id: order.id,
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    status: order.status,
    subtotal: toRupees(order.subtotal_paise),
    shipping: toRupees(order.shipping_paise),
    total: toRupees(order.total_paise),
    totalPaise: Number(order.total_paise),
    currency: order.currency || "INR",
    deliveryAddr: order.delivery_addr ?? null,
    items: itemRows.map((i) => ({
      listingId: i.listing_id,
      title: i.title_snapshot,
      unitPrice: toRupees(i.unit_price_paise),
      quantity: Number(i.quantity),
      lineTotal: toRupees(i.line_total_paise),
    })),
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}
