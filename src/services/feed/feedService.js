/* Feed Management — Phase 1: calculator, inventory, purchases.

   Deliberately thin: this module owns feed-specific catalogs and the
   decimal-safe calculation engine, but stock and money live in the
   services that already own them —
     inventoryService  (src/services/inventory/inventoryService.js) — feed
       items are ordinary inventory records with category "feed" plus a
       few extra optional fields (feedType, brand, batchNumber, mfgDate,
       storageLocation). No parallel inventory store.
     orderService       (src/services/crm/orderService.js)            — feed
       purchases are ordinary purchase orders (kind:"purchase").
     contactService      (src/services/crm/contactService.js)          — feed
       suppliers are ordinary CRM contacts (type "supplier"/"vendor").
   Nothing here duplicates those services; it only orchestrates them. */

import { inventoryService } from "../inventory/inventoryService.js";
import { orderService } from "../crm/orderService.js";
import { ledgerService } from "../ledger/ledgerService.js";
import { safeNum, round2 } from "../../utils/num.js";

export const FEED_CATEGORY = "feed"; // matches inventoryService.ITEM_CATEGORIES id

/* label stays English — feedReportService writes it into CSV exports and
   feedAnalyticsService groups on it. i18n is what the UI shows. */
export const FEED_TYPES = [
  { id: "starter",  label: "Starter Feed" , i18n: { en: "Starter Feed", hi: "स्टार्टर फ़ीड", bn: "স্টার্টার ফিড" } },
  { id: "grower",   label: "Grower Feed" , i18n: { en: "Grower Feed", hi: "ग्रोअर फ़ीड", bn: "গ্রোয়ার ফিড" } },
  { id: "finisher", label: "Finisher Feed" , i18n: { en: "Finisher Feed", hi: "फिनिशर फ़ीड", bn: "ফিনিশার ফিড" } },
  { id: "layer",    label: "Layer Feed" , i18n: { en: "Layer Feed", hi: "लेयर फ़ीड", bn: "লেয়ার ফিড" } },
  { id: "broiler",  label: "Broiler Feed" , i18n: { en: "Broiler Feed", hi: "ब्रॉयलर फ़ीड", bn: "ব্রয়লার ফিড" } },
  { id: "dairy",    label: "Dairy Feed" , i18n: { en: "Dairy Feed", hi: "डेयरी फ़ीड", bn: "ডেয়ারি ফিড" } },
  { id: "goat",     label: "Goat Feed" , i18n: { en: "Goat Feed", hi: "बकरी फ़ीड", bn: "ছাগলের ফিড" } },
  { id: "pig",      label: "Pig Feed" , i18n: { en: "Pig Feed", hi: "सूअर फ़ीड", bn: "শূকরের ফিড" } },
  { id: "fish",     label: "Fish Feed" , i18n: { en: "Fish Feed", hi: "मछली फ़ीड", bn: "মাছের ফিড" } },
  { id: "duck",     label: "Duck Feed" , i18n: { en: "Duck Feed", hi: "बत्तख फ़ीड", bn: "হাঁসের ফিড" } },
  { id: "sheep",    label: "Sheep Feed" , i18n: { en: "Sheep Feed", hi: "भेड़ फ़ीड", bn: "ভেড়ার ফিড" } },
  { id: "rabbit",   label: "Rabbit Feed" , i18n: { en: "Rabbit Feed", hi: "खरगोश फ़ीड", bn: "খরগোশের ফিড" } },
  { id: "bee",      label: "Bee Feed / Supplement" , i18n: { en: "Bee Feed / Supplement", hi: "मधुमक्खी फ़ीड / सप्लीमेंट", bn: "মৌমাছির ফিড / সাপ্লিমেন্ট" } },
  { id: "custom",   label: "Custom Feed" , i18n: { en: "Custom Feed", hi: "कस्टम फ़ीड", bn: "কাস্টম ফিড" } },
];

/* Broader than livestockService.ENTERPRISES (poultry/dairy/goat/pig/sheep/
   fish/bee) — the calculator/inventory need to describe duck/rabbit/other
   feed even though those don't have a dedicated livestock manager page yet. */
export const LIVESTOCK_TYPES = [
  { id: "poultry", label: "Poultry" , i18n: { en: "Poultry", hi: "मुर्गी पालन", bn: "হাঁস-মুরগি" } },
  { id: "dairy",   label: "Dairy" , i18n: { en: "Dairy", hi: "डेयरी", bn: "ডেয়ারি" } },
  { id: "goat",    label: "Goat" , i18n: { en: "Goat", hi: "बकरी", bn: "ছাগল" } },
  { id: "pig",     label: "Pig" , i18n: { en: "Pig", hi: "सूअर", bn: "শূকর" } },
  { id: "sheep",   label: "Sheep" , i18n: { en: "Sheep", hi: "भेड़", bn: "ভেড়া" } },
  { id: "fish",    label: "Fish" , i18n: { en: "Fish", hi: "मछली", bn: "মাছ" } },
  { id: "duck",    label: "Duck" , i18n: { en: "Duck", hi: "बत्तख", bn: "হাঁস" } },
  { id: "rabbit",  label: "Rabbit" , i18n: { en: "Rabbit", hi: "खरगोश", bn: "খরগোশ" } },
  { id: "other",   label: "Other" , i18n: { en: "Other", hi: "अन्य", bn: "অন্যান্য" } },
];

/* ------------------------------------------------------------ calc engine -- */

