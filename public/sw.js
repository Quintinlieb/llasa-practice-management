// Minimal service worker to satisfy installability requirements.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await self.caches.keys();
      await Promise.all(cacheNames.map((cacheName) => self.caches.delete(cacheName)));
      await self.clients.claim();
    })(),
  );
});

// No caching implemented; the app remains online-only by design.
