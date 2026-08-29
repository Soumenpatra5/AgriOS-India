/* Land parcels — soil, water, ownership/lease, current crop, rotation history. */

import { repo } from "../erp/erpDb.js";

export const SOIL_TYPES  = ["Alluvial","Black (Regur)","Red","Laterite","Sandy","Clay","Loamy","Saline"];
export const WATER_SOURCES = ["Borewell","Canal","Pond","River","Rain-fed","Drip","Sprinkler"];
export const OWNERSHIP   = [
  { id: "owned",  label: "Owned", i18n: { en: "Owned", hi: "स्वामित्व", bn: "নিজস্ব" }  },
  { id: "leased", label: "Leased", i18n: { en: "Leased", hi: "पट्टे पर", bn: "ইজারা" } },
  { id: "shared", label: "Share-cropped", i18n: { en: "Share-cropped", hi: "बटाई पर", bn: "ভাগচাষ" } },
];

const parcels = repo("parcels");

export const landService = {
  add:     (data) => parcels.add({ rotation: [], ...data }),
  getAll:  (farmId) => (farmId ? parcels.getBy("farmId", farmId) : parcels.getAll()),
  getById: (id) => parcels.getById(id),
  update:  (id, patch) => parcels.update(id, patch),
  remove:  (id) => parcels.remove(id),

  /* Append a crop to the parcel's rotation history and set it current. */
  async setCrop(id, cropName) {
    const p = await parcels.getById(id);
    if (!p) return null;
    const rotation = [...(p.rotation || []), { crop: cropName, from: new Date().toISOString().slice(0, 10) }];
    return parcels.update(id, { currentCrop: cropName, rotation });
  },

  /* Total and cultivated area for a farm (acres). */
  async utilization(farmId) {
    const list = await this.getAll(farmId);
    const total = list.reduce((s, p) => s + (Number(p.areaAcres) || 0), 0);
    const used  = list.filter((p) => p.currentCrop)
                      .reduce((s, p) => s + (Number(p.areaAcres) || 0), 0);
    return { parcels: list.length, totalAcres: total, usedAcres: used,
             pct: total > 0 ? Math.round((used / total) * 100) : 0 };
  },
};
