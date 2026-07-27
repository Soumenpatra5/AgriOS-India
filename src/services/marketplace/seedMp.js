/* One-click demo data so the marketplace is explorable before the shared
   backend exists. Every seeded record carries demo:true so it can be cleared
   without touching anything the user created themselves. */

import { repo } from "./marketDb.js";

const sellers  = repo("sellers");
const products = repo("products");
const reviews  = repo("reviews");

const SELLERS = [
  { name: "Green Valley Seeds",   type: "dealer",       village: "Barasat",  district: "North 24 Parganas", state: "West Bengal", icon: "Sprout",   accent: "primary", tagline: "Certified seeds since 1998",  verificationStatus: "verified" },
  { name: "Kisan Agro Centre",    type: "retailer",     village: "Hooghly",  district: "Hooghly",           state: "West Bengal", icon: "Store",    accent: "orange",  tagline: "Fertilizers & crop care",     verificationStatus: "verified" },
  { name: "Bengal FPO Collective",type: "fpo",          village: "Nadia",    district: "Nadia",             state: "West Bengal", icon: "Users",    accent: "blue",    tagline: "1,200 farmer members",        verificationStatus: "verified" },
  { name: "Pashu Care Suppliers", type: "distributor",  village: "Burdwan",  district: "Purba Bardhaman",   state: "West Bengal", icon: "Pill",     accent: "red",     tagline: "Animal health & feed",        verificationStatus: "verified" },
  { name: "AgriMech Tools",       type: "company",      village: "Durgapur", district: "Paschim Bardhaman", state: "West Bengal", icon: "Tractor",  accent: "yellow",  tagline: "Farm equipment & spares",     verificationStatus: "verified" },
  { name: "Sundarban Organics",   type: "cooperative",  village: "Canning",  district: "South 24 Parganas", state: "West Bengal", icon: "Leaf",     accent: "primary", tagline: "Organic produce co-op",       verificationStatus: "pending"  },
];

