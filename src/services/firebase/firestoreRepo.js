import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db, auth, fbEnabled } from "./config.js";

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function userCol(storeName) {
  if (!fbEnabled || !auth || !auth.currentUser) return null;
  return collection(db, "users", auth.currentUser.uid, storeName);
}

export function repo(storeName) {
  return {
    async add(data) {
      const col = userCol(storeName);
      if (!col) return null;
      const id = data.id || uid();
      const record = { ...data, id, createdAt: new Date().toISOString() };
      await setDoc(doc(col, id), record);
      return record;
    },

    async getAll() {
      const col = userCol(storeName);
      if (!col) return [];
      const snap = await getDocs(col);
      return snap.docs.map((d) => d.data());
    },

    async getBy(field, value) {
      const col = userCol(storeName);
      if (!col) return [];
      const q = query(col, where(field, "==", value));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    },

    async getById(id) {
      const col = userCol(storeName);
      if (!col) return null;
      const snap = await getDoc(doc(col, id));
      return snap.exists() ? snap.data() : null;
    },

    async update(id, patch) {
      const col = userCol(storeName);
      if (!col) return null;
      const ref = doc(col, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const updated = {
        ...snap.data(),
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(ref, updated);
      return updated;
    },

    async remove(id) {
      const col = userCol(storeName);
      if (!col) return;
      await deleteDoc(doc(col, id));
    },

    async count() {
      const col = userCol(storeName);
      if (!col) return 0;
      const snap = await getDocs(col);
      return snap.size;
    },
  };
}
