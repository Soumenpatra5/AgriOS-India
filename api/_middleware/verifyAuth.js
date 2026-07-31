/* Firebase ID token verification — keyless.

   Firebase ID tokens are RS256 JWTs signed by Google. Verifying one only
   requires Google's PUBLIC signing keys (JWKS) plus the project id — never a
   service-account private key. This avoids needing a service-account JSON key
   (which some Google Cloud org policies forbid creating) and drops the heavy
   firebase-admin dependency entirely.

   The project id is public; set FB_PROJECT_ID in Vercel (falls back to the
   VITE_FB_PROJECT_ID already used by the client build). */

import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function projectId() {
  return process.env.FB_PROJECT_ID || process.env.VITE_FB_PROJECT_ID || "";
}

export async function verifyToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const pid = projectId();
  if (!pid) {
    console.error("verifyToken: no project id (set FB_PROJECT_ID)");
    return null;
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: `https://securetoken.google.com/${pid}`,
      audience: pid,
    });
    // A valid Firebase ID token always carries a non-empty subject (uid).
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
