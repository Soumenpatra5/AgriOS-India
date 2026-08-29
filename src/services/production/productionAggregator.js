/* Production dashboard data — aggregates livestock production records and
   crop-calendar harvests into one cross-farm view. */

import { productionService, eventService, ENTERPRISES } from "../livestock/livestockService.js";

/* enterprise -> which record field is the production quantity + its unit */
const METRICS = {
  poultry: { key: "eggs",     label: "Eggs",       unit: "pcs", i18n: { en: "Eggs", hi: "अंडे", bn: "ডিম" } },
  dairy:   { key: "quantity", label: "Milk",       unit: "L", i18n: { en: "Milk", hi: "दूध", bn: "দুধ" }   },
  goat:    { key: "weightKg", label: "Weight",     unit: "kg", i18n: { en: "Weight", hi: "वज़न", bn: "ওজন" }  },
  pig:     { key: "weightKg", label: "Weight",     unit: "kg", i18n: { en: "Weight", hi: "वज़न", bn: "ওজন" }  },
  sheep:   { key: "weightKg", label: "Weight",     unit: "kg", i18n: { en: "Weight", hi: "वज़न", bn: "ওজন" }  },
  fish:    { key: "feedKg",   label: "Feed used",  unit: "kg", i18n: { en: "Feed used", hi: "इस्तेमाल हुआ चारा", bn: "ব্যবহৃত খাদ্য" }  },
  bee:     { key: "honeyKg",  label: "Honey",      unit: "kg", i18n: { en: "Honey", hi: "शहद", bn: "মধু" }  },
};

/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const productionAggregator = {
  /* Current-month production per enterprise (only enterprises with data). */
  async monthSnapshot() {
    const prefix = new Date().toISOString().slice(0, 7);
    const rows = await Promise.all(ENTERPRISES.map(async (e) => {
      const metric = METRICS[e.id] || { key: "quantity", label: "Production", i18n: { en: "Production", hi: "उत्पादन", bn: "উৎপাদন" }, unit: "" };
      const records = await productionService.getForEnterprise(e.id, 120);
      const monthRecords = records.filter((r) => r.date.startsWith(prefix));
      const total = monthRecords.reduce((s, r) => s + (Number(r[metric.key]) || 0), 0);
      return { enterprise: e, metric, total, entries: monthRecords.length,
               allTime: records.reduce((s, r) => s + (Number(r[metric.key]) || 0), 0) };
    }));
    return rows.filter((r) => r.entries > 0 || r.allTime > 0);
  },

  /* Fish + other harvest events this year. */
  async harvests() {
    const lists = await Promise.all(ENTERPRISES.map(async (e) => {
      const events = await eventService.getForEnterprise(e.id);
      return events
        .filter((ev) => ev.type === "harvest" && ev.weightKg)
        .map((ev) => ({ ...ev, enterpriseLabel: e.label }));
    }));
    return lists.flat().sort((a, b) => b.date.localeCompare(a.date));
  },

  /* Mortality this month across enterprises (poultry logs mortality daily). */
  async monthMortality() {
    const prefix = new Date().toISOString().slice(0, 7);
    let total = 0;
    for (const e of ENTERPRISES) {
      const records = await productionService.getForEnterprise(e.id, 120);
      total += records.filter((r) => r.date.startsWith(prefix))
                      .reduce((s, r) => s + (Number(r.mortality) || 0), 0);
    }
    return total;
  },
};
