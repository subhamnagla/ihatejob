// Service worker: makes the builder installable and usable with no network.
//
// The whole app is static and already runs without a server once loaded, so
// this only has to hold the shell. There is nothing user-specific in the cache
// - CVs live in localStorage and are never fetched - so a shared cache is safe.

const VERSION = 'ihatejob-v13';

const SHELL = [
  '/',
  '/app',
  '/app.html',
  '/css/app.css',
  '/css/cv.css',
  '/css/site.css',
  '/js/main.js',
  '/js/site.js',
  '/js/config.js',
  '/js/schema.js',
  '/js/form.js',
  '/js/templates.js',
  '/js/professions.js',
  '/js/samples.js',
  '/js/review.js',
  '/js/fixes.js',
  '/js/import.js',
  '/js/planets.js',
  '/js/pwa.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One bad URL must not fail the whole install, so add them individually.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch third parties

  // Navigations: serve from the network when it is there so a deploy is picked
  // up immediately, and fall back to the cached page when it is not.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(VERSION);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request)
          || await caches.match(url.pathname.startsWith('/app') ? '/app.html' : '/');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Icons never change without changing name, so serve them from cache.
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const res = await fetch(request);
      if (res && res.ok) (await caches.open(VERSION)).put(request, res.clone());
      return res;
    })());
    return;
  }

  // Code and styles go to the network first. Serving these from cache first
  // meant a deploy stayed invisible for a whole extra load - the live site
  // kept running an old config long after it had been replaced. Freshness
  // matters more here than the few milliseconds cache-first would save, and
  // the cached copy is still there the moment the network is not.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(request);
      return cached || Response.error();
    }
  })());
});
