/* The AgriOS User ID — a permanent, human-shareable identifier, kept
   deliberately separate from the Firebase UID that remains the internal
   identity everywhere else in the app. See supabase/migrations/
   0007_agrios_user_id.sql for the full rationale.

   Format: AGRI- followed by 8 characters from the Crockford Base32 alphabet
   (0-9, A-Z minus I/L/O/U) — chosen so a farmer reading one aloud, or typing
   it back in, never has to guess whether a character was a zero or a letter
   O. The database's unique constraint is what actually guarantees no two
   users share one; this alphabet and length just make a collision
   astronomically unlikely (32^8 ≈ 1.1 trillion combinations) so the
   retry-on-conflict path in ensureUser is a formality, not something
   expected to ever really run. */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SHAPE = /^AGRI-[0-9A-HJKMNP-TV-Z]{8}$/;

/* Web Crypto, not Node's `crypto` module — deliberately, matching
   newInviteToken() below in spaces.js. This file is only ever meant to run
   server-side, but api/_lib/farm/tasks.js is imported directly by
   FarmSpaceTasks.jsx for allowedTransitions(), which drags gate.js and
   ensureUser.js along into the client bundle too (dead code there, never
   called) — a Node-only import anywhere in that chain breaks the browser
   build. globalThis.crypto.getRandomValues exists in both. 256 divides
   evenly by the 32-symbol alphabet, so `% 32` on a random byte is uniform
   with no modulo bias to worry about. */
export function generateAgriosUserId() {
  const bytes = new Uint8Array(8);
  (globalThis.crypto ?? {}).getRandomValues?.(bytes);
  let id = "AGRI-";
  for (let i = 0; i < 8; i++) id += ALPHABET[bytes[i] % ALPHABET.length];
  return id;
}

/* What a person types back — lowercase, stray spaces, a copy-pasted "agri-"
   in either case — is not the canonical stored form. Normalized the same way
   phone numbers are elsewhere in this app: one canonical form, one boundary
   conversion, so a lookup either matches exactly or is told plainly that it
   does not, rather than silently failing on a case mismatch. */
export function normalizeAgriosUserId(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  const withPrefix = cleaned.startsWith("AGRI-") ? cleaned : `AGRI-${cleaned}`;
  return SHAPE.test(withPrefix) ? withPrefix : null;
}
