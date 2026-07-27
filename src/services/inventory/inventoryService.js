/* Inventory — items with stock in/out movements, low-stock + expiry alerts.
   Item: {name, category, unit, qty, minQty, expiryDate, supplierName, barcode} */

import { repo } from "../erp/erpDb.js";

export const ITEM_CATEGORIES = [
  { id: "feed",       label: "Feed",         icon: "Package"     },
  { id: "medicine",   label: "Medicine",     icon: "Pill"        },
  { id: "seeds",      label: "Seeds",        icon: "Sprout"      },
  { id: "fertilizer", label: "Fertilizer",   icon: "Leaf"        },
  { id: "pesticide",  label: "Pesticide",    icon: "SprayCan"    },
  { id: "fuel",       label: "Fuel",         icon: "Zap"         },
  { id: "equipment",  label: "Equipment",    icon: "Wrench"      },
  { id: "packaging",  label: "Packaging",    icon: "Boxes"       },
  { id: "other",      label: "Other",        icon: "Package2"    },
];

const items = repo("inventory");
const moves = repo("stockMoves");

export const inventoryService = {
  addItem: (data) => items.add({ ...data, qty: Number(data.qty) || 0 }),
  getAll: (farmId) => (farmId ? items.getBy("farmId", farmId) : items.getAll()),
  getById: (id) => items.getById(id),
  updateItem: (id, patch) => items.update(id, patch),
  removeItem: (id) => items.remove(id),

  /* Stock movement: kind "in" | "out". Updates item qty atomically enough
     for a single-user offline app. */
  async move(itemId, kind, qty, note = "") {
    const item = await items.getById(itemId);
    if (!item) return null;
    const delta = kind === "in" ? Number(qty) : -Number(qty);
    const newQty = Math.max(0, (Number(item.qty) || 0) + delta);
    await items.update(itemId, { qty: newQty });
    return moves.add({ itemId, kind, qty: Number(qty), note, date: new Date().toISOString().slice(0, 10) });
  },

  getMoves: (itemId) => moves.getBy("itemId", itemId)
    .then((list) => list.sort((a, b) => b.date.localeCompare(a.date))),

  async alerts(farmId) {
    const list = await this.getAll(farmId);
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const soonStr = soon.toISOString().slice(0, 10);
    return {
      lowStock: list.filter((i) => i.minQty && Number(i.qty) <= Number(i.minQty)),
      expired:  list.filter((i) => i.expiryDate && i.expiryDate < today),
      expiring: list.filter((i) => i.expiryDate && i.expiryDate >= today && i.expiryDate <= soonStr),
    };
  },

  /* Approximate stock value: qty * unitPrice where price known. */
  async stockValue(farmId) {
    const list = await this.getAll(farmId);
    return list.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  },

  categoryLabel: (id) => ITEM_CATEGORIES.find((c) => c.id === id)?.label ?? id,
  categoryIcon:  (id) => ITEM_CATEGORIES.find((c) => c.id === id)?.icon ?? "Package",
};
