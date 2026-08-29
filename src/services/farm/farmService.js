/* Farm profiles — multiple farms with one "active" farm that scopes new
   ERP records. Active farm id lives in localStorage; farm rows in IndexedDB. */

import { repo } from "../erp/erpDb.js";
import { storage } from "../../utils/storage.js";

const ACTIVE_KEY = "erp:activeFarmId";

export const FARM_TYPES = [
  { id: "mixed",     label: "Mixed Farming", i18n: { en: "Mixed Farming", hi: "मिश्रित खेती", bn: "মিশ্র চাষ" }   },
  { id: "crop",      label: "Crop Farm", i18n: { en: "Crop Farm", hi: "फ़सल फार्म", bn: "ফসল খামার" }       },
  { id: "dairy",     label: "Dairy Farm", i18n: { en: "Dairy Farm", hi: "डेयरी फार्म", bn: "ডেয়ারি খামার" }      },
  { id: "poultry",   label: "Poultry Farm", i18n: { en: "Poultry Farm", hi: "मुर्गी फार्म", bn: "হাঁস-মুরগি খামার" }    },
  { id: "aqua",      label: "Fish / Aqua", i18n: { en: "Fish / Aqua", hi: "मछली / जलकृषि", bn: "মাছ / মৎস্যচাষ" }     },
  { id: "goatery",   label: "Goatery", i18n: { en: "Goatery", hi: "बकरी पालन", bn: "ছাগল পালন" }         },
  { id: "piggery",   label: "Piggery", i18n: { en: "Piggery", hi: "सूअर पालन", bn: "শূকর পালন" }         },
  { id: "apiary",    label: "Apiary (Bees)", i18n: { en: "Apiary (Bees)", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" }   },
  { id: "orchard",   label: "Orchard / Horti", i18n: { en: "Orchard / Horti", hi: "बाग / बागवानी", bn: "বাগান / উদ্যান" } },
];

const farms = repo("farms");

/* ERP stores that carry a `farmId` index and therefore belong to a farm.
   When a farm is deleted these children are soft-deleted too, so nothing is
   left orphaned pointing at a farm that no longer exists. Soft-delete keeps
   them recoverable if the farm is later restored. */
const CHILD_STORES = ["parcels", "tasks", "inventory", "assets", "employees", "devices", "cropPlans", "feedBatches"];

async function cascadeSoftDelete(farmId) {
  await Promise.all(CHILD_STORES.map(async (name) => {
    const r = repo(name);
    const children = await r.getBy("farmId", farmId);
    await Promise.all(children.map((c) => r.remove(c.id)));
  }));
}

/* Farm rows predating the structured location hold free-text state/district.
   Upgrading them once, lazily, means every reader gets ids without each
   caller having to know that legacy rows exist.

   Only exact matches are written; anything ambiguous keeps its text and stays
   without ids, because a silently wrong district on a farm profile would flow
   straight into the DPR and the scheme engine. */
/* Loaded on demand: the district dataset is only needed to upgrade legacy
   rows, which happens once and never on the first-paint path. */
const geo = () => import("../geo/geoService.js");

const GEO_FLAG = "erp:farms:geoUpgraded:v1";
let _geoUpgrade = null;

function upgradeGeoOnce() {
  if (_geoUpgrade) return _geoUpgrade;
  _geoUpgrade = (async () => {
    if (storage.get(GEO_FLAG)) return { skipped: true };
    let upgraded = 0, review = 0;
    for (const f of await farms.getAll()) {
      if (f.stateId || (!f.state && !f.district)) continue;
      const g = (await geo()).upgradeLegacy({ state: f.state, district: f.district });
      if (g.stateId) {
        await farms.update(f.id, {
          stateId: g.stateId, districtId: g.districtId,
          state: g.stateName, district: g.districtName,
        });
        upgraded++;
      }
      if (g.review) review++;
    }
    storage.set(GEO_FLAG, true);
    return { upgraded, review };
  })();
  return _geoUpgrade;
}

/* Tests only — replay the migration. */
export function _resetGeoUpgradeForTests() { _geoUpgrade = null; }

export const farmService = {
  add:    (data) => farms.add(data),
  async getAll() { await upgradeGeoOnce(); return farms.getAll(); },
  getById:(id)   => farms.getById(id),
  update: (id, patch) => farms.update(id, patch),
  remove: async (id) => {
    await cascadeSoftDelete(id);
    await farms.remove(id);
    if (storage.get(ACTIVE_KEY) === id) storage.remove(ACTIVE_KEY);
  },
  count:  ()     => farms.count(),

  getActiveId: () => storage.get(ACTIVE_KEY, null),
  setActive:   (id) => storage.set(ACTIVE_KEY, id),

  /* Active farm record, or first farm, or null. */
  async getActive() {
    const all = await farms.getAll();
    if (!all.length) return null;
    const id = storage.get(ACTIVE_KEY, null);
    return all.find((f) => f.id === id) || all[0];
  },

  typeLabel: (id) => FARM_TYPES.find((t) => t.id === id)?.label ?? id,
  /* The {en,hi,bn} object for a farm type, for callers that can translate.
     Falls back to the English label so an unknown id still renders. */
  typeI18n: (id) => {
    const t = FARM_TYPES.find((x) => x.id === id);
    return t?.i18n ?? { en: t?.label ?? id, hi: t?.label ?? id, bn: t?.label ?? id };
  },
};
