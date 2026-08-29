/* Crop calendar service — registers crops and generates agronomic task timelines.
   All data stays on-device under the cal: prefix.
   Crop instance: {id, cropId, sowingDate (YYYY-MM-DD), areaAcres, fieldName} */

import { storage } from "../../utils/storage.js";

const CROPS_KEY = "cal:crops";
const DONE_KEY  = "cal:done";

/* ── Task type descriptors ───────────────────────────────────────────────── */
const SOW  = { id: "sow",        label: "Sow / Plant",     icon: "Sprout"       };
const NUR  = { id: "nursery",    label: "Nursery prep",    icon: "Sprout"       };
const TRA  = { id: "transplant", label: "Transplant",      icon: "Sprout"       };
const IRR  = { id: "irrigation", label: "Irrigation",      icon: "Droplets"     };
const FER  = { id: "fertilizer", label: "Fertilizer",      icon: "FlaskConical" };
const SPR  = { id: "spray",      label: "Spray",           icon: "SprayCan"     };
const WED  = { id: "weeding",    label: "Weeding",         icon: "Leaf"         };
const THN  = { id: "thinning",   label: "Thinning",        icon: "Leaf"         };
const EAR  = { id: "earthing",   label: "Earthing up",     icon: "Tractor"      };
const STA  = { id: "staking",    label: "Staking",         icon: "Wrench"       };
const HAR  = { id: "harvest",    label: "Harvest",         icon: "Wheat"        };

/* ── Crop definitions with agronomic task schedules (offsets from sowing) ── */
/* name and season stay English — they go into AI prompts and are the
   canonical crop key. i18n/seasonI18n are what the UI shows. */
export const CROPS = [
  {
    id: "paddy", name: "Paddy", icon: "Wheat", season: "Kharif", i18n: { en: "Paddy", hi: "धान", bn: "ধান" }, seasonI18n: { en: "Kharif", hi: "खरीफ़", bn: "খরিফ" }, days: 120,
    tasks: [
      { type: NUR, day: 0 },
      { type: TRA, day: 21 },
      { type: WED, day: 35 },
      { type: FER, day: 40,  note: "1st dose — N" },
      { type: IRR, day: 45 },
      { type: FER, day: 60,  note: "2nd dose — N:K" },
      { type: SPR, day: 70,  note: "Blast fungicide" },
      { type: HAR, day: 120 },
    ],
  },
  {
    id: "wheat", name: "Wheat", icon: "Wheat", season: "Rabi", i18n: { en: "Wheat", hi: "गेहूँ", bn: "গম" }, seasonI18n: { en: "Rabi", hi: "रबी", bn: "রবি" }, days: 120,
    tasks: [
      { type: IRR, day: 21,  note: "Crown root irrigation" },
      { type: FER, day: 21,  note: "1st dose — Urea" },
      { type: IRR, day: 42 },
      { type: SPR, day: 45,  note: "Tillering — herbicide" },
      { type: FER, day: 60,  note: "2nd dose — Urea" },
      { type: IRR, day: 60 },
      { type: HAR, day: 120 },
    ],
  },
  {
    id: "maize", name: "Maize", icon: "Sprout", season: "Kharif", i18n: { en: "Maize", hi: "मक्का", bn: "ভুট্টা" }, seasonI18n: { en: "Kharif", hi: "खरीफ़", bn: "খরিফ" }, days: 90,
    tasks: [
      { type: THN, day: 15 },
      { type: FER, day: 25,  note: "1st dose" },
      { type: WED, day: 30 },
      { type: FER, day: 45,  note: "Top dress" },
      { type: IRR, day: 50,  note: "Tasseling stage" },
      { type: HAR, day: 90 },
    ],
  },
  {
    id: "cotton", name: "Cotton", icon: "Leaf", season: "Kharif", i18n: { en: "Cotton", hi: "कपास", bn: "তুলা" }, seasonI18n: { en: "Kharif", hi: "खरीफ़", bn: "খরিফ" }, days: 180,
    tasks: [
      { type: THN, day: 20 },
      { type: SPR, day: 30,  note: "1st insecticide" },
      { type: FER, day: 35,  note: "1st dose" },
      { type: SPR, day: 60,  note: "2nd insecticide" },
      { type: FER, day: 60,  note: "2nd dose" },
      { type: SPR, day: 90,  note: "Bollworm check" },
      { type: HAR, day: 180 },
    ],
  },
  {
    id: "mustard", name: "Mustard", icon: "Sprout", season: "Rabi", i18n: { en: "Mustard", hi: "सरसों", bn: "সরিষা" }, seasonI18n: { en: "Rabi", hi: "रबी", bn: "রবি" }, days: 100,
    tasks: [
      { type: THN, day: 15 },
      { type: IRR, day: 30,  note: "1st irrigation" },
      { type: FER, day: 35,  note: "Top dress — Urea" },
      { type: IRR, day: 50,  note: "2nd irrigation" },
      { type: SPR, day: 55,  note: "Aphid control" },
      { type: HAR, day: 100 },
    ],
  },
  {
    id: "soybean", name: "Soybean", icon: "Sprout", season: "Kharif", i18n: { en: "Soybean", hi: "सोयाबीन", bn: "সয়াবিন" }, seasonI18n: { en: "Kharif", hi: "खरीफ़", bn: "খরিফ" }, days: 100,
    tasks: [
      { type: WED, day: 20 },
      { type: FER, day: 30,  note: "Micro-nutrient spray" },
      { type: SPR, day: 30,  note: "Stem fly control" },
      { type: SPR, day: 60,  note: "Pod borer" },
      { type: HAR, day: 100 },
    ],
  },
  {
    id: "potato", name: "Potato", icon: "Sprout", season: "Rabi", i18n: { en: "Potato", hi: "आलू", bn: "আলু" }, seasonI18n: { en: "Rabi", hi: "रबी", bn: "রবি" }, days: 90,
    tasks: [
      { type: EAR, day: 25 },
      { type: IRR, day: 25 },
      { type: FER, day: 30,  note: "Top dress — K" },
      { type: EAR, day: 45 },
      { type: SPR, day: 50,  note: "Late blight" },
      { type: HAR, day: 90 },
    ],
  },
  {
    id: "tomato", name: "Tomato", icon: "Sprout", season: "Rabi", i18n: { en: "Tomato", hi: "टमाटर", bn: "টমেটো" }, seasonI18n: { en: "Rabi", hi: "रबी", bn: "রবি" }, days: 90,
    tasks: [
      { type: STA, day: 20 },
      { type: FER, day: 21,  note: "1st dose" },
      { type: IRR, day: 25 },
      { type: SPR, day: 30,  note: "Early blight" },
      { type: FER, day: 45,  note: "2nd dose" },
      { type: HAR, day: 60 },
    ],
  },
];

