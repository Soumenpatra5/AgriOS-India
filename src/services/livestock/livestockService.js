import { repo } from "./livestockDb.js";

/* label stays English — it is the canonical name used in records, reports and
   aggregation keys. i18n is what the UI shows. */
export const ENTERPRISES = [
  { id: "poultry", label: "Poultry",    icon: "Bird",      emoji: "🐔", accent: "orange",  i18n: { en: "Poultry",    hi: "मुर्गी पालन",   bn: "হাঁস-মুরগি"  } },
  { id: "dairy",   label: "Dairy",      icon: "Milk",      emoji: "🐄", accent: "blue",    i18n: { en: "Dairy",      hi: "डेयरी",         bn: "ডেয়ারি"      } },
  { id: "goat",    label: "Goat",       icon: "Rabbit",    emoji: "🐐", accent: "primary", i18n: { en: "Goat",       hi: "बकरी",          bn: "ছাগল"        } },
  { id: "pig",     label: "Pig",        icon: "PiggyBank", emoji: "🐖", accent: "red",     i18n: { en: "Pig",        hi: "सूअर",          bn: "শূকর"        } },
  { id: "sheep",   label: "Sheep",      icon: "Beef",      emoji: "🐑", accent: "blue",    i18n: { en: "Sheep",      hi: "भेड़",           bn: "ভেড়া"       } },
  { id: "fish",    label: "Fish",       icon: "Fish",      emoji: "🐟", accent: "blue",    i18n: { en: "Fish",       hi: "मछली",          bn: "মাছ"         } },
  { id: "bee",     label: "Beekeeping", icon: "Bug",       emoji: "🐝", accent: "yellow",  i18n: { en: "Beekeeping", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" } },
];

const animalsRepo     = repo("animals");
const productionsRepo = repo("productions");
const eventsRepo      = repo("events");

/* ── ANIMALS ──────────────────────────────────────────────────────────────── */

export const animalService = {
  add:     (data)      => animalsRepo.add(data),
  getAll:  (enterprise) => enterprise ? animalsRepo.getBy("enterprise", enterprise) : animalsRepo.getAll(),
  getById: (id)        => animalsRepo.getById(id),
  update:  (id, patch) => animalsRepo.update(id, patch),
  remove:  (id)        => animalsRepo.remove(id),
  async count(enterprise) { return (await this.getAll(enterprise)).length; },
};

/* ── PRODUCTION RECORDS ───────────────────────────────────────────────────── */

export const productionService = {
  add: (data) => productionsRepo.add(data),

  async getForEnterprise(enterprise, limit = 90) {
    const list = await productionsRepo.getBy("enterprise", enterprise);
    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  },

  async getForAnimal(animalId) {
    const list = await productionsRepo.getBy("animalId", animalId);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  },

  remove: (id) => productionsRepo.remove(id),
};

/* ── EVENTS (vaccinations, treatments, harvests, breeding) ───────────────── */

export const eventService = {
  add: (data) => eventsRepo.add(data),

  async getForEnterprise(enterprise) {
    const list = await eventsRepo.getBy("enterprise", enterprise);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  },

  async getUpcoming(enterprise, days = 30) {
    const all = await this.getForEnterprise(enterprise);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + days);
    return all.filter((e) => {
      if (!e.dueDate) return false;
      const d = new Date(e.dueDate);
      return d >= today && d <= cutoff;
    });
  },

  remove: (id) => eventsRepo.remove(id),
};
