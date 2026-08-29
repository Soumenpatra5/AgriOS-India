/* Administrative location lookup — the only module that knows the dataset's
   shape. Everything else works in ids and the objects returned here, so
   replacing indiaGeo.js with an LGD extract touches no component.

   No network and no store. The dataset is a bundled constant, so every lookup
   is synchronous and works offline permanently — there is nothing to cache,
   nothing to fetch, and no keystroke to debounce. India is ~36 states and ~780
   districts, which is smaller than several existing chunks.

   IDS. `IN-WB` and `IN-WB-jhargram`: country, ISO subdivision code, then a slug
   of the district name. The slug is derived from a name, so a rename would
   change it — ALIASES in the dataset maps old ids forward, and resolve() walks
   it, so a saved id keeps working after a rename. */

import {
  COUNTRIES, STATES_RAW, ALIASES, DATASET, DEFAULT_COUNTRY_ID,
} from "./indiaGeo.js";

export { DATASET, COUNTRIES, DEFAULT_COUNTRY_ID };

const slug = (s) => String(s).toLowerCase().trim()
  .replace(/[.'']/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

/* Built once at module load: ~800 rows, cheap, and it makes every lookup below
   an O(1) map hit rather than a scan. */
const STATES = [];
const DISTRICTS_BY_STATE = new Map();
const STATE_BY_ID = new Map();
const DISTRICT_BY_ID = new Map();

for (const raw of STATES_RAW) {
  const id = `${DEFAULT_COUNTRY_ID}-${raw.code}`;
  const state = {
    id, countryId: DEFAULT_COUNTRY_ID, code: raw.code,
    name: raw.name, type: raw.type,
  };
  STATES.push(state);
  STATE_BY_ID.set(id, state);

  const districts = raw.districts.split("|").filter(Boolean).map((name) => {
    const d = { id: `${id}-${slug(name)}`, stateId: id, countryId: DEFAULT_COUNTRY_ID, name };
    DISTRICT_BY_ID.set(d.id, d);
    return d;
  });
  DISTRICTS_BY_STATE.set(id, districts);
}

/* Sorted once. Alphabetical by name, which is what a picker wants. */
const STATES_SORTED = [...STATES].sort((a, b) => a.name.localeCompare(b.name));
for (const [k, v] of DISTRICTS_BY_STATE) {
  DISTRICTS_BY_STATE.set(k, [...v].sort((a, b) => a.name.localeCompare(b.name)));
}

/* Follow renames. Bounded so a bad alias cycle cannot hang the app. */
function resolveId(id, map) {
  let cur = id;
  for (let i = 0; i < 5; i++) {
    if (!cur || map.has(cur)) return cur;
    if (!ALIASES[cur]) return cur;
    cur = ALIASES[cur];
  }
  return cur;
}

export const countries = () => COUNTRIES;
export const states = () => STATES_SORTED;

export const districtsOf = (stateId) =>
  DISTRICTS_BY_STATE.get(resolveId(stateId, STATE_BY_ID)) || [];

export const getState = (id) => STATE_BY_ID.get(resolveId(id, STATE_BY_ID)) || null;
export const getDistrict = (id) => DISTRICT_BY_ID.get(resolveId(id, DISTRICT_BY_ID)) || null;
export const getCountry = (id) => COUNTRIES.find((c) => c.id === (id || DEFAULT_COUNTRY_ID)) || null;

/* Substring match, accent- and punctuation-insensitive, so "jhar" finds
   Jhargram and "24 parganas" finds both. Deliberately not fuzzy: a farmer
   scanning a list is better served by too few results than by plausible wrong
   ones near the top. */
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const matches = (name, q) => {
  const n = norm(name), needle = norm(q);
  if (!needle) return true;
  return needle.split(" ").every((w) => n.includes(w));
};

export const searchStates = (q) => STATES_SORTED.filter((s) => matches(s.name, q));
export const searchDistricts = (stateId, q) => districtsOf(stateId).filter((d) => matches(d.name, q));

/* Is this pair internally consistent? The check that stops West Bengal /
   Patna. Returns a reason rather than a bare false so callers can say what is
   wrong instead of just refusing. */
export function validate({ stateId, districtId }) {
  if (!stateId) {
    return districtId
      ? { ok: false, reason: "district_without_state" }
      : { ok: true, reason: "empty" };
  }
  const state = getState(stateId);
  if (!state) return { ok: false, reason: "unknown_state" };
  if (!districtId) return { ok: true, reason: "state_only" };

  const district = getDistrict(districtId);
  if (!district) return { ok: false, reason: "unknown_district" };
  if (district.stateId !== state.id) return { ok: false, reason: "district_not_in_state" };
  return { ok: true, reason: "ok" };
}

/* Names for display, from ids. Falls back to any stored names so a record that
   predates the ids still renders something. */
export function describe({ countryId, stateId, districtId, stateName, districtName } = {}) {
  const state = getState(stateId);
  const district = getDistrict(districtId);
  return {
    country: getCountry(countryId)?.name || "India",
    state: state?.name || stateName || "",
    district: district?.name || districtName || "",
  };
}

/* ------------------------------------------------------------------ matching

   Maps the free text that existing records hold onto ids. Used by the one-time
   migration and, later, by GPS suggestions — both of which face the same
   problem: a name that may or may not be in the dataset.

   Only exact (normalised) matches are accepted. Anything else returns null so
   the caller can flag the record for review rather than guess — an
   automatically wrong district is worse than an unmapped one, because nobody
   ever looks at it again. */
export function matchState(name) {
  if (!name) return null;
  const n = norm(name);
  return STATES.find((s) => norm(s.name) === n) || null;
}

export function matchDistrict(stateId, name) {
  if (!stateId || !name) return null;
  const n = norm(name);
  return districtsOf(stateId).find((d) => norm(d.name) === n) || null;
}

/* Best-effort upgrade of a legacy { state, district } text pair.

   Returns { countryId, stateId, districtId, stateName, districtName, review }.
   `review` is true when something was present but could not be mapped — the
   text is preserved either way, so nothing is lost by leaving it unmapped. */
export function upgradeLegacy({ state = "", district = "" } = {}) {
  const s = matchState(state);
  const d = s ? matchDistrict(s.id, district) : null;
  const unmapped = (!!String(state).trim() && !s) || (!!String(district).trim() && !d);
  return {
    countryId: DEFAULT_COUNTRY_ID,
    stateId: s?.id || "",
    districtId: d?.id || "",
    /* The original text is kept: it is the denormalised display value, and the
       only record of what the farmer actually typed if the match failed. */
    stateName: s?.name || String(state).trim(),
    districtName: d?.name || String(district).trim(),
    review: unmapped,
  };
}

/* ---------------------------------------------------------------- suggestion

   GPS gives OSM's names, which do not always equal the dataset's — "Puruliya"
   for "Purulia", "Hooghly" for "Hugli", a trailing " District". Exact matching
   alone would reject most real positions, so this is deliberately more
   forgiving than matchDistrict().

   It is only ever a SUGGESTION. Nothing here writes; the caller shows it and
   the farmer confirms, because a wrong administrative location is worse than
   none — it silently mis-targets schemes and prices. */
const NOISE = /\b(district|dist|division|subdivision|zilla|zila)\b/g;
const loose = (s) => norm(s).replace(NOISE, " ").replace(/\s+/g, " ").trim();

/* Reduce a name to its consonant skeleton, so the transliteration spellings
   that differ between OSM and this dataset collapse together. Not a fuzzy
   score: two names either reduce to the same string or they do not.

   Order matters — the aspirated digraphs must go before vowels are stripped,
   or "Hooghly" keeps its h and never meets "Hugli".

     Hooghly / Hugli      -> hgl
     Purulia / Puruliya   -> prl     (y is a vowel here, not a consonant)
     Bardhaman / Barddhaman -> brdmn */
const fold = (s) => loose(s)
  .replace(/(gh|kh|bh|dh|th|jh|ch|ph)/g, (m) => m[0]) // aspirated → plain
  .replace(/[aeiouy]+/g, "")
  .replace(/([a-z])\1+/g, "$1")
  .replace(/\s+/g, "");

function looseFind(list, name) {
  if (!name) return null;
  const l = loose(name);
  const exact = list.find((x) => loose(x.name) === l);
  if (exact) return exact;
  const f = fold(name);
  if (!f) return null;
  const folded = list.filter((x) => fold(x.name) === f);
  /* Only accept a folded match when it is unambiguous — two candidates means
     we cannot tell, and guessing is exactly what this must not do. */
  return folded.length === 1 ? folded[0] : null;
}

/* Turn a reverse-geocode result into a confirmable suggestion.

   Returns null when nothing usable was found, otherwise
   { stateId, districtId, stateName, districtName, exact } where `exact` says
   whether both parts matched without folding — the UI can be more confident
   about an exact one. */
export function suggestFrom({ state, district, countryCode } = {}) {
  /* The dataset is India-only. A position abroad should suggest nothing rather
     than fold a foreign state name onto an Indian one. */
  if (countryCode && countryCode !== "IN") return null;

  const s = looseFind(STATES, state);
  if (!s) return null;
  const d = looseFind(DISTRICTS_BY_STATE.get(s.id) || [], district);

  /* `exact` means "both halves matched on the nose". A district that was
     reported but could not be resolved is NOT exact — the UI should be less
     confident about that suggestion, not more. */
  const askedForDistrict = !!loose(district);
  const exact = loose(s.name) === loose(state)
    && (askedForDistrict ? !!d && loose(d.name) === loose(district) : true);
  return {
    stateId: s.id, districtId: d?.id || "",
    stateName: s.name, districtName: d?.name || "",
    exact,
  };
}

/* Counts, for the dataset caveat the UI shows while verified is false. */
export const stats = () => ({
  states: STATES.length,
  districts: DISTRICT_BY_ID.size,
  verified: DATASET.verified,
  version: DATASET.version,
});
