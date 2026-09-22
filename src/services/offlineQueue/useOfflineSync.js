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

  useEffect(() => {
    /* Reconnected — was offline, now online */
    if (!wasOnline.current && online) {
      setReplaying(true);
      replayQueue(farmCallFn)
        .then(result => {
          setLastReplay({ ...result, at: Date.now() });
          refreshCount();
        })
        .catch(() => {})
        .finally(() => setReplaying(false));
    }
    wasOnline.current = online;
  }, [online, farmCallFn, refreshCount]);

  return { pendingCount, replaying, lastReplay, refreshCount };
}
