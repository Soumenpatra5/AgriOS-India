/* AgriOS service worker — cache-first shell + FCM background push. */

/* Firebase compat SDK for background messaging.
   Config is hardcoded because service workers cannot use import.meta.env.
   These are public client keys (same values visible in the built JS bundle). */
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyBCJ1r7pqvJpqDiVgfjELMeBczwibuiBjU",
    projectId: "agrios-india-app",
    messagingSenderId: "210172538656",
    appId: "1:210172538656:web:78ea1ec1a032ac35a2f145",
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notif = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(notif.title || "AgriOS", {
      body: notif.body || "",
      tag: data.category || "agrios",
      icon: "/icon-192.png",
      badge: "/icon.svg",
      data: { url: data.url || "/" },
    });
  });
} catch {
  /* Firebase SDK unavailable — fall back to plain push handler below */
}

const CACHE = "agrios-v3";
/* Core shell precached at install so the app launches offline on first run. */
const SHELL = [
  "/", "/index.html", "/manifest.json",
  "/icon-192.png", "/icon-512.png", "/icon.svg", "/favicon.png", "/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  // Do NOT skipWaiting here — the new worker waits so the app can prompt the
  // user, then activates on demand via the SKIP_WAITING message below.
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never touch API calls or cross-origin requests (CDNs, weather/price feeds).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // SPA navigations: network-first, fall back to the cached app shell when
  // offline so the app always boots even on a route that was never visited.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put("/index.html", res.clone())).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html").then((c) => c || caches.match("/")))
    );
    return;
  }

  // Static assets (hashed JS/CSS, icons): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const live = fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || live;
    })
  );
});

/* Fallback push handler for non-FCM pushes */
self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const { title, body, tag = "agrios" } = e.data.json();
    e.waitUntil(
      self.registration.showNotification(title, { body, tag, icon: "/icon-192.png" })
    );
  } catch { /* malformed push payload */ }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
