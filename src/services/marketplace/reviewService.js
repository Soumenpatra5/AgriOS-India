/* Reviews — product & seller ratings. Review:
   { productId, sellerId, rating (1-5), text, author, verified, demo } */

import { repo } from "./marketDb.js";
import { mpOrderService } from "./mpOrderService.js";

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
    // Verified = the buyer has a delivered order containing this product.
    const all = await mpOrderService.getAll();
    const verified = all.some((o) => o.status === "delivered" &&
      o.items.some((i) => i.productId === productId));
    return reviews.add({ productId, sellerId, rating: Number(rating), text, author, verified });
  },

  forProduct: (productId) => reviews.getBy("productId", productId).then((l) =>
    l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))),
  forSeller: (sellerId) => reviews.getBy("sellerId", sellerId),

  productStats: (productId) => reviews.getBy("productId", productId).then(stats),
  sellerStats:  (sellerId)  => reviews.getBy("sellerId", sellerId).then(stats),
};
