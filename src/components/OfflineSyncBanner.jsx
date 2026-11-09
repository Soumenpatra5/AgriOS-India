/* Offline sync status banner.
 *
 * Shown at the top of the app when:
 *   - The device is offline AND there are queued writes (pendingCount > 0)
 *   - The queue is being replayed (replaying)
 *   - Offline writes exceeded retries or were rejected permanently (deadLetterCount > 0)
 *   - Replay just finished with errors (lastReplay?.failed > 0)
 *
 * Hidden when everything is up-to-date. */

import { useState, useEffect } from "react";
import { CloudOff, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { T } from "../theme/ThemeProvider.jsx";
import { useOnline, useApp } from "../store/AppStore.jsx";
import { useOfflineSync } from "../services/offlineQueue/useOfflineSync.js";

async function farmReplayCall(action, spaceId, payload) {
  try {
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
  } catch (err) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      err.reason = "offline";
    } else if (err?.name === "TypeError" || /failed to fetch|network|load failed/i.test(err?.message || "")) {
      err.reason = "offline";
    }
    throw err;
  }
}

export default function OfflineSyncBanner() {
  const online = useOnline();
  const app = useApp();
  const tc = app?.tc;
  const { pendingCount, deadLetterCount, dismissDeadLetters, replaying, lastReplay } = useOfflineSync(farmReplayCall, online);
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

  if (deadLetterCount > 0) {
    const label = tc
      ? tc({
          en: "offline write failed to sync",
          hi: "ऑफ़लाइन प्रविष्टि सिंक विफल",
          bn: "অফলাইন এন্ট্রি সিঙ্ক ব্যর্থ",
        })
      : "offline entry failed to sync";
    const dismissText = tc ? tc({ en: "Dismiss", hi: "खारिज करें", bn: "খারিজ করুন" }) : "Dismiss";

    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "6px 12px", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} />
          <span>{deadLetterCount} {label}</span>
        </div>
        <button
          type="button"
          onClick={dismissDeadLetters}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            color: "#fff",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {dismissText}
        </button>
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
