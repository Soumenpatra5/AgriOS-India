import { useEffect, useRef } from "react";

/* Near-real-time for Farm Space, by polling.

   There is no realtime infrastructure in this app — `onSnapshot` appears
   nowhere — and adding a socket layer for one feature would be a large amount
   of machinery for a farm where a task assignment arriving in eight seconds
   instead of one changes nothing. Polling is the honest answer for now;
   Supabase Realtime is the upgrade path and needs no data-model change.

   What makes it acceptable rather than wasteful:

   - It stops while the tab is hidden. A phone in a pocket must not spend the
     farmer's data and battery asking a server for news nobody is reading.
   - It fires immediately on becoming visible again, so returning to the app
     shows current state rather than waiting out the interval.
   - Ticks never overlap. On a slow rural connection a request can outlast the
     interval, and without this the queue grows faster than it drains.
   - It is silent: a failed poll leaves the last good data on screen. A farmer
     reading yesterday's messages does not need a red banner every ten seconds
     because a bus went through a tunnel. */
export function useFarmPoll(fn, { intervalMs = 15000, enabled = true } = {}) {
  /* Held in a ref so a caller passing an inline arrow — which every caller
     does — does not restart the timer on every render. */
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    let stopped = false;
    let inFlight = false;
    let timer = null;

    const tick = async () => {
      if (stopped || inFlight) return;
      if (typeof document !== "undefined" && document.hidden) return;
      inFlight = true;
      try { await fnRef.current?.(); }
      catch { /* silent by design — see the note above */ }
      finally { inFlight = false; }
    };

    const onVisible = () => { if (!document.hidden) tick(); };

    timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [intervalMs, enabled]);
}
