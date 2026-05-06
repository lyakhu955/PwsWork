const CACHE_NAME = 'pwswork-v53';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/components.css',
  './css/animations.css',
  './js/firebase-config.js',
  './js/storage.js',
  './js/theme.js',
  './js/crypto.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/employees.js',
  './js/schedule.js',
  './js/profile.js',
  './js/absences.js',
  './js/hours.js',
  './js/whatsapp.js',
  './js/ai-import.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the new service worker to take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim()) // Take control of all open pages immediately
  );
});

// Network-First Strategy (Aggiornamento in tempo reale)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Se la rete risponde correttamente, aggiorniamo la cache con l'ultima versione
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        // Se siamo offline o la rete fallisce, peschiamo dalla cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
