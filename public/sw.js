// Service worker: makes the builder installable and usable with no network.
//
// The whole app is static and already runs without a server once loaded, so
// this only has to hold the shell. There is nothing user-specific in the cache
// - CVs live in localStorage and are never fetched - so a shared cache is safe.

const VERSION = 'ihatejob-v1';

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

  // Everything else: serve the cached copy at once, refresh it in the
  // background, so the app opens instantly and still updates itself.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(request, res.clone()));
      return res;
    }).catch(() => null);
    return cached || network || Response.error();
  })());
});
