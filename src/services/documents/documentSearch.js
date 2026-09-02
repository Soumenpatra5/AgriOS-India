/* Search, filter and sort over a document list (brief §15).

   Pure functions over an already-loaded array rather than queries against the
   store: the whole point of §32 is that the list screen loads metadata only
   and never touches a file, and a farmer's document list is tens of rows, not
   thousands. Keeping it in memory means filtering is instant and works
   offline, with no index to maintain.

   Matching is deliberately forgiving. A farmer searching for a land record may
   type the plot number, part of the file name, or the category — all three
   should find it. */

import { categoryOf, expiryState } from "./documentService.js";

export const SORTS = ["recent", "oldest", "title", "expiry"];

/* Normalise for comparison: case-insensitive, and tolerant of the extra
   whitespace that creeps in on a phone keyboard. */
const norm = (v) => String(v ?? "").toLowerCase().trim();

/* Every field a query should be able to hit, including the category's name in
   all three languages — someone searching "জমি" should find a land record even
   though the stored category id is "land". */
function haystack(d) {
  const cat = categoryOf(d.category);
  return [
    d.title, d.note, d.number, d.fileName, d.category,
    cat.i18n?.en, cat.i18n?.hi, cat.i18n?.bn,
  ].map(norm).join(" ");
}

export function matches(d, query) {
  const q = norm(query);
  if (!q) return true;
  const hay = haystack(d);
  /* Every word must appear somewhere, in any order — "42 land" and "land 42"
     both find the same record. */
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/* filters:
     query      free text
     category   category id, or "" for all
     group      taxonomy group ("banking", "contracts"…), or ""
     expiry     "" | "expired" | "expiring_soon" | "valid" | "none"
     status     "" | "uploaded" | "verified"
     hasFile    null | true | false
     sort       one of SORTS                                              */
export function filterDocuments(list, filters = {}) {
  const {
    query = "", category = "", group = "", expiry = "",
    status = "", hasFile = null, sort = "recent",
  } = filters;

  let out = (list || []).filter((d) => !d.deletedAt);

  if (query) out = out.filter((d) => matches(d, query));
  if (category) out = out.filter((d) => d.category === category);
  if (group) out = out.filter((d) => categoryOf(d.category).group === group);
  if (status) out = out.filter((d) => (d.status || "uploaded") === status);
  if (hasFile !== null) out = out.filter((d) => !!(d.fileKey || d.fileUrl || d.fileData) === hasFile);

  if (expiry === "none") out = out.filter((d) => !d.expiryDate);
  else if (expiry) out = out.filter((d) => d.expiryDate && expiryState(d) === expiry);

  const by = {
    recent: (a, b) => norm(b.uploadDate).localeCompare(norm(a.uploadDate)),
    oldest: (a, b) => norm(a.uploadDate).localeCompare(norm(b.uploadDate)),
    title:  (a, b) => norm(a.title).localeCompare(norm(b.title)),
    /* Soonest expiry first, because that is the one needing attention.
       Records with no expiry sort last rather than first. */
    expiry: (a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    },
  };
  return out.sort(by[sort] || by.recent);
}

/* Counts for the filter chips, so the UI can say how many are expiring
   without running the filter five times. */
export function facets(list) {
  const live = (list || []).filter((d) => !d.deletedAt);
  const count = (fn) => live.filter(fn).length;
  return {
    total: live.length,
    withFile: count((d) => !!(d.fileKey || d.fileUrl || d.fileData)),
    expired: count((d) => d.expiryDate && expiryState(d) === "expired"),
    expiringSoon: count((d) => d.expiryDate && expiryState(d) === "expiring_soon"),
    verified: count((d) => d.status === "verified"),
  };
}
