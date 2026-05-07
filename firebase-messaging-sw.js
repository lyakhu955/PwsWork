// Firebase Cloud Messaging Service Worker
// This file MUST be named firebase-messaging-sw.js and be at the root

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBji5aS5igcHbZCtQHz7Je6wbNzpDrAhPk",
    authDomain: "pwswo-6128f.firebaseapp.com",
    projectId: "pwswo-6128f",
    storageBucket: "pwswo-6128f.firebasestorage.app",
    messagingSenderId: "225349266473",
    appId: "1:225349266473:web:55c8a489670b49f53b0038"
});

const messaging = firebase.messaging();

// Handle background messages (app is closed or in background)
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message:', payload);

    const notif = payload.notification || {};
    const data = payload.data || {};

    const title = notif.title || 'PwsWork';
    const options = {
        body: notif.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'pws-bg-' + Date.now(),
        renotify: true,
        data: {
            page: data.page || '',
            date: data.date || ''
        }
    };

    self.registration.showNotification(title, options);
});

// Handle notification click
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