/* ── Service ─────────────────────────────────────────────────────────────── */
export const cropCalendarService = {
  all() {
    return storage.get(CROPS_KEY, []);
  },

  add({ cropId, sowingDate, areaAcres, fieldName }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    storage.set(CROPS_KEY, [...this.all(), { id, cropId, sowingDate, areaAcres, fieldName }]);
    return id;
  },

  remove(id) {
    storage.set(CROPS_KEY, this.all().filter((c) => c.id !== id));
    const done = storage.get(DONE_KEY, {});
    Object.keys(done).filter((k) => k.startsWith(id + ":")).forEach((k) => delete done[k]);
    storage.set(DONE_KEY, done);
  },

  cropDef(cropId) {
    return CROPS.find((c) => c.id === cropId) || null;
  },

  tasksForCrop(instance) {
    const def = this.cropDef(instance.cropId);
    if (!def) return [];
    const base = new Date(instance.sowingDate);
    return def.tasks.map((t, i) => {
      const due = new Date(base);
      due.setDate(due.getDate() + t.day);
      const taskKey = `${instance.id}:${i}`;
      return {
        taskKey,
        cropInstanceId: instance.id,
        cropName: def.name,
        cropIcon: def.icon,
        type: t.type,
        note: t.note || "",
        dueDate: due.toISOString().slice(0, 10),
        done: this.isDone(taskKey),
      };
    });
  },

  allTasks() {
    return this.all()
      .flatMap((inst) => this.tasksForCrop(inst))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },

  upcomingTasks(days = 7) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end   = new Date(today); end.setDate(end.getDate() + days);
    return this.allTasks().filter((t) => {
      if (t.done) return false;
      const d = new Date(t.dueDate);
      return d >= today && d <= end;
    });
  },

  overdueTasks() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.allTasks().filter((t) => !t.done && new Date(t.dueDate) < today);
  },

  markDone(taskKey) {
    const done = storage.get(DONE_KEY, {});
    done[taskKey] = true;
    storage.set(DONE_KEY, done);
  },

  markUndone(taskKey) {
    const done = storage.get(DONE_KEY, {});
    delete done[taskKey];
    storage.set(DONE_KEY, done);
  },

  isDone(taskKey) {
    return !!(storage.get(DONE_KEY, {})[taskKey]);
  },
};
