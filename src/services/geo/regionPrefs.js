/* The farmer's own region, in preferences.

   Three screens write this — Onboarding, Farm details and Personalize — so the
   read/write pair lives here rather than being re-implemented in each. That is
   also what makes the migration invisible: every reader goes through
   readRegion(), so a record still holding only free text is upgraded the first
   time anything looks at it.

   BOTH shapes are kept. `stateId`/`districtId` are the structured truth;
   `state`/`district` remain the denormalised display names, because the
   scheme eligibility engine matches on text and is not part of this change.
   Dropping the names would have broken it. */

import { preferences } from "../../customize/preferences.js";
import { getState, getDistrict, upgradeLegacy, DEFAULT_COUNTRY_ID } from "./geoService.js";

/* Read the region, upgrading legacy text to ids on the way out.

   Returns { countryId, stateId, districtId, stateName, districtName, review }.
   `review` means text was present that could not be matched — the caller can
   surface it; nothing is discarded either way. */
export function readRegion() {
  const stateId = preferences.get("region.stateId", "");
  const districtId = preferences.get("region.districtId", "");
  const stateName = preferences.get("region.state", "");
  const districtName = preferences.get("region.district", "");

  /* Already structured: trust the ids, but re-derive the names so a rename in
     the dataset shows through instead of displaying a stale label. */
  if (stateId) {
    const s = getState(stateId);
    const d = getDistrict(districtId);
    return {
      countryId: preferences.get("region.countryId", DEFAULT_COUNTRY_ID),
      stateId: s?.id || "",
      /* Guard the pair on read as well as on write: a district that no longer
         belongs to the state (dataset change, hand-edited storage) is dropped
         rather than shown as a valid selection. */
      districtId: d && d.stateId === s?.id ? d.id : "",
      stateName: s?.name || stateName,
      districtName: (d && d.stateId === s?.id ? d.name : "") || "",
      review: false,
    };
  }

  /* Legacy free text, or nothing at all. */
  return upgradeLegacy({ state: stateName, district: districtName });
}

/* Persist a selection. Writes ids and names together so the two never drift. */
export function writeRegion({ stateId = "", districtId = "" } = {}) {
  const s = getState(stateId);
  const d = getDistrict(districtId);
  const districtValid = d && s && d.stateId === s.id;

  preferences.set("region.countryId", DEFAULT_COUNTRY_ID);
  preferences.set("region.stateId", s?.id || "");
  preferences.set("region.districtId", districtValid ? d.id : "");
  preferences.set("region.state", s?.name || "");
  preferences.set("region.district", districtValid ? d.name : "");

  return { stateId: s?.id || "", districtId: districtValid ? d.id : "" };
}

/* "Jhargram, West Bengal" — the one-line form the AI profile memory stores. */
export function regionLabel(region = readRegion()) {
  return [region.districtName, region.stateName].filter(Boolean).join(", ");
}
