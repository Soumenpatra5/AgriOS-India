import { storage } from "./storage.js";

/* A small on-device ring buffer of the most recent runtime errors caught by
   the app's error boundaries. Purely local — nothing is sent anywhere — so a
   user (or support) can see what actually crashed instead of a blank screen. */

const KEY = "errorLog";
const MAX = 20;

export const errorLog = {
  all() {
    return storage.get(KEY, []);
  },

  record(error, info) {
    const entry = {
      message: String(error?.message || error || "Unknown error").slice(0, 300),
      stack: String(error?.stack || "").slice(0, 1200),
      component: String(info?.componentStack || "").slice(0, 600),
      url: typeof location !== "undefined" ? location.href : "",
      time: Date.now(),
    };
    storage.set(KEY, [entry, ...this.all()].slice(0, MAX));
  },

  count() {
    return this.all().length;
  },

  clear() {
    storage.remove(KEY);
  },
};
