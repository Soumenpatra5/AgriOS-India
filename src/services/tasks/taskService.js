/* Farm tasks — daily/weekly/monthly/recurring, priority, status, assignment.
   Completing a recurring task auto-creates the next occurrence. */

import { repo } from "../erp/erpDb.js";

export const PRIORITIES = [
  { id: "high",   label: "High", i18n: { en: "High", hi: "उच्च", bn: "উচ্চ" }   },
  { id: "medium", label: "Medium", i18n: { en: "Medium", hi: "मध्यम", bn: "মাঝারি" } },
  { id: "low",    label: "Low", i18n: { en: "Low", hi: "निम्न", bn: "নিম্ন" }    },
];

export const RECURRENCE = [
  { id: "",        label: "One-time", i18n: { en: "One-time", hi: "एक बार", bn: "একবার" } },
  { id: "daily",   label: "Daily", i18n: { en: "Daily", hi: "दैनिक", bn: "দৈনিক" }    },
  { id: "weekly",  label: "Weekly", i18n: { en: "Weekly", hi: "साप्ताहिक", bn: "সাপ্তাহিক" }   },
  { id: "monthly", label: "Monthly", i18n: { en: "Monthly", hi: "मासिक", bn: "মাসিক" }  },
];

const tasks = repo("tasks");
const todayStr = () => new Date().toISOString().slice(0, 10);

function nextDate(dateStr, recurrence) {
  const d = new Date(dateStr + "T12:00:00");
  if (recurrence === "daily")   d.setDate(d.getDate() + 1);
  if (recurrence === "weekly")  d.setDate(d.getDate() + 7);
  if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export const taskService = {
  add: (data) => tasks.add({ status: "open", ...data }),
  getAll: (farmId) => (farmId ? tasks.getBy("farmId", farmId) : tasks.getAll()),

  /* Tasks assigned to one employee (WF-4), newest due first. */
  forEmployee: (employeeId) => tasks.getAll()
    .then((all) => all.filter((t) => t.assigneeId === employeeId)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))),
  update: (id, patch) => tasks.update(id, patch),
  remove: (id) => tasks.remove(id),

  /* Mark done; recurring tasks spawn their next occurrence. */
  async complete(id) {
    const t = await tasks.getById(id);
    if (!t) return null;
    await tasks.update(id, { status: "done", completedAt: new Date().toISOString() });
    if (t.recurrence) {
      return tasks.add({
        title: t.title, note: t.note, priority: t.priority, farmId: t.farmId,
        assigneeId: t.assigneeId, recurrence: t.recurrence,
        dueDate: nextDate(t.dueDate || todayStr(), t.recurrence),
        status: "open",
      });
    }
    return null;
  },

  reopen: (id) => tasks.update(id, { status: "open", completedAt: null }),

  async buckets(farmId) {
    const all = (await this.getAll(farmId)).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const today = todayStr();
    const open = all.filter((t) => t.status !== "done");
    return {
      overdue:  open.filter((t) => t.dueDate && t.dueDate < today),
      today:    open.filter((t) => t.dueDate === today),
      upcoming: open.filter((t) => !t.dueDate || t.dueDate > today),
      done:     all.filter((t) => t.status === "done").reverse(),
    };
  },
};
