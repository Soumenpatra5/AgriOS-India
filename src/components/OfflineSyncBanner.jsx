/* Offline sync status banner.
 *
 * Shown at the top of the app when:
 *   - The device is offline AND there are queued writes (pendingCount > 0)
 *   - The queue is being replayed (replaying)
 *   - Replay just finished with errors (lastReplay?.failed > 0)
 *
 * Hidden when everything is up-to-date. */

import { useState, useEffect } from "react";
import { CloudOff, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { T } from "../theme/ThemeProvider.jsx";
import { useOnline } from "../store/AppStore.jsx";
import { useOfflineSync } from "../services/offlineQueue/useOfflineSync.js";

async function farmReplayCall(action, spaceId, payload) {
  const { authFetch } = await import("../services/firebase/authFetch.js");
  const res = await authFetch("/api/farm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, spaceId, payload }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Replay failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
}

export default function OfflineSyncBanner() {
  const online = useOnline();
  const { pendingCount, replaying, lastReplay } = useOfflineSync(farmReplayCall, online);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (lastReplay?.replayed > 0 && lastReplay.failed === 0) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastReplay]);

  if (replaying) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 12px", background: T.primary, color: "#fff", fontSize: 12, fontWeight: 600 }}>
        <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
        Syncing {lastReplay ? "" : "queued"} records…
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 12px", background: "#22c55e", color: "#fff", fontSize: 12, fontWeight: 600 }}>
        <CheckCircle size={13} />
        {lastReplay?.replayed} record{lastReplay?.replayed !== 1 ? "s" : ""} synced
      </div>
    );
  }

  if (!online && pendingCount > 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 12px", background: "#6b7280", color: "#fff", fontSize: 12, fontWeight: 600 }}>
        <CloudOff size={13} />
        Offline · {pendingCount} record{pendingCount !== 1 ? "s" : ""} pending sync
      </div>
    );
  }

  if (lastReplay?.failed > 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 12px", background: "#f97316", color: "#fff", fontSize: 12, fontWeight: 600 }}>
        <AlertTriangle size={13} />
        {lastReplay.failed} record{lastReplay.failed !== 1 ? "s" : ""} failed to sync — will retry
      </div>
    );
  }

  return null;
}
