import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth, fbEnabled } from "./config.js";

function profileRef() {
  if (!fbEnabled || !auth?.currentUser) return null;
  return doc(db, "users", auth.currentUser.uid, "profile", "main");
}

export async function saveProfile(userData) {
  const ref = profileRef();
  if (!ref) return null;
  const data = {
    ...userData,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, data, { merge: true });
  return data;
}

export async function getProfile() {
  const ref = profileRef();
  if (!ref) return null;
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
