/* Bidirectional mapping between the server commerce model and the client
   marketplace model, so the existing pages/services keep their shapes while the
   data source swaps to /api/commerce/*.

   Model differences worth noting: server "listing.title" ↔ client "product.name";
   server has qtyAvailable (no separate reserved — reservation is server-side at
   order time); the server has no bulk/discount pricing yet (those stay empty).
   Money is already rupees on both sides of the API. */

const num = (v) => Number(v) || 0;

const LISTING_TO_PRODUCT_STATUS = {
  active: "published", sold_out: "published",
  draft: "draft", paused: "draft", archived: "archived",
};
const PRODUCT_TO_LISTING_STATUS = { published: "active", draft: "draft", archived: "archived" };

const ORDER_STATUS_SERVER_TO_CLIENT = {
  pending_payment: "pending", paid: "processing", confirmed: "processing",
  shipped: "shipped", delivered: "delivered", cancelled: "cancelled", refunded: "returned",
};

/* API listing -> client product shape (fields the pages read). */
export function listingToProduct(l) {
  return {
    id: l.id,
    sellerId: l.sellerId,
    sellerName: l.sellerName || "",
    name: l.title,
    brand: "",
    category: l.category,
    unit: l.unit,
    price: num(l.price),
    discountPrice: null,
    bulkPrices: [],
    stock: num(l.qtyAvailable),
    reserved: 0,
    lowStockAt: 0,
    description: l.description || "",
    specs: {},
    certifications: [],
    status: LISTING_TO_PRODUCT_STATUS[l.status] || "draft",
    featured: false,
    media: l.media || [],
    createdAt: l.createdAt,
  };
}

/* Client product form -> API create/update payload (server field names). */
export function productToListingPayload(p) {
  return {
    title: p.name,
    description: p.description || "",
    category: p.category,
    unit: p.unit,
    price: num(p.price),
    qty_available: num(p.stock),
    min_order: num(p.minOrder) || 1,
    ...(p.state ? { state: p.state } : {}),
    ...(p.district ? { district: p.district } : {}),
    status: PRODUCT_TO_LISTING_STATUS[p.status] || "draft",
    media: Array.isArray(p.media) ? p.media : [],
  };
}

/* Partial product patch -> API update payload (only the supplied, server-known
   fields; bulk/discount/lowStock etc. have no server counterpart yet). */
export function productPatchToListingPayload(patch) {
  const p = patch || {};
  const out = {};
  if (p.name !== undefined) out.title = p.name;
  if (p.description !== undefined) out.description = p.description || "";
  if (p.category !== undefined) out.category = p.category;
  if (p.unit !== undefined) out.unit = p.unit;
  if (p.price !== undefined) out.price = num(p.price);
  if (p.stock !== undefined) out.qty_available = num(p.stock);
  if (p.minOrder !== undefined) out.min_order = num(p.minOrder) || 1;
  if (p.state !== undefined) out.state = p.state;
  if (p.district !== undefined) out.district = p.district;
  if (p.status !== undefined) out.status = PRODUCT_TO_LISTING_STATUS[p.status] || p.status;
  if (p.media !== undefined) out.media = Array.isArray(p.media) ? p.media : [];
  return out;
}

/* API order -> client order shape. Keeps `serverStatus` for exact transitions. */
export function serverOrderToClient(o) {
  return {
    id: o.id,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    sellerName: "",
    items: (o.items || []).map((i) => ({
      productId: i.listingId,
      name: i.title,
      qty: num(i.quantity),
      unit: "",
      unitPrice: num(i.unitPrice),
      lineTotal: num(i.lineTotal),
    })),
    subtotal: num(o.subtotal),
    total: num(o.total),
    status: ORDER_STATUS_SERVER_TO_CLIENT[o.status] || o.status,
    serverStatus: o.status,
    paymentMethod: "online",
    paid: ["confirmed", "shipped", "delivered"].includes(o.status),
    address: o.deliveryAddr || null,
    timeline: [],
    createdAt: o.createdAt,
  };
}

/* API review -> client review shape (used by ProductDetail / StoreView / Hub).
   Server reviews only exist for delivered-order buyers, so they're all verified. */
export function serverReviewToClient(r) {
  return {
    id: r.id,
    productId: r.subjectType === "listing" ? r.subjectId : undefined,
    sellerId: r.subjectType === "seller" ? r.subjectId : undefined,
    rating: num(r.rating),
    text: r.comment || "",
    author: r.reviewerName || "Buyer",
    verified: true,
    createdAt: r.createdAt,
  };
}

/* Client-side order status -> server transition action (or null if none). */
export function clientStatusToAction(status) {
  if (status === "shipped") return "ship";
  if (status === "delivered") return "deliver";
  if (status === "cancelled") return "cancel";
  return null;
}

/* Validated cart lines -> server order items [{listingId, quantity}]. */
export function cartLinesToOrderItems(lines) {
  return lines
    .filter((l) => l.product && !l.saved && !l.problem)
    .map((l) => ({ listingId: l.product.id, quantity: num(l.qty) }));
}

/* Distinct seller ids across cart lines (server orders are single-seller). */
export function sellersInCart(lines) {
  return [...new Set(lines.filter((l) => l.product && !l.saved && !l.problem).map((l) => l.product.sellerId))];
}
