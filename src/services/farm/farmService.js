/* Farm profiles — multiple farms with one "active" farm that scopes new
   ERP records. Active farm id lives in localStorage; farm rows in IndexedDB. */

import { repo } from "../erp/erpDb.js";
import { storage } from "../../utils/storage.js";

const ACTIVE_KEY = "erp:activeFarmId";

export const FARM_TYPES = [
  { id: "mixed",     label: "Mixed Farming"   },
  { id: "crop",      label: "Crop Farm"       },
  { id: "dairy",     label: "Dairy Farm"      },
  { id: "poultry",   label: "Poultry Farm"    },
  { id: "aqua",      label: "Fish / Aqua"     },
  { id: "goatery",   label: "Goatery"         },
  { id: "piggery",   label: "Piggery"         },
  { id: "apiary",    label: "Apiary (Bees)"   },
  { id: "orchard",   label: "Orchard / Horti" },
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

export const farmService = {
  add:    (data) => farms.add(data),
  getAll: ()     => farms.getAll(),
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
};
