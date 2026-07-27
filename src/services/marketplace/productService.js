/* Product listings. Product:
   { sellerId, name, brand, category, unit, price, discountPrice, bulkPrices:[{minQty, price}],
     stock, reserved, lowStockAt, description, specs:{k:v}, certifications:[],
     status: draft|published|archived, featured, demo } */

import { repo } from "./marketDb.js";
import { categoryMeta } from "./constantsMp.js";

const products = repo("products");

const num = (v) => Number(v) || 0;

export const productService = {
  add: (data) => products.add({
    ...data,
    price: num(data.price),
    discountPrice: data.discountPrice ? num(data.discountPrice) : null,
    stock: num(data.stock),
    reserved: 0,
    lowStockAt: num(data.lowStockAt),
    status: data.status || "draft",
    featured: !!data.featured,
  }),
  update: (id, patch) => products.update(id, patch),
  remove: (id) => products.remove(id),
  getById: (id) => products.getById(id),
  getAll: () => products.getAll(),
  bySeller: (sellerId) => products.getBy("sellerId", sellerId),
  published: () => products.getBy("status", "published"),

  setStatus: (id, status) => products.update(id, { status }),

  available: (p) => Math.max(0, num(p?.stock) - num(p?.reserved)),

  /* Effective unit price for a quantity: bulk tier > discount > base. */
  unitPrice(p, qty = 1) {
    const tiers = (p.bulkPrices || [])
      .filter((b) => num(qty) >= num(b.minQty))
      .sort((a, b) => num(b.minQty) - num(a.minQty));
    if (tiers.length) return num(tiers[0].price);
    return p.discountPrice ? num(p.discountPrice) : num(p.price);
  },

  /* Stock effects driven by the order lifecycle. */
  reserve: async (id, qty) => {
    const p = await products.getById(id);
    if (!p) return null;
    return products.update(id, { reserved: num(p.reserved) + num(qty) });
  },
  release: async (id, qty) => {
    const p = await products.getById(id);
    if (!p) return null;
    return products.update(id, { reserved: Math.max(0, num(p.reserved) - num(qty)) });
  },
  fulfill: async (id, qty) => {
    const p = await products.getById(id);
    if (!p) return null;
    return products.update(id, {
      stock: Math.max(0, num(p.stock) - num(qty)),
      reserved: Math.max(0, num(p.reserved) - num(qty)),
    });
  },
  restock: async (id, qty) => {
    const p = await products.getById(id);
    if (!p) return null;
    return products.update(id, { stock: num(p.stock) + num(qty) });
  },

  /* Client-side search over published listings. */
  async search({ q = "", category = "all", sellerId = null, sort = "new" } = {}) {
    let list = await this.published();
    if (sellerId) list = list.filter((p) => p.sellerId === sellerId);
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((p) =>
        `${p.name} ${p.brand || ""} ${p.description || ""}`.toLowerCase().includes(s));
    }
    const sorters = {
      new:       (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
      priceAsc:  (a, b) => this.unitPrice(a) - this.unitPrice(b),
      priceDesc: (a, b) => this.unitPrice(b) - this.unitPrice(a),
    };
    return list.sort(sorters[sort] || sorters.new);
  },

  async lowStock(sellerId) {
    const list = await this.bySeller(sellerId);
    return list.filter((p) => p.status !== "archived" && p.lowStockAt > 0 &&
      this.available(p) <= num(p.lowStockAt));
  },

  categoryIcon:  (id) => categoryMeta(id).icon,
  categoryLabel: (id) => categoryMeta(id).label,
};