/**
 * computeFeedCost — the upgraded Feed Calculator engine. Preserves the
 * original 4-field formula exactly:
 *   Total Feed = animalCount x feedPerAnimalPerDay x days
 *   Total Feed Cost = Total Feed x feedPricePerKg
 * and adds the per-animal/monthly/period breakdowns the spec asks for.
 * All arithmetic is rounded to paise at each step (no unrounded floats
 * carried through a chain of multiplications) to keep financial values
 * decimal-safe.
 */
export function computeFeedCost({ animalCount, feedPerAnimalPerDay, feedPricePerKg, days } = {}) {
  const animals = safeNum(animalCount);
  const perAnimalPerDay = safeNum(feedPerAnimalPerDay);
  const price = safeNum(feedPricePerKg);
  const numDays = safeNum(days);

  const totalDailyFeed = round2(animals * perAnimalPerDay);
  const totalFeedRequired = round2(totalDailyFeed * numDays);
  const dailyFeedCost = round2(totalDailyFeed * price);
  const totalFeedCost = round2(totalFeedRequired * price);
  const feedCostPerAnimal = animals > 0 ? round2(totalFeedCost / animals) : 0;
  const estimatedMonthlyFeedCost = round2(dailyFeedCost * 30);
  /* "Production period" = the entered day count, i.e. the same total —
     exposed under its own label since a batch's production period and an
     ad-hoc costing period are conceptually different questions even when
     the number happens to match today. */
  const estimatedProductionPeriodCost = totalFeedCost;

  return {
    totalDailyFeed, totalFeedRequired, totalFeedCost, dailyFeedCost,
    feedCostPerAnimal, estimatedMonthlyFeedCost, estimatedProductionPeriodCost,
  };
}

/* ------------------------------------------------------------- inventory -- */

/* Feed items are ordinary inventory records; this just fixes category and
   filters, so the Feed Inventory screen never has to duplicate inventory
   CRUD or worry about drifting from inventoryService's schema. */
export const feedInventory = {
  add: (data) => inventoryService.addItem({ ...data, category: FEED_CATEGORY }),
  update: (id, patch) => inventoryService.updateItem(id, patch),
  remove: (id) => inventoryService.removeItem(id),
  getById: (id) => inventoryService.getById(id),

  async getAll(farmId) {
    const all = await inventoryService.getAll(farmId);
    return all.filter((i) => i.category === FEED_CATEGORY);
  },

  async alerts(farmId) {
    const { lowStock, expired, expiring } = await inventoryService.alerts(farmId);
    const only = (l) => l.filter((i) => i.category === FEED_CATEGORY);
    return { lowStock: only(lowStock), expired: only(expired), expiring: only(expiring) };
  },

  async stockValue(farmId) {
    const items = await this.getAll(farmId);
    return round2(items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0));
  },

  feedTypeLabel: (id) => FEED_TYPES.find((t) => t.id === id)?.label ?? id,
};

/* --------------------------------------------------------------- purchase -- */

/**
 * recordPurchase — creates a purchase order (via orderService, unchanged)
 * plus an all-inclusive `totalCost` (goods + GST - discount + transport +
 * other charges) stored alongside orderService's own `amount` (qty x rate,
 * its existing invariant — left untouched rather than fought). Then, as an
 * explicit consequence of the user confirming this purchase (not a hidden
 * side effect):
 *   1. updates feed inventory: stock-in an existing item, or create a new
 *      one if this is the first purchase of that feed.
 *   2. posts an expense to the existing Farm Ledger (category "feed",
 *      already defined there) so this purchase is reflected in P&L, cash
 *      flow and cost-per-unit the same way every other farm expense is —
 *      no second finance system.
 */
export const feedPurchase = {
  async record({
    contactId = null, supplierName = "", feedItemId = null, feedName, feedType,
    quantity, unit = "kg", unitPrice, gst = 0, discount = 0, transportCost = 0, otherCharges = 0,
    invoiceNumber = "", purchaseDate, paymentStatus = "open", paymentMethod = "", dueDate = "",
    storageLocation = "", farmId, enterprise = "other",
  }) {
    const qty = safeNum(quantity);
    const rate = safeNum(unitPrice);
    const goodsValue = round2(qty * rate);
    const totalCost = round2(goodsValue + safeNum(gst) - safeNum(discount) + safeNum(transportCost) + safeNum(otherCharges));
    const date = purchaseDate || new Date().toISOString().slice(0, 10);

    const order = await orderService.add({
      kind: "purchase", contactId, item: feedName, qty, unit, rate,
      date, status: paymentStatus, paymentMethod, dueDate,
      invoiceNumber, supplierName, gst: safeNum(gst), discount: safeNum(discount),
      transportCost: safeNum(transportCost), otherCharges: safeNum(otherCharges), totalCost,
      feedType, storageLocation, farmId, enterprise,
    });

    const item = feedItemId
      ? await inventoryService.move(feedItemId, "in", qty, `Purchase ${order.id}`).then(() => inventoryService.getById(feedItemId))
      : await feedInventory.add({
          name: feedName, feedType, unit, qty, unitPrice: rate,
          supplierName, storageLocation, farmId,
        });

    const ledgerTxnId = totalCost > 0 ? await ledgerService.add({
      kind: "expense", categoryId: "feed", enterpriseId: enterprise, amount: totalCost, date,
      note: `Feed purchase: ${feedName}${supplierName ? ` — ${supplierName}` : ""}`,
      sourceOrderId: order.id,
    }) : null;

    return { order, item, ledgerTxnId };
  },
};
