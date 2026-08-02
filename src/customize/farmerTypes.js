/* Farmer-profile enterprise types — the mapping + gate used to tailor the app
   to what a farmer actually does. Opt-out: a type is "enabled" unless the user
   turned it off. Diagnostics domains and livestock managers filter through this. */

export const FARMER_TYPES = ["crop", "poultry", "dairy", "fish", "goat", "pig", "bee"];

export const TYPE_LABELS = {
  crop:    { en: "Crop", hi: "फसल", bn: "ফসল" },
  poultry: { en: "Poultry", hi: "मुर्गी", bn: "মুরগি" },
  dairy:   { en: "Dairy", hi: "डेयरी", bn: "দুগ্ধ" },
  fish:    { en: "Fish", hi: "मछली", bn: "মাছ" },
  goat:    { en: "Goat", hi: "बकरी", bn: "ছাগল" },
  pig:     { en: "Pig", hi: "सूअर", bn: "শূকর" },
  bee:     { en: "Bee", hi: "मधुमक्खी", bn: "মৌমাছি" },
};

/* Map a diagnostics-domain / livestock-enterprise id to its farmer type. */
export function enterpriseType(id) {
  return id === "plant" ? "crop" : id;
}

/* Is this domain/enterprise enabled for the farmer? Ids with no matching type
   (e.g. "sheep") are always shown. */
export function isTypeEnabled(prefs, id) {
  const t = enterpriseType(id);
  const types = prefs?.farmerProfile?.types || {};
  if (!(t in types)) return true;
  return types[t] !== false;
}

/* Filter a list by farmer type, but never return empty — if the user disabled
   everything relevant, fall back to the full list so no screen goes blank. */
export function filterByType(prefs, items, idOf = (x) => x.id) {
  const shown = items.filter((x) => isTypeEnabled(prefs, idOf(x)));
  return shown.length ? shown : items;
}
