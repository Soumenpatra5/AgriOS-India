import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/* Lazily initialize the Admin SDK. If credentials are missing or invalid,
   we swallow the error here so a misconfiguration returns a clean 401
   from verifyToken() instead of crashing the whole serverless function
   (FUNCTION_INVOCATION_FAILED) at module load. */
let initError = null;

function ensureApp() {
  if (getApps().length) return true;
  const { FB_PROJECT_ID, FB_CLIENT_EMAIL, FB_PRIVATE_KEY } = process.env;
  if (!FB_PROJECT_ID || !FB_CLIENT_EMAIL || !FB_PRIVATE_KEY) {
    initError = "Firebase Admin credentials are not configured (FB_PROJECT_ID / FB_CLIENT_EMAIL / FB_PRIVATE_KEY).";
    return false;
  }
  try {
    initializeApp({
      credential: cert({
        projectId:   FB_PROJECT_ID,
        clientEmail: FB_CLIENT_EMAIL,
        privateKey:  FB_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    return true;
  } catch (err) {
    initError = `Firebase Admin init failed: ${err.message}`;
    return false;
  }
}

export async function verifyToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  if (!ensureApp()) {
    console.error(initError);
    return null;
  }
  try {
    return await getAuth().verifyIdToken(header.slice(7));
  } catch {
    return null;
  }
}
