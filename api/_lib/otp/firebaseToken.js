/* Minting a Firebase custom token, and resolving which account it is for.

   This is the join between the WhatsApp flow and the app's existing identity.
   After a code is verified the browser still has no Firebase session, and
   everything downstream — onAuthStateChanged, getIdToken, verifyAuth, the Farm
   Space gate, every protected endpoint — is built on one. signInWithCustomToken
   produces exactly that, so the rest of the app needs no changes at all.

   A custom token is an RS256 JWT signed with a service-account private key.
   There is no keyless route: api/_middleware/verifyAuth.js verifies tokens with
   Google's PUBLIC keys, which is why it needs no secret, but minting requires
   the private half. That is a deliberate, approved reversal of the earlier
   no-service-account decision.

   Signed with jose, already a dependency — firebase-admin would pull in a large
   tree to do this one thing. */

import { SignJWT, importPKCS8 } from "jose";
import { HttpError } from "../http.js";

const AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

/* Vercel stores multi-line values with literal \n, and pasting a PEM through a
   web form mangles it in exactly that way. Repairing it here is the difference
   between a working deploy and an hour lost to an opaque key error. */
function privateKeyPem() {
  const raw = process.env.FB_PRIVATE_KEY;
  if (!raw) throw new HttpError(503, "Phone sign-in is not configured on this server.");
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

function clientEmail() {
  const email = process.env.FB_CLIENT_EMAIL;
  if (!email) throw new HttpError(503, "Phone sign-in is not configured on this server.");
  return email;
}

export function customTokenConfigured() {
  return !!(process.env.FB_CLIENT_EMAIL && process.env.FB_PRIVATE_KEY);
}

/* Firebase caps custom tokens at one hour; they are exchanged for a real
   session immediately, so a short life costs nothing and limits the damage if
   one is intercepted in transit. */
export async function mintCustomToken(uid, claims = {}) {
  const key = await importPKCS8(privateKeyPem(), "RS256");
  const email = clientEmail();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ uid, claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience(AUD)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

/* Which Firebase account does this phone belong to?

   The whole point of the brief's account-linking requirement. A farmer who
   signed up with Google and later signs in by WhatsApp must land in the SAME
   AgriOS account, not a second one — so this looks the number up against the
   mirror of Firebase identities that ensureUser maintains, and reuses the uid
   it finds.

   Phone is compared in the canonical ten-digit form, which is how ensureUser
   writes it and how Farm Space invitations match. */
export async function resolveUidForPhone(sql, phone) {
  const [existing] = await sql`
    select firebase_uid from users where phone = ${phone} limit 1`;
  if (existing) return { uid: existing.firebase_uid, isNew: false };

  /* No account yet. A deterministic uid keeps this idempotent: two requests
     racing on a first sign-in produce the same uid rather than two accounts,
     and a retry after a failed hand-off lands on the same identity. The prefix
     records how the account was created, which is useful when someone asks why
     a uid does not look like a Google one. */
  return { uid: `phone:91${phone}`, isNew: true };
}
