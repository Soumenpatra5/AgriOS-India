import { getMessagingInstance, fbEnabled, auth, db } from "../firebase/config.js";
import { storage } from "../../utils/storage.js";

const TOKEN_KEY = "fcm:token";
const TOPICS_KEY = "fcm:topics";

const DEFAULT_TOPICS = {
  order_updates: true,
  weather_alerts: true,
  price_changes: true,
};

export const fcmService = {
  async init(onForeground) {
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    const { onMessage } = await import("firebase/messaging");
    onMessage(messaging, (payload) => {
      if (onForeground) onForeground(payload);
    });
  },

  async requestToken() {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;
    try {
      const { getToken } = await import("firebase/messaging");
      const sw = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_FB_VAPID_KEY;
      const token = await getToken(messaging, {
        vapidKey: vapidKey || undefined,
        serviceWorkerRegistration: sw,
      });
      if (token) storage.set(TOKEN_KEY, token);
      return token;
    } catch { return null; }
  },

  async saveToken(uid) {
    if (!fbEnabled || !uid) return;
    const token = storage.get(TOKEN_KEY);
    if (!token) return;
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users", uid, "fcmTokens", token), {
        token,
        createdAt: new Date().toISOString(),
        platform: "web",
      });
    } catch {}
  },

  async deleteToken() {
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    try {
      const { deleteToken } = await import("firebase/messaging");
      await deleteToken(messaging);
    } catch {}
    storage.remove(TOKEN_KEY);
  },

  getTopicPrefs() {
    return storage.get(TOPICS_KEY, DEFAULT_TOPICS);
  },

  async setTopicPref(topic, on) {
    const prefs = this.getTopicPrefs();
    prefs[topic] = on;
    storage.set(TOPICS_KEY, prefs);
    if (!fbEnabled || !auth?.currentUser) return;
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { notificationPrefs: prefs },
        { merge: true }
      );
    } catch {}
  },
};
