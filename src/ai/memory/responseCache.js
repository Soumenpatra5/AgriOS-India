/* Caches final AI answers for single-turn, tool-free knowledge questions.
   Two wins: instant offline replay of a previously-asked question, and fewer
   API calls for repeats. Deliberately NOT cached: multi-turn answers (depend on
   conversation history) and tool-using answers (depend on live weather/prices),
   so a replay can never show stale live data out of context. */

import { storage } from "../../utils/storage.js";

const KEY = "ai:respCache";
const MAX = 40;
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalize(text) {
  return (text || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function cacheKey(text, lang) {
  return `${lang}::${normalize(text)}`;
}

function load() {
  return storage.get(KEY, []);
}

function persist(entries) {
  storage.set(KEY, entries);
}

export const responseCache = {
  get(text, lang) {
    const k = cacheKey(text, lang);
    const now = Date.now();
    const entry = load().find((e) => e.k === k);
    if (!entry) return null;
    if (now - entry.ts > TTL) return null;
    return { text: entry.text, agentId: entry.agentId };
  },

  set(text, lang, answer, agentId) {
    if (!answer) return;
    const k = cacheKey(text, lang);
    const entries = load().filter((e) => e.k !== k);
    entries.push({ k, text: answer, agentId, ts: Date.now() });
    // Newest-first, cap to MAX (drops oldest).
    entries.sort((a, b) => b.ts - a.ts);
    persist(entries.slice(0, MAX));
  },

  count() {
    return load().length;
  },

  clear() {
    storage.remove(KEY);
  },
};
