import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, fbEnabled } from "./config.js";
import { db } from "./firestore.js";

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
      /* updateDoc is one round trip where the old read-modify-write
         (getDoc + full setDoc) was two — and its behavior on a missing doc
         is BETTER, not just cheaper: it throws, which lands the patch in the
         caller's enqueue-and-retry path (see syncRepo.pushToCloud) instead
         of silently returning null and dropping the change forever. The
         only caller is the fire-and-forget sync mirror, which ignores the
         return value. */
      const stamped = { ...patch, updatedAt: new Date().toISOString() };
      await updateDoc(doc(col, id), stamped);
      return stamped;
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
