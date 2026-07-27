/* Shopping cart. Line: { productId, qty, saved } (saved = saved-for-later).
   getLines() joins live product data and validates each line against current
   stock and publish status so the UI always shows honest availability. */

import { repo } from "./marketDb.js";
import { productService } from "./productService.js";

const cart = repo("cart");
const num = (v) => Number(v) || 0;

export const cartService = {
  async addToCart(productId, qty = 1) {
    const existing = (await cart.getBy("productId", productId))[0];
    if (existing) return cart.update(existing.id, { qty: num(existing.qty) + num(qty), saved: false });
    return cart.add({ productId, qty: num(qty), saved: false });
  },

  updateQty: (lineId, qty) => num(qty) > 0 ? cart.update(lineId, { qty: num(qty) }) : cart.remove(lineId),
  removeLine: (lineId) => cart.remove(lineId),
  toggleSaved: async (lineId) => {
    const line = await cart.getById(lineId);
    return line ? cart.update(lineId, { saved: !line.saved }) : null;
  },
  async clearActive() {
    const lines = await cart.getAll();
    await Promise.all(lines.filter((l) => !l.saved).map((l) => cart.remove(l.id)));
  },

  /* Joined + validated lines. problem: null | "removed" | "unavailable" | "stock" */
  async getLines() {
    const lines = await cart.getAll();
    return Promise.all(lines.map(async (l) => {
      const product = await productService.getById(l.productId);
      let problem = null;
      if (!product) problem = "removed";
      else if (product.status !== "published") problem = "unavailable";
      else if (productService.available(product) < num(l.qty)) problem = "stock";
      const unitPrice = product ? productService.unitPrice(product, l.qty) : 0;
      return { ...l, product, problem, unitPrice, lineTotal: unitPrice * num(l.qty) };
    }));
  },

  /* Totals over valid, active (not saved-for-later) lines. */
  totals(lines) {
    const active = lines.filter((l) => !l.saved && !l.problem);
    const subtotal = active.reduce((s, l) => s + l.lineTotal, 0);
    return { count: active.reduce((s, l) => s + num(l.qty), 0), subtotal, total: subtotal };
  },

  async count() {
    const lines = await cart.getAll();
    return lines.filter((l) => !l.saved).length;
  },
};
