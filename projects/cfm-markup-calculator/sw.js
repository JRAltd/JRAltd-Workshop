// Minimal service worker — enables "Install" in Chrome.
// No offline caching strategy yet; just a pass-through fetch handler,
// which satisfies installability requirements.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
