/* Fraud & anomaly detection — rule-based signals over listings, sellers and
   orders. Every flag is explainable (which rule fired, how strong) and rolls up
   to a severity. A real anomaly model can replace the rule set behind `scan()`
   without changing consumers. */

import { featureStore } from "./featureStore.js";
import { pct } from "./explain.js";

const num = (v) => Number(v) || 0;
const norm = (s) => String(s || "").toLowerCase().trim();

const severityOf = (score) => (score >= 66 ? "high" : score >= 33 ? "medium" : "low");

/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const fraudDetection = {
  /* Scan the whole catalogue and return flagged items with reasons. */
  async scan() {
    const snap = await featureStore.snapshot();
    const products = snap.products;

    // Category median prices for outlier detection.
    const byCat = {};
    products.forEach((p) => { (byCat[p.category] ||= []).push(num(p.price)); });
    const medians = {};
    Object.entries(byCat).forEach(([c, arr]) => {
      const s = arr.filter(Boolean).sort((a, b) => a - b);
      medians[c] = s.length ? s[Math.floor(s.length / 2)] : 0;
    });

    // Duplicate detection by normalised name.
    const nameCount = {};
    products.forEach((p) => { nameCount[norm(p.name)] = (nameCount[norm(p.name)] || 0) + 1; });

    const sellerById = new Map(snap.sellers.map((s) => [s.id, s]));

    const flags = [];
    products.forEach((p) => {
      const reasons = [];
      let signal = 0;
      const median = medians[p.category] || num(p.price);

      // 1. Too-good-to-be-true price (>55% below category median)
      if (median && num(p.price) < median * 0.45) {
        signal += 40; reasons.push({ label: `Price ₹${p.price} far below category median ₹${median}`, weight: "high" });
      }
      // 2. Duplicate listing
      if (nameCount[norm(p.name)] > 1) {
        signal += 20; reasons.push({ label: `Duplicate listing name (${nameCount[norm(p.name)]}×)`, weight: "medium" });
      }
      // 3. Unverified seller on a high-value listing
      const seller = sellerById.get(p.sellerId);
      if (seller && !seller.verified && num(p.price) > 5000) {
        signal += 25; reasons.push({ label: "Unverified seller, high-value listing", i18n: { en: "Unverified seller, high-value listing", hi: "असत्यापित विक्रेता, उच्च-मूल्य लिस्टिंग", bn: "অযাচাইকৃত বিক্রেতা, উচ্চমূল্যের তালিকা" }, weight: "medium" });
      }
      // 4. No sales + no reviews but many listings from a cold seller
      if (seller && seller.orderCount === 0 && (seller.deliveredCount || 0) === 0 && num(p.price) > 2000) {
        signal += 15; reasons.push({ label: "New seller, no fulfilment history", i18n: { en: "New seller, no fulfilment history", hi: "नया विक्रेता, कोई आपूर्ति इतिहास नहीं", bn: "নতুন বিক্রেতা, সরবরাহের কোনও ইতিহাস নেই" }, weight: "low" });
      }

      if (signal > 0) {
        const score = Math.min(100, signal);
        flags.push({
          subjectType: "product", subjectId: p.id, name: p.name,
          sellerName: p.sellerName, score, severity: severityOf(score), reasons,
        });
      }
    });

    return flags.sort((a, b) => b.score - a.score);
  },

  /* Account risk score for a seller (fake-seller signals). */
  async sellerRisk(sellerId) {
    const snap = await featureStore.snapshot();
    const s = snap.sellers.find((x) => x.id === sellerId);
    if (!s) return null;
    const listings = snap.products.filter((p) => p.sellerId === sellerId);
    let signal = 0;
    const reasons = [];
    if (!s.verified) { signal += 30; reasons.push({ label: "Not verified", i18n: { en: "Not verified", hi: "असत्यापित", bn: "যাচাই করা হয়নি" }, weight: "medium" }); }
    if (s.cancelledCount > s.deliveredCount) { signal += 30; reasons.push({ label: "More cancellations than deliveries", i18n: { en: "More cancellations than deliveries", hi: "डिलीवरी से ज़्यादा रद्दीकरण", bn: "সরবরাহের চেয়ে বাতিলের সংখ্যা বেশি" }, weight: "high" }); }
    if (listings.length > 5 && s.orderCount === 0) { signal += 25; reasons.push({ label: "Many listings, zero orders", i18n: { en: "Many listings, zero orders", hi: "कई लिस्टिंग, शून्य ऑर्डर", bn: "অনেক তালিকা, শূন্য অর্ডার" }, weight: "medium" }); }
    if (s.rating > 0 && s.rating < 2.5) { signal += 15; reasons.push({ label: `Low rating ${s.rating}★`, weight: "low" }); }
    const score = Math.min(100, signal);
    return { sellerId, name: s.name, score: pct(score / 100), severity: severityOf(score), reasons };
  },
};
