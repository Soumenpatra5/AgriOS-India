/* AgriOS service worker — cache-first shell + FCM background push. */

/* Firebase compat SDK for background messaging.
   Config is hardcoded because service workers cannot use import.meta.env.
   These are public client keys (same values visible in the built JS bundle). */
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyAa0Yj3COzXCMiOng3A6zNfJFyFhEnbjBU",
    projectId: "agrios-india",
    messagingSenderId: "300426325400",
    appId: "1:300426325400:web:43cd4ac90b3a117e798fed",
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

const CACHE = "agrios-v1";
const SHELL = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
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
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).pathname.startsWith("/api/")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const live = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
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
