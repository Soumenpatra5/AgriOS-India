/* Reviews — product & seller ratings. Review:
   { productId, sellerId, rating (1-5), text, author, verified, demo } */

import { repo } from "./marketDb.js";
import { mpOrderService } from "./mpOrderService.js";
import { commerceEnabled } from "../commerce/config.js";
import { commerceApi } from "../commerce/commerceApi.js";
import { serverReviewToClient } from "../commerce/mappers.js";

const reviews = repo("reviews");

const stats = (list) => {
  if (!list.length) return { avg: 0, count: 0 };
  return {
    avg: Math.round((list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length) * 10) / 10,
    count: list.length,
  };
};

export const reviewService = {
  async add({ productId, sellerId, rating, text = "", author = "You" }) {
    // Server reviews are order-scoped: find the buyer's delivered order that
    // contains this product and use it as the review's orderId. Rate the listing,
    // then rate the seller once per order (a duplicate seller review 409s — ok).
    if (commerceEnabled()) {
      const all = await mpOrderService.getAll();
      const order = all.find((o) => o.status === "delivered" && o.items.some((i) => i.productId === productId));
      if (!order) throw new Error("Review unlocks after a delivered order");
      await commerceApi.createReview({ orderId: order.id, subjectType: "listing", subjectId: productId, rating: Number(rating), comment: text });
      if (sellerId) {
        try { await commerceApi.createReview({ orderId: order.id, subjectType: "seller", subjectId: sellerId, rating: Number(rating), comment: text }); }
        catch (e) { if (e.status !== 409) throw e; }
      }
      return { productId, sellerId, rating: Number(rating), text, author, verified: true };
    }
    // Verified = the buyer has a delivered order containing this product.
    const all = await mpOrderService.getAll();
    const verified = all.some((o) => o.status === "delivered" &&
      o.items.some((i) => i.productId === productId));
    return reviews.add({ productId, sellerId, rating: Number(rating), text, author, verified });
  },

  forProduct(productId) {
    if (commerceEnabled()) return commerceApi.reviews("listing", productId).then((r) => (r.reviews || []).map(serverReviewToClient));
    return reviews.getBy("productId", productId).then((l) => l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
  },
  forSeller(sellerId) {
    if (commerceEnabled()) return commerceApi.reviews("seller", sellerId).then((r) => (r.reviews || []).map(serverReviewToClient));
    return reviews.getBy("sellerId", sellerId);
  },

  async productStats(productId) {
    if (commerceEnabled()) { const r = await commerceApi.reviews("listing", productId); return { avg: r.average || 0, count: r.count || 0 }; }
    return reviews.getBy("productId", productId).then(stats);
  },
  async sellerStats(sellerId) {
    if (commerceEnabled()) { const r = await commerceApi.reviews("seller", sellerId); return { avg: r.average || 0, count: r.count || 0 }; }
    return reviews.getBy("sellerId", sellerId).then(stats);
  },
};
