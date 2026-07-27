/* Wishlist — saved products and favourite sellers.
   Entry: { type: "product"|"seller", refId } */

import { repo } from "./marketDb.js";

const wishlist = repo("wishlist");

export const wishlistService = {
  async toggle(type, refId) {
    const hit = (await wishlist.getBy("refId", refId)).find((w) => w.type === type);
    if (hit) { await wishlist.remove(hit.id); return false; }
    await wishlist.add({ type, refId });
    return true;
  },
  async has(type, refId) {
    return (await wishlist.getBy("refId", refId)).some((w) => w.type === type);
  },
  products: () => wishlist.getBy("type", "product"),
  sellers:  () => wishlist.getBy("type", "seller"),
  remove: (id) => wishlist.remove(id),
};
