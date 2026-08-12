/* Marketplace orders. One order per seller per checkout (marketplace model).
   Order: { sellerId, sellerName, items:[{productId, name, qty, unit, unitPrice, lineTotal}],
     subtotal, total, status, paymentMethod, paid, address, timeline:[{status, at}], demo }

   Stock effects (kept in productService):
   - create     -> reserve qty          (available shrinks, stock untouched)
   - delivered  -> fulfill qty          (stock down, reservation released)
   - cancelled  -> release qty          (reservation returned)
   - returned   -> restock qty          (after delivery, stock comes back)   */

import { repo } from "./marketDb.js";
import { productService } from "./productService.js";
import { ORDER_FLOW } from "./constantsMp.js";
import { storage } from "../../utils/storage.js";
import { commerceEnabled } from "../commerce/config.js";
import { commerceApi } from "../commerce/commerceApi.js";
import { serverOrderToClient, clientStatusToAction } from "../commerce/mappers.js";

const orders = repo("orders");
const num = (v) => Number(v) || 0;

const ADDRESS_KEY = "mp:address";

export const mpOrderService = {
  /* Checkout: valid cart lines -> one order per seller. */
  async createFromCart(lines, { paymentMethod = "cod", address = null } = {}) {
    const valid = lines.filter((l) => !l.saved && !l.problem && l.product);
    if (!valid.length) return [];

    const bySeller = {};
    valid.forEach((l) => { (bySeller[l.product.sellerId] ||= []).push(l); });

    const created = [];
    for (const [sellerId, group] of Object.entries(bySeller)) {
      const items = group.map((l) => ({
        productId: l.product.id, name: l.product.name, qty: num(l.qty),
        unit: l.product.unit, unitPrice: l.unitPrice, lineTotal: l.lineTotal,
      }));
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const order = await orders.add({
        sellerId, sellerName: group[0].product.sellerName || "",
        items, subtotal, total: subtotal,
        status: "pending", paymentMethod, paid: false, address,
        timeline: [{ status: "pending", at: new Date().toISOString() }],
      });
      for (const i of items) await productService.reserve(i.productId, i.qty);
      created.push(order);
    }
    return created;
  },

  async getAll() {
    if (commerceEnabled()) {
      const { orders: rows } = await commerceApi.orders("buyer");
      return rows.map(serverOrderToClient);
    }
    return orders.getAll().then((l) => l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
  },
  async getById(id) {
    if (commerceEnabled()) {
      try { const { order } = await commerceApi.order(id); return serverOrderToClient(order); }
      catch (e) { if (e.status === 404) return null; throw e; }
    }
    return orders.getById(id);
  },
  async bySeller(sellerId) {
    if (commerceEnabled()) {
      const { orders: rows } = await commerceApi.orders("seller");
      return rows.map(serverOrderToClient);
    }
    return orders.getBy("sellerId", sellerId).then((l) => l.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
  },

  async setStatus(id, status) {
    if (commerceEnabled()) {
      const action = clientStatusToAction(status);
      if (!action) return this.getById(id);   // no server transition for this status
      const { order } = await commerceApi.orderAction(id, action);
      return serverOrderToClient(order);
    }
    const order = await orders.getById(id);
    if (!order || order.status === status) return order;

    for (const i of order.items) {
      if (status === "delivered") await productService.fulfill(i.productId, i.qty);
      if (status === "cancelled") await productService.release(i.productId, i.qty);
      if (status === "returned")  await productService.restock(i.productId, i.qty);
    }
    return orders.update(id, {
      status,
      paid: status === "delivered" ? true : order.paid,
      timeline: [...(order.timeline || []), { status, at: new Date().toISOString() }],
    });
  },

  nextStatus: (status) => {
    const i = ORDER_FLOW.indexOf(status);
    return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
  },
  canCancel: (o) => ["pending", "processing", "packed"].includes(o.status),
  canReturn: (o) => o.status === "delivered",

  async sellerSummary(sellerId) {
    const list = await this.bySeller(sellerId);
    const delivered = list.filter((o) => o.status === "delivered");
    const active = list.filter((o) => ["pending", "processing", "packed", "shipped"].includes(o.status));
    return {
      orders: list.length,
      active: active.length,
      revenue: delivered.reduce((s, o) => s + num(o.total), 0),
    };
  },

  /* Buyer delivery address — device-local profile. */
  getAddress: () => storage.get(ADDRESS_KEY, null),
  saveAddress: (a) => storage.set(ADDRESS_KEY, a),
};
