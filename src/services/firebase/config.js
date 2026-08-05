import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY,
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MSG_SENDER_ID,
  appId:             import.meta.env.VITE_FB_APP_ID,
};

export const fbEnabled = !!firebaseConfig.apiKey;

let app = null;
let auth = null;

if (fbEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

/* Firestore (`db`) lives in ./firestore.js so the Firestore SDK loads lazily —
   see that file. Import `db` from there, not here. */
export { app, auth };

let _messaging = null;
export async function getMessagingInstance() {
  if (!fbEnabled) return null;
  if (_messaging) return _messaging;
  try {
    const { isSupported, getMessaging } = await import("firebase/messaging");
    if (!(await isSupported())) return null;
    _messaging = getMessaging(app);
    return _messaging;
  } catch { return null; }
}
