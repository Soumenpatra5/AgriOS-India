/* useOfflineSync — React hook that:
 *   1. Watches the online/offline event and the store's useOnline() hook.
 *   2. When going online after being offline, replays the queue.
 *   3. Exposes { pendingCount, replaying, lastReplay } for UI feedback.
 *
 * Mount once at the root (AppStore or ScreenRouter) — not in every screen. */

import { useState, useEffect, useRef, useCallback } from "react";
import { queueSize } from "./offlineQueueStore.js";
import { replayQueue } from "./offlineQueue.js";

export function useOfflineSync(farmCallFn, online) {
  const [pendingCount, setPendingCount] = useState(0);
  const [replaying, setReplaying]       = useState(false);
  const [lastReplay, setLastReplay]     = useState(null);
  const wasOnline = useRef(online);

  const refreshCount = useCallback(async () => {
    try { setPendingCount(await queueSize()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  const triggerReplay = useCallback(() => {
    setReplaying(true);
    replayQueue(farmCallFn)
      .then(result => {
        setLastReplay({ ...result, at: Date.now() });
        refreshCount();
      })
      .catch(() => {})
      .finally(() => setReplaying(false));
  }, [farmCallFn, refreshCount]);

  useEffect(() => {
    /* Reconnected — was offline, now online */
    if (!wasOnline.current && online) {
      triggerReplay();
    }
    wasOnline.current = online;
  }, [online, triggerReplay]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event) => {
      if (event?.data?.type === "TRIGGER_OFFLINE_SYNC") {
        triggerReplay();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [triggerReplay]);

  return { pendingCount, replaying, lastReplay, refreshCount };
}
