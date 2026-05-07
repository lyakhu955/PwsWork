// ==================== PWSWORK SERVICE WORKER ====================
// Combined: PWA Cache + Firebase Cloud Messaging

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ==================== FCM SETUP ====================
firebase.initializeApp({
    apiKey: "AIzaSyBji5aS5igcHbZCtQHz7Je6wbNzpDrAhPk",
    authDomain: "pwswo-6128f.firebaseapp.com",
    projectId: "pwswo-6128f",
    storageBucket: "pwswo-6128f.firebasestorage.app",
    messagingSenderId: "225349266473",
    appId: "1:225349266473:web:55c8a489670b49f53b0038"
});

const messaging = firebase.messaging();

// Handle background push messages (app closed or in background)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message:', payload);

    const notif = payload.notification || {};
    const data = payload.data || {};

    self.registration.showNotification(notif.title || 'PwsWork', {
        body: notif.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'pws-bg-' + Date.now(),
        renotify: true,
        data: { page: data.page || '', date: data.date || '' }
    });
});

// ==================== PWA CACHE ====================
const CACHE_NAME = 'pwswork-v58';

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
  './js/availabilities.js',
  './js/notifications.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Network-First Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', (event) => {
  const navData = event.notification.data || {};
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: navData });
          return;
        }
      }
      if (clients.openWindow) {
        let url = './';
        if (navData.page === 'schedule' && navData.date) {
          url = './?date=' + navData.date;
        } else if (navData.page) {
          url = './?page=' + navData.page;
        }
        return clients.openWindow(url);
      }
    })
  );
});
