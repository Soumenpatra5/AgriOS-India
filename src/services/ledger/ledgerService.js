import { repo } from "../erp/erpDb.js";

const txns = repo("ledgerTxns");

/* label stays English — it is the category name in CSV exports and the key
   reports group on. i18n is what the UI shows. */
export const INCOME_CATEGORIES = [
  { id: "crop_sale",      label: "Crop sale",           icon: "Wheat", i18n: { en: "Crop sale", hi: "फ़सल बिक्री", bn: "ফসল বিক্রয়" }      },
  { id: "milk_sale",      label: "Milk sale",            icon: "Milk", i18n: { en: "Milk sale", hi: "दूध बिक्री", bn: "দুধ বিক্রয়" }       },
  { id: "poultry_sale",   label: "Poultry / egg sale",   icon: "Bird", i18n: { en: "Poultry / egg sale", hi: "मुर्गी / अंडा बिक्री", bn: "মুরগি / ডিম বিক্রয়" }       },
  { id: "fish_sale",      label: "Fish sale",            icon: "Fish", i18n: { en: "Fish sale", hi: "मछली बिक्री", bn: "মাছ বিক্রয়" }       },
  { id: "livestock_sale", label: "Livestock sale",       icon: "Rabbit", i18n: { en: "Livestock sale", hi: "पशु बिक्री", bn: "পশু বিক্রয়" }     },
  { id: "subsidy",        label: "Subsidy / scheme",     icon: "Building2", i18n: { en: "Subsidy / scheme", hi: "सब्सिडी / योजना", bn: "ভর্তুকি / প্রকল্প" }  },
  { id: "other_income",   label: "Other income",         icon: "Wallet", i18n: { en: "Other income", hi: "अन्य आय", bn: "অন্যান্য আয়" }     },
];

export const EXPENSE_CATEGORIES = [
  { id: "seeds",       label: "Seeds",                   icon: "Sprout", i18n: { en: "Seeds", hi: "बीज", bn: "বীজ" }    },
  { id: "fertilizer",  label: "Fertilizer",              icon: "Leaf", i18n: { en: "Fertilizer", hi: "उर्वरक", bn: "সার" }      },
  { id: "pesticide",   label: "Pesticide / herbicide",   icon: "SprayCan", i18n: { en: "Pesticide / herbicide", hi: "कीटनाशक / खरपतवारनाशी", bn: "কীটনাশক / আগাছানাশক" }  },
  { id: "labour",      label: "Labour",                  icon: "Users", i18n: { en: "Labour", hi: "श्रम", bn: "শ্রম" }     },
  { id: "feed",        label: "Feed",                    icon: "Package", i18n: { en: "Feed", hi: "चारा", bn: "খাদ্য" }   },
  { id: "medicine",    label: "Medicine",                icon: "Pill", i18n: { en: "Medicine", hi: "दवा", bn: "ওষুধ" }      },
  { id: "equipment",   label: "Equipment",               icon: "Tractor", i18n: { en: "Equipment", hi: "उपकरण", bn: "সরঞ্জাম" }   },
  { id: "irrigation",  label: "Irrigation",              icon: "Droplets", i18n: { en: "Irrigation", hi: "सिंचाई", bn: "সেচ" }  },
  { id: "transport",   label: "Transport",               icon: "Truck", i18n: { en: "Transport", hi: "परिवहन", bn: "পরিবহন" }     },
  { id: "other_exp",   label: "Other expense",           icon: "Package", i18n: { en: "Other expense", hi: "अन्य व्यय", bn: "অন্যান্য ব্যয়" }   },
];

export const ENTERPRISES = [
  { id: "crop",    label: "Crop", i18n: { en: "Crop", hi: "फ़सल", bn: "ফসল" }          },
  { id: "dairy",   label: "Dairy", i18n: { en: "Dairy", hi: "डेयरी", bn: "ডেয়ারি" }         },
  { id: "poultry", label: "Poultry", i18n: { en: "Poultry", hi: "मुर्गी पालन", bn: "হাঁস-মুরগি" }       },
  { id: "goat",    label: "Goat", i18n: { en: "Goat", hi: "बकरी", bn: "ছাগল" }          },
  { id: "fish",    label: "Fish", i18n: { en: "Fish", hi: "मछली", bn: "মাছ" }          },
  { id: "horti",   label: "Horticulture", i18n: { en: "Horticulture", hi: "बागवानी", bn: "উদ্যানপালন" }  },
  { id: "other",   label: "Other", i18n: { en: "Other", hi: "अन्य", bn: "অন্যান্য" }         },
];

export const ledgerService = {
  async all() {
    const list = await txns.getAll();
    return list.sort((a, b) => b.date.localeCompare(a.date));
  },

  async forMonth(year, month) {
    /* A bounded scan on the `date` index — the store has had this index all
       along, but this used to call all() and filter, materializing the
       entire transaction history (which grows forever on an active farm) to
       summarize one month. Runs on every Home mount, so it earns the index. */
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    /* Upper bound: prefix + U+FFFF sorts after every real date suffix. */
    const rows = await txns.getRange("date", prefix, prefix + String.fromCharCode(0xffff));
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async monthSummary(year, month) {
    const list = await this.forMonth(year, month);
    const income  = list.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
    const expense = list.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  },

  async currentMonthSummary() {
    const d = new Date();
    return this.monthSummary(d.getFullYear(), d.getMonth() + 1);
  },

  async add(txn) {
    const record = await txns.add(txn);
    return record.id;
  },

  async remove(id) {
    await txns.remove(id);
  },

  categoryLabel(kind, categoryId) {
    const src = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return src.find((c) => c.id === categoryId)?.label ?? categoryId;
  },

  /* The {en,hi,bn} object for a category, for callers that can translate.
     categoryLabel stays the English canonical for CSV export and grouping. */
  categoryI18n(kind, categoryId) {
    const src = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const c = src.find((x) => x.id === categoryId);
    return c?.i18n ?? { en: c?.label ?? categoryId, hi: c?.label ?? categoryId, bn: c?.label ?? categoryId };
  },

  categoryIcon(kind, categoryId) {
    const src = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return src.find((c) => c.id === categoryId)?.icon ?? "Wallet";
  },

  enterpriseLabel(id) {
    return ENTERPRISES.find((e) => e.id === id)?.label ?? "";
  },
};
