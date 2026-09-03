/* Minting a Firebase custom token, and resolving which account it is for.

   This is the join between the WhatsApp flow and the app's existing identity.
   After a code is verified the browser still has no Firebase session, and
   everything downstream — onAuthStateChanged, getIdToken, verifyAuth, the Farm
   Space gate, every protected endpoint — is built on one. signInWithCustomToken
   produces exactly that, so the rest of the app needs no changes at all.

   A custom token is an RS256 JWT signed by a service account. There are two
   ways to produce that signature, and this file prefers the one where no
   private key exists:

   1. WORKLOAD IDENTITY FEDERATION (preferred). Vercel issues a short-lived
      OIDC token proving which project and environment is running. Google
      exchanges it for an access token, then signs the JWT on its own side via
      the IAM Credentials API. No key is ever created, stored or rotated.

      This is not merely tidier. Google now blocks service-account key creation
      by default — the project hit exactly that — and points at federation as
      the alternative. Fighting that default would have meant turning off a
      protection across the whole organisation.

   2. A LOCAL PRIVATE KEY, if FB_PRIVATE_KEY happens to be set. Kept as a
      fallback for environments where federation is not available, and because
      it makes the signing path testable without a network. */

import { SignJWT, importPKCS8 } from "jose";
import { HttpError } from "../http.js";

const AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
const STS = "https://sts.googleapis.com/v1/token";
const IAM_CREDENTIALS = "https://iamcredentials.googleapis.com/v1";
const CLOUD_PLATFORM = "https://www.googleapis.com/auth/cloud-platform";

const env = (k) => process.env[k] || "";

/* Which signer is available. Federation first: if both are configured, the
   keyless path is the one that runs. */
export function signingMode() {
  const wif = env("GCP_PROJECT_NUMBER") && env("GCP_WORKLOAD_IDENTITY_POOL_ID")
    && env("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID") && env("GCP_SERVICE_ACCOUNT_EMAIL");
  if (wif) return "federation";
  if (env("FB_CLIENT_EMAIL") && env("FB_PRIVATE_KEY")) return "private-key";
  return null;
}

export function customTokenConfigured() {
  return signingMode() !== null;
}

/* ── federation ───────────────────────────────────────────────────────────── */

/* Vercel injects a fresh OIDC token per invocation once federation is enabled
   on the project. Its absence means the project setting is off, which is a
   configuration problem rather than a runtime one. */
function vercelOidcToken() {
  const token = env("VERCEL_OIDC_TOKEN");
  if (!token) {
    throw new HttpError(503, "Phone sign-in is not configured on this server.");
  }
  return token;
}

/* Trade Vercel's proof-of-identity for a Google access token. The audience
   names the pool and provider, which is what ties this exchange to the trust
   relationship configured in GCP — a token from any other Vercel project does
   not match it. */
async function federatedAccessToken() {
  const audience = "//iam.googleapis.com/projects/" + env("GCP_PROJECT_NUMBER")
    + "/locations/global/workloadIdentityPools/" + env("GCP_WORKLOAD_IDENTITY_POOL_ID")
    + "/providers/" + env("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID");

  const res = await fetch(STS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audience,
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      scope: CLOUD_PLATFORM,
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      subjectToken: vercelOidcToken(),
    }),
  });

  if (!res.ok) {
    /* Google's reply names the pool, the provider and often the subject —
       useful in a log, not something to hand to whoever is signing in. */
    console.error("otp_wif_exchange_failed", res.status, (await res.text()).slice(0, 300));
    throw new HttpError(503, "Phone sign-in is not configured on this server.");
  }
  return (await res.json()).access_token;
}

/* Ask Google to sign the token. The claims are the same either way; only who
   holds the key differs. */
async function signViaFederation(claims) {
  const accessToken = await federatedAccessToken();
  const sa = env("GCP_SERVICE_ACCOUNT_EMAIL");

  const res = await fetch(`${IAM_CREDENTIALS}/projects/-/serviceAccounts/${encodeURIComponent(sa)}:signJwt`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ payload: JSON.stringify(claims) }),
  });

  if (!res.ok) {
    console.error("otp_wif_sign_failed", res.status, (await res.text()).slice(0, 300));
    throw new HttpError(503, "Phone sign-in is not configured on this server.");
  }
  return (await res.json()).signedJwt;
}

/* ── local key (fallback) ─────────────────────────────────────────────────── */

/* Vercel stores multi-line values with literal \n, and pasting a PEM through a
   web form mangles it in exactly that way. Repairing it here is the difference
   between a working deploy and an hour lost to an opaque key error. */
function privateKeyPem() {
  const raw = env("FB_PRIVATE_KEY");
  if (!raw) throw new HttpError(503, "Phone sign-in is not configured on this server.");
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

async function signLocally(claims) {
  const key = await importPKCS8(privateKeyPem(), "RS256");
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .sign(key);
}

/* ── the token ────────────────────────────────────────────────────────────── */

/* Firebase caps custom tokens at one hour; they are exchanged for a real
   session immediately, so a short life costs nothing and limits the damage if
   one is intercepted in transit. */
export async function mintCustomToken(uid, claims = {}) {
  const mode = signingMode();
  if (!mode) throw new HttpError(503, "Phone sign-in is not configured on this server.");

  const issuer = mode === "federation" ? env("GCP_SERVICE_ACCOUNT_EMAIL") : env("FB_CLIENT_EMAIL");
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: issuer,
    sub: issuer,
    aud: AUD,
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  };

  return mode === "federation" ? signViaFederation(payload) : signLocally(payload);
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
