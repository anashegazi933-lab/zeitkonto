/* Zeitkonto Service Worker — Offline-Fähigkeit.
   Strategie: App-Dateien network-first (Updates kommen sofort an, offline aus dem Cache),
   Schriften cache-first. */
const VERSION = 'zeitkonto-v2';
const CORE = ['./', 'index.html', 'logic.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Google Fonts: cache-first (ändern sich praktisch nie)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(VERSION).then((c) =>
        c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
          c.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Eigene Dateien: network-first mit Cache-Fallback
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html')))
    );
  }
});
