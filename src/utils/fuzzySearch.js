const TRANSLIT = {
  "fasal": "crop", "phashal": "crop", "khet": "farm field", "khamar": "farm",
  "rog": "disease", "roga": "disease", "keet": "pest", "poka": "pest",
  "pashu": "animal livestock", "pashupalan": "livestock", "murgi": "poultry",
  "bakri": "goat", "goru": "cow cattle", "gaay": "cow", "machli": "fish", "maach": "fish",
  "bhed": "sheep", "suar": "pig", "madhumakhi": "bee",
  "dawai": "medicine", "oushadh": "medicine", "osudh": "medicine",
  "tika": "vaccine vaccination", "tikakaran": "vaccination",
  "khad": "fertilizer", "sar": "fertilizer", "bij": "seed", "beej": "seed",
  "paani": "water irrigation", "jal": "water", "sinchai": "irrigation", "sech": "irrigation",
  "mausam": "weather", "aabohawa": "weather",
  "bazaar": "market mandi", "mandi": "market mandi", "bazar": "market",
  "rin": "loan", "karz": "loan", "emi": "loan",
  "bima": "insurance", "beema": "insurance",
  "sarkar": "government", "sarkari": "government", "yojana": "scheme",
  "prokolpo": "scheme project", "prakalp": "project",
  "hisab": "accounts ledger", "khata": "ledger accounts", "munafa": "profit",
  "labh": "profit", "khoroch": "expense", "kharch": "expense",
  "doctor": "doctor vet", "chikitsa": "doctor vet medical", "chikitsok": "doctor",
  "drone": "drone", "spray": "spray spraying", "chhidkav": "spray",
  "mazdoor": "labor worker", "shromik": "labor worker", "majdur": "labor",
  "vaahan": "transport vehicle", "gaadi": "transport vehicle", "poribohon": "transport",
  "prashikshan": "training", "proshikkhan": "training",
  "mitti": "soil", "maati": "soil",
  "doodh": "dairy milk", "dudh": "dairy milk",
  "chaara": "feed fodder", "khadya": "feed food",
  "bikri": "sell sale", "bechna": "sell", "bikroy": "sell sale",
  "khareed": "buy purchase", "kena": "buy purchase",
};

export function fuzzyMatch(items, query, { titleKey = "title", descKey = "desc", keywordsKey = "keywords" } = {}) {
  if (!query) return items;
  const q = query.toLowerCase().trim();
  if (!q) return items;

  const tokens = q.split(/\s+/);
  const expanded = tokens.map((t) => TRANSLIT[t] || "").join(" ");
  const searchStr = q + " " + expanded;

  return items.filter((item) => {
    const title = typeof item[titleKey] === "object" ? Object.values(item[titleKey]).join(" ") : (item[titleKey] || "");
    const desc = typeof item[descKey] === "object" ? Object.values(item[descKey]).join(" ") : (item[descKey] || "");
    const kw = item[keywordsKey] || "";
    const haystack = (title + " " + desc + " " + kw).toLowerCase();
    return searchStr.split(/\s+/).some((t) => t && haystack.includes(t));
  });
}
