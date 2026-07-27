/* Sellers — store profiles. The device owner's own store id is kept in
   localStorage (single-user device, like erp:activeFarmId). Seller:
   { name, type, tagline, description, village, district, state, phone,
     icon, accent, gstin, verificationStatus, kycStatus, demo } */

import { repo } from "./marketDb.js";
import { storage } from "../../utils/storage.js";
import { SELLER_TYPES } from "./constantsMp.js";

const sellers = repo("sellers");
const MY_KEY = "mp:mySellerId";

export const sellerService = {
  getAll: () => sellers.getAll(),
  getById: (id) => sellers.getById(id),
  update: (id, patch) => sellers.update(id, patch),

  /* One-time "become a seller" for the device owner. Real KYC/GST checks
     arrive with the backend phase — until then everything starts pending. */
  async register(profile) {
    const rec = await sellers.add({
      icon: "Store", accent: "primary",
      ...profile,
      verificationStatus: "pending",
      kycStatus: profile.gstin ? "submitted" : "not_submitted",
    });
    storage.set(MY_KEY, rec.id);
    return rec;
  },

  async getMine() {
    const id = storage.get(MY_KEY, null);
    return id ? sellers.getById(id) : null;
  },
  myId: () => storage.get(MY_KEY, null),

  typeLabel: (id) => SELLER_TYPES.find((t) => t.id === id)?.label ?? id,
};
