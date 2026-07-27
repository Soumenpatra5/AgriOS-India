/* Farm assets — machinery, vehicles, buildings, pumps — with maintenance log. */

import { repo } from "../erp/erpDb.js";

export const ASSET_CATEGORIES = [
  { id: "machinery", label: "Machinery",    icon: "Tractor"   },
  { id: "vehicle",   label: "Vehicle",      icon: "Truck"     },
  { id: "building",  label: "Building",     icon: "Factory"   },
  { id: "pump",      label: "Water Pump",   icon: "Droplets"  },
  { id: "generator", label: "Generator",    icon: "Zap"       },
  { id: "solar",     label: "Solar System", icon: "Sun"       },
  { id: "tool",      label: "Tools",        icon: "Wrench"    },
  { id: "other",     label: "Other",        icon: "Package2"  },
];

const assets = repo("assets");
const maint  = repo("maintenance");

export const assetService = {
  add:     (data) => assets.add(data),
  getAll:  (farmId) => (farmId ? assets.getBy("farmId", farmId) : assets.getAll()),
  getById: (id) => assets.getById(id),
  update:  (id, patch) => assets.update(id, patch),
  remove:  (id) => assets.remove(id),

  logMaintenance: (assetId, { date, kind, cost, note, nextDue }) =>
    maint.add({ assetId, date, kind, cost: Number(cost) || 0, note, nextDue }),

  getMaintenance: (assetId) => maint.getBy("assetId", assetId)
    .then((list) => list.sort((a, b) => b.date.localeCompare(a.date))),

  /* Assets whose next maintenance is due within `days`. */
  async dueSoon(farmId, days = 30) {
    const list = await this.getAll(farmId);
    const all = await Promise.all(list.map(async (a) => {
      const logs = await this.getMaintenance(a.id);
      const next = logs.find((l) => l.nextDue)?.nextDue;
      return next ? { asset: a, nextDue: next } : null;
    }));
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(); soon.setDate(soon.getDate() + days);
    const soonStr = soon.toISOString().slice(0, 10);
    return all.filter((x) => x && x.nextDue >= today && x.nextDue <= soonStr);
  },

  /* Total asset value (purchase prices). */
  async totalValue(farmId) {
    const list = await this.getAll(farmId);
    return list.reduce((s, a) => s + (Number(a.purchasePrice) || 0), 0);
  },

  categoryLabel: (id) => ASSET_CATEGORIES.find((c) => c.id === id)?.label ?? id,
  categoryIcon:  (id) => ASSET_CATEGORIES.find((c) => c.id === id)?.icon ?? "Package2",
};
