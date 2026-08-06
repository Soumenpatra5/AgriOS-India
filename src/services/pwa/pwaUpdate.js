/* Service-worker update coordinator.

   Registers the SW and detects when a *new* version has installed and is
   waiting. The UI subscribes via onUpdateAvailable() and calls applyUpdate()
   when the user opts in — which tells the waiting worker to skipWaiting and
   reloads once it takes control.

   First-install activation also fires `controllerchange` (our SW claims
   clients), so we only reload when the user explicitly applied an update. */

let waitingWorker = null;
let userInitiated = false;
let refreshing = false;
const listeners = new Set();

function notify() {
  for (const cb of listeners) { try { cb(); } catch { /* ignore */ } }
}

export function onUpdateAvailable(cb) {
  listeners.add(cb);
  if (waitingWorker) cb();
  return () => listeners.delete(cb);
}

export function isUpdateAvailable() {
  return !!waitingWorker;
}

export function applyUpdate() {
  userInitiated = true;
  if (waitingWorker) {
    waitingWorker.postMessage("SKIP_WAITING");
  } else {
    location.reload();
  }
}

export function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // A build deployed while the app was closed may already be waiting.
      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        notify();
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // "installed" with an existing controller == an update (not first run).
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker = installing;
            notify();
          }
        });
      });
    }).catch(() => { /* SW unsupported or blocked — app still works */ });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!userInitiated || refreshing) return;
      refreshing = true;
      location.reload();
    });
  });
}
