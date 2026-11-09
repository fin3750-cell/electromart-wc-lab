// sw.js: the service worker that lets the app install and work offline.
//
// A service worker is a small script the browser keeps running in the
// background for this site. It sees every request the page makes.
//
// Strategy: network first. Each request goes to the network, so every change
// you merge shows up. A copy of each answer is saved in a cache. If the
// network can't be reached (you're offline), the saved copy is used instead.
//
// Every path here is relative, because the site lives at
// https://<username>.github.io/<repository>/, not at the root of a domain.

const CACHE = 'electromart-ccc-v1';

// Saved when the app is installed, so it works offline even before you've
// opened every file once.
const FILES = [
  './',
  'index.html',
  'styles.css',
  'ccc.js',
  'app.js',
  'manifest.webmanifest',
  'data/electromart.csv',
  'data/assumptions.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting()), // use the new service worker right away
  );
});

self.addEventListener('activate', event => {
  // Delete caches from older versions of this service worker.
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  // Only handle this site's own files. (The app makes no other requests.)
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event));
});

async function networkFirst(event) {
  const request = event.request;
  try {
    // 'no-cache' makes the browser check with the server instead of reusing
    // its own short-term copy, so a merged change shows up sooner.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  } catch (err) {
    // Offline: use the saved copy.
    const saved = await caches.match(request, { ignoreSearch: true });
    if (saved) return saved;
    if (request.mode === 'navigate') {
      const page = (await caches.match('./')) || (await caches.match('index.html'));
      if (page) return page;
    }
    return Response.error();
  }
}
