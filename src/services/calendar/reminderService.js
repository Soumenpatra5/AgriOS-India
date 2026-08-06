import { storage } from "../../utils/storage.js";
import { notificationService } from "../notifications/notificationService.js";

const KEY = "cal:reminders";
const timers = new Map();

function getAll() {
  return storage.get(KEY, {});
}

function save(reminders) {
  storage.set(KEY, reminders);
}

function scheduleNotification(taskKey, label, fireAt) {
  const delay = fireAt - Date.now();
  if (delay <= 0) return;
  if (timers.has(taskKey)) clearTimeout(timers.get(taskKey));
  const id = setTimeout(() => {
    timers.delete(taskKey);
    if (notificationService.isEnabled()) {
      notificationService.dispatch("AgriOS Reminder", label);
    }
    const all = getAll();
    if (all[taskKey]) all[taskKey].fired = true;
    save(all);
  }, Math.min(delay, 2147483647));
  timers.set(taskKey, id);
}

export const reminderService = {
  set(taskKey, { label, dueDate, hoursBefore = 24 }) {
    const fire = new Date(dueDate);
    fire.setHours(fire.getHours() - hoursBefore);
    const fireAt = fire.getTime();
    const all = getAll();
    all[taskKey] = { label, dueDate, hoursBefore, fireAt, fired: false };
    save(all);
    scheduleNotification(taskKey, label, fireAt);
  },

  remove(taskKey) {
    if (timers.has(taskKey)) { clearTimeout(timers.get(taskKey)); timers.delete(taskKey); }
    const all = getAll();
    delete all[taskKey];
    save(all);
  },

  has(taskKey) {
    return !!getAll()[taskKey];
  },

  get(taskKey) {
    return getAll()[taskKey] || null;
  },

  boot() {
    const all = getAll();
    for (const [taskKey, r] of Object.entries(all)) {
      if (!r.fired && r.fireAt > Date.now()) {
        scheduleNotification(taskKey, r.label, r.fireAt);
      }
    }
  },

  count() {
    return Object.keys(getAll()).length;
  },

  clear() {
    for (const id of timers.keys()) clearTimeout(timers.get(id));
    timers.clear();
    storage.remove(KEY);
  },
};
