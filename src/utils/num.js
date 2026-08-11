/* Shared numeric helpers for the financial / agri calculation services
   (feed, crop planner). Previously copy-defined in ~7 modules.

   safeNum: coerce to a finite, POSITIVE number — negatives, NaN and
   non-numeric input all become 0, so a bad keystroke can never corrupt a
   total or produce a negative quantity.
   round2: round to 2 decimals, finite-guarded — for money/quantity values
   that must not accumulate floating-point drift. */

export function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function round2(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : 0;
}
