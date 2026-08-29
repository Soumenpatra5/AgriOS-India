/* Smart pricing — suggested sell / buy / bulk prices with margin and
   competition analysis. Anchored on the crop price band (produce) or on
   competing listings (inputs). Explainable: every suggestion lists its basis. */

import { CROPS, searchCrops } from "../market/cropData.js";
import { featureStore } from "./featureStore.js";
import { pricePrediction } from "./pricePrediction.js";
import { confidenceFromN } from "./explain.js";

const num = (v) => Number(v) || 0;
const round = (n) => Math.round(n);

/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const smartPricing = {
  /* Suggested SELLING price for produce (crop) — nudged above the forecast when
     demand is firming, toward mid-band otherwise. */
  async suggestSell(cropQuery, { grade = "standard" } = {}) {
    const f = await pricePrediction.forecast(cropQuery);
    if (!f.found) return f;
    const gradeMult = grade === "premium" ? 1.08 : grade === "fair" ? 0.94 : 1.0;
    const suggested = round(f.predicted * gradeMult);
    const floor = f.floor;
    return {
      found: true, crop: f.crop, unit: f.unit,
      suggested, floor, hasMsp: f.hasMsp, ceiling: f.bandHigh,
      reasons: [
        { label: `Forecast ₹${f.predicted}/${f.unit} (${f.direction})`, contribution: 55 },
        { label: `Grade adjustment (${grade})`, contribution: 25 },
        { label: f.hasMsp ? `Never sell below MSP ₹${f.msp}` : `Band floor ₹${floor} (no MSP for this crop)`, contribution: 20 },
      ],
      confidence: f.confidence,
      disclaimer: f.disclaimer,
    };
  },

  /* Suggested BUYING price for a buyer/procurer — mid-band, discounted for bulk. */
  async suggestBuy(cropQuery, { quantityTonnes = 1 } = {}) {
    const crop = CROPS.find((c) => c.id === cropQuery) || searchCrops(cropQuery)[0];
    if (!crop) return { found: false, message: `No reference for "${cropQuery}".` };
    const mid = (crop.bandLow + crop.bandHigh) / 2;
    const bulkDiscount = Math.min(0.08, quantityTonnes / 100); // up to 8%
    const suggested = round(mid * (1 - bulkDiscount));
    return {
      found: true, crop: crop.name, unit: crop.unit,
      suggested,
      reasons: [
        { label: `Seasonal mid-band ₹${round(mid)}/${crop.unit}`, contribution: 70 },
        { label: `Bulk discount ${(bulkDiscount * 100).toFixed(1)}% for ${quantityTonnes}t`, contribution: 30 },
      ],
      confidence: confidenceFromN(10, 20),
    };
  },

  /* Bulk pricing tiers suggestion for a seller listing a product. */
  bulkTiers(basePrice) {
    const p = num(basePrice);
    if (!p) return [];
    return [
      { minQty: 10, price: round(p * 0.97), off: "3%" },
      { minQty: 50, price: round(p * 0.93), off: "7%" },
      { minQty: 100, price: round(p * 0.88), off: "12%" },
    ];
  },

  /* Competition + margin analysis for a product against same-category listings. */
  async analyze(productId, { unitCost = null } = {}) {
    const snap = await featureStore.snapshot();
    const p = snap.products.find((x) => x.id === productId);
    if (!p) return { found: false };
    const peers = snap.products.filter((x) => x.category === p.category && x.id !== productId && x.status === "published");
    const prices = peers.map((x) => num(x.price)).filter(Boolean).sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : num(p.price);
    const positionPct = median ? Math.round((num(p.price) / median - 1) * 100) : 0;
    const margin = unitCost != null && num(unitCost) > 0
      ? Math.round((num(p.price) - num(unitCost)) / num(p.price) * 100) : null;

    return {
      found: true, price: num(p.price), peerMedian: median, peerCount: peers.length,
      position: positionPct > 5 ? "above market" : positionPct < -5 ? "below market" : "at market",
      positionPct, margin,
      reasons: [
        { label: `${peers.length} competing listings, median ₹${median}`, contribution: 60 },
        margin != null ? { label: `Gross margin ${margin}%`, contribution: 40 } : { label: "Provide unit cost for margin analysis", contribution: 40, i18n: { en: "Provide unit cost for margin analysis", hi: "मार्जिन विश्लेषण के लिए इकाई लागत दें", bn: "মার্জিন বিশ্লেষণের জন্য একক ব্যয় দিন" } },
      ],
      confidence: confidenceFromN(peers.length, 6),
    };
  },
};