/* [sellerIdx, name, brand, category, unit, price, discount, stock, featured, desc] */
const PRODUCTS = [
  [0, "Swarna Paddy Seed 10kg",        "Swarna",     "seeds",      "bag",    850,  799, 120, true,  "High-yield MTU7029 paddy, 80%+ germination, kharif season."],
  [0, "Hybrid Maize Seed 4kg",         "DKC-9081",   "seeds",      "packet", 1450, null, 60, false, "Rainfed & irrigated, 110-day duration."],
  [0, "Mustard Seed B-9 1kg",          "B-9",        "seeds",      "packet", 240,  220,  85, false, "Short-duration variety for rabi sowing."],
  [0, "Tomato Seed Arka Rakshak 10g",  "IIHR",       "seeds",      "packet", 320,  null, 45, false, "Triple disease resistant hybrid."],
  [0, "Ladies Finger Seed 250g",       "Ankur",      "seeds",      "packet", 410,  375,  50, false, "Summer & kharif okra, YVMV tolerant."],
  [1, "Urea 45kg",                     "IFFCO",      "fertilizer", "bag",    266,  null, 200, true, "Neem-coated urea, 46% N."],
  [1, "DAP 50kg",                      "IFFCO",      "fertilizer", "bag",    1350, null, 150, false,"Di-ammonium phosphate 18-46-0."],
  [1, "MOP 50kg",                      "IPL",        "fertilizer", "bag",    1700, 1650, 80, false, "Muriate of potash, 60% K2O."],
  [1, "Zinc Sulphate 5kg",             "Aries",      "fertilizer", "packet", 425,  null, 90, false, "21% Zn micronutrient for paddy & wheat."],
  [1, "Chlorpyrifos 20% EC 1L",        "Tata Rallis","pesticide",  "L",      520,  480,  70, false, "Broad-spectrum insecticide. Follow label."],
  [1, "Mancozeb 75% WP 1kg",           "Indofil",    "pesticide",  "kg",     390,  null, 65, false, "Contact fungicide for blight & downy mildew."],
  [1, "Neem Oil 3000ppm 1L",           "EcoNeem",    "bioinput",   "L",      450,  399,  55, true,  "Botanical pest repellent, organic-input listed."],
  [2, "Vermicompost 40kg",             "Bengal FPO", "bioinput",   "bag",    480,  440, 300, true,  "Member-produced, sieved & matured 90 days."],
  [2, "Trichoderma Viride 1kg",        "BioShakti",  "bioinput",   "kg",     310,  null, 40, false, "Soil-borne disease bio-control."],
  [2, "PSB Bio-fertilizer 1L",         "BioShakti",  "bioinput",   "L",      280,  260,  35, false, "Phosphate-solubilising bacteria."],
  [2, "Basmati Rice 25kg (Wholesale)", "FPO Mill",   "organic",    "bag",    2600, null, 90, false, "Member produce, single polish. Bulk rates."],
  [3, "Layer Feed 50kg",               "Godrej Agrovet","feed",    "bag",    1750, 1690, 110, true, "18% protein layer mash, phase 1."],
  [3, "Broiler Starter 50kg",          "Venky's",    "feed",       "bag",    1980, null, 95, false, "Crumb feed, 0-21 days."],
  [3, "Cattle Feed Pellet 50kg",       "Amul Dan",   "feed",       "bag",    1250, 1195, 130, false,"Balanced dairy ration, 20% protein."],
  [3, "Fish Feed Floating 25kg",       "Growel",     "feed",       "bag",    1150, null, 75, false, "28% protein, 3mm pellet for carp & tilapia."],
  [3, "Calcium Supplement 5L",         "Vetcare",    "medicine",   "L",      620,  580,  60, false, "Oral calcium for dairy cattle post-calving."],
  [3, "Dewormer Bolus (10)",           "Zydus AH",   "medicine",   "packet", 240,  null, 140, false,"Broad-spectrum for cattle & goat. Vet advice."],
  [3, "Poultry Vitamin AD3 1L",        "Provimi",    "medicine",   "L",      410,  385,  50, false, "Water-mix vitamin supplement."],
  [4, "Knapsack Sprayer 16L",          "Aspee",      "equipment",  "pcs",    2450, 2199, 30, true,  "Manual backpack sprayer, brass nozzle."],
  [4, "Battery Sprayer 12V 16L",       "Neptune",    "equipment",  "pcs",    3900, 3599, 22, false, "8-10 hr backup, charger included."],
  [4, "Rotavator Blade Set (36)",      "Shaktiman",  "tools",      "set",    5400, null, 15, false, "Boron steel, fits 6-ft rotavator."],
  [4, "Sickle Serrated (5 pack)",      "Falcon",     "tools",      "set",    475,  425,  80, false, "Carbon steel harvest sickles."],
  [4, "HDPE Tarpaulin 24x18ft",        "Tarpol",     "tools",      "pcs",    1850, 1700, 40, false, "200 GSM drying & grain cover."],
  [5, "Organic Honey 1kg",             "Sundarban",  "organic",    "kg",     650,  599,  45, true,  "Raw multiflora honey from mangrove apiaries."],
  [5, "Organic Turmeric Powder 1kg",   "Sundarban",  "organic",    "kg",     380,  350,  60, false, "Lakadong-type, lab-tested curcumin 6%+."],
];

/* [productIdx, rating, author, text] */
const REVIEWS = [
  [0,  5, "Ramen M.", "Good germination, sowed 2 bighas. Delivery in 3 days."],
  [0,  4, "Sk. Arif", "Seed quality good but packing was torn."],
  [5,  5, "Bishu D.", "Fresh stock, proper billing with subsidy rate."],
  [12, 5, "Anita K.", "Best vermicompost I have used for vegetables."],
  [16, 4, "Habib R.", "Birds taking feed well, will order again."],
  [23, 5, "Tapan S.", "Strong sprayer, no leakage after one month."],
  [28, 5, "Maya B.",  "Pure honey, kids love it."],
];

export const seedMp = {
  async hasData() {
    return (await products.count()) > 0;
  },

  async load() {
    const sellerRecs = [];
    for (const s of SELLERS) {
      sellerRecs.push(await sellers.add({ ...s, kycStatus: "submitted", demo: true }));
    }
    const productRecs = [];
    for (const [si, name, brand, category, unit, price, discountPrice, stock, featured, description] of PRODUCTS) {
      productRecs.push(await products.add({
        sellerId: sellerRecs[si].id, sellerName: sellerRecs[si].name,
        name, brand, category, unit, price, discountPrice, stock,
        reserved: 0, lowStockAt: Math.ceil(stock * 0.15), featured,
        description, status: "published", demo: true,
      }));
    }
    for (const [pi, rating, author, text] of REVIEWS) {
      const p = productRecs[pi];
      await reviews.add({ productId: p.id, sellerId: p.sellerId, rating, author, text, verified: true, demo: true });
    }
    return { sellers: sellerRecs.length, products: productRecs.length };
  },

  async clear() {
    for (const r of [sellers, products, reviews]) {
      const list = await r.getAll();
      await Promise.all(list.filter((x) => x.demo).map((x) => r.remove(x.id)));
    }
  },
};
