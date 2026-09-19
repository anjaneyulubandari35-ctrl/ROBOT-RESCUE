// ============================================================
//  SERVICE WORKER - offline install + cache-first asset serving
//  Bump CACHE_NAME whenever any cached file changes so returning
//  players actually get the new version instead of a stale cache.
// ============================================================
const CACHE_NAME = 'robot-rescue-v3';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './perf.js',
  './script.js',
  './audio.js',
  './entities.js',
  './levels.js',
  './renderer.js',
  './game-themes.js',
  './game.js',
  './mobile-controls.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', (event) => {
  // cache.addAll() aborts the whole install if a single request fails
  // (e.g. the CDN is briefly unreachable) — cache each asset independently
  // instead, so a hiccup on one file doesn't leave the game with no
  // offline cache at all.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(ASSETS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for game assets (so it works fully offline once installed),
// falling back to the network for anything not pre-cached, and falling
// back to the cached index.html for navigations if the network is down.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && event.request.url.startsWith(self.location.origin)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
