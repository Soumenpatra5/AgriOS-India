import { repo } from "./livestockDb.js";

export const ENTERPRISES = [
  { id: "poultry", label: "Poultry",    icon: "Bird",      emoji: "🐔", accent: "orange" },
  { id: "dairy",   label: "Dairy",      icon: "Milk",      emoji: "🐄", accent: "blue"   },
  { id: "goat",    label: "Goat",       icon: "Rabbit",    emoji: "🐐", accent: "primary"},
  { id: "pig",     label: "Pig",        icon: "PiggyBank", emoji: "🐖", accent: "red"    },
  { id: "sheep",   label: "Sheep",      icon: "Beef",      emoji: "🐑", accent: "blue"   },
  { id: "fish",    label: "Fish",       icon: "Fish",      emoji: "🐟", accent: "blue"   },
  { id: "bee",     label: "Beekeeping", icon: "Bug",       emoji: "🐝", accent: "yellow" },
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
