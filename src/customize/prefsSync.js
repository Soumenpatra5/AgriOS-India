/* Cloud sync for user preferences — mirrors the prefs tree to the signed-in
   user's Firestore doc so a new device restores everything on sign-in.
   No-ops gracefully when Firebase isn't configured or nobody is signed in. */

import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, fbEnabled } from "../services/firebase/config.js";
import { db } from "../services/firebase/firestore.js";

function prefsRef() {
  if (!fbEnabled || !auth?.currentUser) return null;
  return doc(db, "users", auth.currentUser.uid, "settings", "prefs");
}

export async function savePrefsCloud(prefs) {
  const ref = prefsRef();
  if (!ref) return;
  try { await setDoc(ref, { data: prefs, updatedAt: new Date().toISOString() }, { merge: true }); }
  catch { /* offline / permission — local copy remains the source */ }
}

export async function loadPrefsCloud() {
  const ref = prefsRef();
  if (!ref) return null;
  try { const snap = await getDoc(ref); return snap.exists() ? snap.data().data : null; }
  catch { return null; }
}
