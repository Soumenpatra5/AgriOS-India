/* Product listings. Product:
   { sellerId, name, brand, category, unit, price, discountPrice, bulkPrices:[{minQty, price}],
     stock, reserved, lowStockAt, description, specs:{k:v}, certifications:[],
     status: draft|published|archived, featured, demo } */

import { repo } from "./marketDb.js";
import { categoryMeta } from "./constantsMp.js";
import { commerceEnabled } from "../commerce/config.js";
import { commerceApi } from "../commerce/commerceApi.js";
import { listingToProduct, productToListingPayload, productPatchToListingPayload } from "../commerce/mappers.js";

const products = repo("products");

const num = (v) => Number(v) || 0;

export const productService = {
  async add(data) {
    if (commerceEnabled()) {
      const { listing } = await commerceApi.createListing(productToListingPayload(data));
      return listingToProduct(listing);
    }
    return products.add({
      ...data,
      price: num(data.price),
      discountPrice: data.discountPrice ? num(data.discountPrice) : null,
      stock: num(data.stock),
      reserved: 0,
      lowStockAt: num(data.lowStockAt),
      status: data.status || "draft",
      featured: !!data.featured,
    });
  },
  async update(id, patch) {
    if (commerceEnabled()) {
      const { listing } = await commerceApi.updateListing(id, productPatchToListingPayload(patch));
      return listingToProduct(listing);
    }
    return products.update(id, patch);
  },
  async remove(id) {
    if (commerceEnabled()) { await commerceApi.deleteListing(id); return; }
    return products.remove(id);
  },
  async getById(id) {
    if (commerceEnabled()) {
      try { const { listing } = await commerceApi.listing(id); return listingToProduct(listing); }
      catch (e) { if (e.status === 404) return null; throw e; }
    }
    return products.getById(id);
  },
  getAll: () => products.getAll(),
  async bySeller(sellerId) {
    // The server scopes "my listings" to the authenticated seller (all statuses).
    if (commerceEnabled()) {
      const { items } = await commerceApi.listings({ mine: 1 });
      return items.map(listingToProduct);
    }
    return products.getBy("sellerId", sellerId);
  },
  published() {
    // Server exposes only active listings via search; local keeps the store.
    if (commerceEnabled()) return this.search({});
    return products.getBy("status", "published");
  },

  async setStatus(id, status) {
    if (commerceEnabled()) {
      const { listing } = await commerceApi.updateListing(id, productPatchToListingPayload({ status }));
      return listingToProduct(listing);
    }
    return products.update(id, { status });
  },

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

  /* Search over published/active listings. Server-backed when enabled (server
     applies q + category and returns active, newest-first); otherwise local. */
  async search({ q = "", category = "all", sellerId = null, sort = "new" } = {}) {
    if (commerceEnabled()) {
      const { items } = await commerceApi.listings({ q, category: category !== "all" ? category : undefined });
      let mapped = items.map(listingToProduct);
      if (sellerId) mapped = mapped.filter((p) => p.sellerId === sellerId);
      if (sort === "priceAsc") mapped.sort((a, b) => this.unitPrice(a) - this.unitPrice(b));
      else if (sort === "priceDesc") mapped.sort((a, b) => this.unitPrice(b) - this.unitPrice(a));
      return mapped;
    }
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
