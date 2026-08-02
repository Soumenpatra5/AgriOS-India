import { fbEnabled } from "./config.js";
import { getAll, remove } from "./syncQueue.js";
import { repo as cloudRepo } from "./firestoreRepo.js";
import { pullFromCloud } from "./pullFromCloud.js";
import { migrateToFirestore } from "./migrate.js";
import { saveProfile } from "./userProfile.js";
import { fcmService } from "../notifications/fcmService.js";
import { preferences } from "../../customize/preferences.js";

let _initialized = false;

/* Respect the user's offline preference — "off" keeps data on-device only. */
function cloudSyncEnabled() {
  return preferences.get("offline.mode", "auto") !== "off";
}

async function flushQueue() {
  if (!fbEnabled || !cloudSyncEnabled()) return;
  const pending = await getAll();
  for (const entry of pending) {
    try {
      const r = cloudRepo(entry.storeName);
      if (entry.op === "add") await r.add(entry.data);
      else if (entry.op === "update") await r.update(entry.data.id, entry.data);
      else if (entry.op === "remove") await r.remove(entry.data.id);
      await remove(entry.id);
    } catch {}
  }
}

export function initSync() {
  if (_initialized || !fbEnabled) return;
  _initialized = true;
  window.addEventListener("online", () => flushQueue());
}

export async function onLogin(user) {
  if (!fbEnabled) return;
  saveProfile(user).catch(() => {});
  fcmService.requestToken()
    .then(() => fcmService.saveToken(user.uid))
    .catch(() => {});
  await pullFromCloud().catch(() => {});
  await migrateToFirestore().catch(() => {});
  await flushQueue().catch(() => {});
}

export function onLogout() {
  fcmService.deleteToken().catch(() => {});
}
