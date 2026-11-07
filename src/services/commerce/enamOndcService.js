/* e-NAM & ONDC Commerce Client Service
 * Manages APMC Mandi e-NAM trade lots, simulates auction bidding,
 * and generates ONDC Beckn v1.2.0 export catalogs for farmer collectives. */

import { repo, uid } from "../fpo/fpoDb.js";
import { formatEnamLot, formatBecknCatalog, validateEnamLot } from "../../../api/_lib/enamOndcAdapter.js";

const enamLots = repo("enamLots");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const enamOndcService = {
  async createEnamLot(data) {
    const err = validateEnamLot(data);
    if (err) throw new Error(err);

    const formatted = formatEnamLot({
      ...data,
      lotId: data.lotId || `ENAM-${Date.now().toString(36).slice(-6).toUpperCase()}`,
      status: "listed",
      currentBid: num(data.reservePrice),
    });

    return enamLots.add({
      ...formatted,
      fpoId: data.fpoId || "fpo-default",
      demo: Boolean(data.demo),
    });
  },

  async getEnamLots(fpoId) {
    const all = await enamLots.getAll();
    return all
      .filter((lot) => !fpoId || lot.fpoId === fpoId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  getLot(id) {
    return enamLots.getById(id);
  },

  async submitBid(lotId, { buyerName, bidPrice, bidderType = "trader" }) {
    const lot = await enamLots.getById(lotId);
    if (!lot) throw new Error("e-NAM Lot not found");

    const price = num(bidPrice);
    if (price <= (lot.pricing?.currentHighestBid || 0)) {
      throw new Error("Bid must be strictly higher than current highest bid");
    }

    const newBid = {
      id: uid(),
      buyerName: buyerName || "Verified Mandi Trader",
      bidderType,
      bidPrice: price,
      at: new Date().toISOString(),
    };

    const nextBids = [...(lot.bids || []), newBid];
    const updatedPricing = {
      ...lot.pricing,
      currentHighestBid: price,
      totalCurrentValue: Number(((lot.metrics?.quantity || 0) * price).toFixed(2)),
    };

    return enamLots.update(lotId, {
      bids: nextBids,
      pricing: updatedPricing,
      status: "bidding",
    });
  },

  async awardLot(lotId, { buyerName, finalPrice }) {
    const lot = await enamLots.getById(lotId);
    if (!lot) throw new Error("e-NAM Lot not found");

    const gatePass = `GP-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    return enamLots.update(lotId, {
      status: "awarded",
      awardedTo: buyerName || lot.bids?.[lot.bids.length - 1]?.buyerName || "Winning Bidder",
      gatePassNumber: gatePass,
      awardedPrice: num(finalPrice) || lot.pricing?.currentHighestBid || 0,
    });
  },

  generateBecknCatalog(fpoProfile, lots = []) {
    const items = lots.map((l) => ({
      id: l.id,
      commodity: l.commodity?.name || "Agricultural Produce",
      title: `${l.commodity?.name} (${l.commodity?.variety || "Standard"})`,
      description: `Mandi Lot ${l.enamLotId} - ${l.metrics?.quantity} ${l.metrics?.unit}`,
      quantity: l.metrics?.quantity,
      unit: l.metrics?.unit,
      price: l.pricing?.currentHighestBid || l.pricing?.reservePricePerUnit,
      reservePrice: l.pricing?.reservePricePerUnit,
      assayGrade: l.commodity?.grade,
      moisturePct: l.metrics?.moisturePercentage,
    }));

    return formatBecknCatalog({ provider: fpoProfile, items });
  },

  async seedDemoLots(fpoId) {
    const lots = [
      {
        fpoId,
        lotId: "ENAM-WB-NAD-091",
        mandiCode: "WB_KRN_01",
        mandiName: "Krishnanagar APMC Mandi",
        commodity: "Paddy (Dhan)",
        variety: "Swarna (MTU 7029)",
        quantity: 120,
        unit: "QUINTAL",
        reservePrice: 2320, // 2024-25 MSP benchmark
        moisturePct: 13.2,
        assayGrade: "FAQ Grade 1",
        demo: true,
      },
      {
        fpoId,
        lotId: "ENAM-WB-NAD-092",
        mandiCode: "WB_RNG_02",
        mandiName: "Ranaghat Sub-Market Yard",
        commodity: "Yellow Mustard (Sarson)",
        variety: "B-9 (Binoy)",
        quantity: 45,
        unit: "QUINTAL",
        reservePrice: 5650, // MSP benchmark
        moisturePct: 8.0,
        assayGrade: "Export Quality Cleaned",
        demo: true,
      },
      {
        fpoId,
        lotId: "ONDC-DAIRY-NAD-003",
        mandiCode: "WB_HNK_03",
        mandiName: "Nadia Cooperative Milk Chilling Center",
        commodity: "Cow Milk (Bulk Raw Chilled)",
        variety: "Crossbred High-FAT",
        quantity: 2850,
        unit: "LITRE",
        reservePrice: 38.5,
        fatPct: 4.4,
        snfPct: 8.7,
        assayGrade: "A-Grade Chilled 4.0C",
        demo: true,
      },
    ];

    for (const l of lots) {
      await this.createEnamLot(l);
    }
  },

  async clearDemoLots() {
    const all = await enamLots.getAll();
    for (const l of all.filter((x) => x.demo)) {
      await enamLots.remove(l.id);
    }
  },
};
