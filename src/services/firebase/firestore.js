/* Firestore initialization, split out of config.js so the ~600kB Firestore SDK
   stays off the initial render path. Only lazily-loaded modules (firestoreRepo,
   prefsSync, fcmService, migrate, userProfile) import this. */
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { app, fbEnabled } from "./config.js";

let db = null;

if (fbEnabled && app) {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    db = getFirestore(app);
  }
}

export { db };
