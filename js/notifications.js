/* ========================================
   PWSWORK - NOTIFICATIONS MODULE
   FCM Push Notifications + Sound
   ======================================== */

const Notifica = (() => {

    let _permission = 'default';
    let _enabled = true;
    let _audioCtx = null;
    let _fcmToken = null;

    // ==================== INIT ====================
    function init() {
        _enabled = localStorage.getItem('pws_notif_enabled') !== 'false';

        if ('Notification' in window) {
            _permission = Notification.permission;
        }

        // Listen for messages from service worker (notification click)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                    const navData = event.data.data || {};
                    if (navData.page && typeof App !== 'undefined') {
                        App.navigateTo(navData.page);
                        if (navData.page === 'schedule' && navData.date) {
                            setTimeout(() => {
                                if (typeof Schedule !== 'undefined' && Schedule.openDetailModalByDate) {
                                    Schedule.openDetailModalByDate(navData.date, true);
                                }
                            }, 400);
                        }
                    }
                }
            });
        }
    }

    // ==================== REQUEST PERMISSION & REGISTER FCM ====================
    async function requestPermission() {
        if (!('Notification' in window)) return false;
        if (_permission === 'granted') {
            _registerFCM();
            return true;
        }

        try {
            const result = await Notification.requestPermission();
            _permission = result;
            if (result === 'granted') {
                _registerFCM();
            }
            return result === 'granted';
        } catch (e) {
            console.error('Notification permission error:', e);
            return false;
        }
    }

    // ==================== FCM TOKEN REGISTRATION ====================
    async function _registerFCM() {
        try {
            if (!firebase.messaging) {
                console.warn('Firebase Messaging SDK not loaded');
                return;
            }

            const messaging = firebase.messaging();

            // Wait for service worker to be fully ready
            const swReg = await navigator.serviceWorker.ready;

            // Ensure the SW is active (not just installing)
            if (!swReg.active) {
                console.log('⏳ Waiting for service worker to activate...');
                await new Promise(resolve => {
                    swReg.installing?.addEventListener('statechange', function handler(e) {
                        if (e.target.state === 'activated') {
                            e.target.removeEventListener('statechange', handler);
                            resolve();
                        }
                    });
                    // Timeout fallback
                    setTimeout(resolve, 3000);
                });
            }

            // Get FCM token
            const token = await messaging.getToken({
                vapidKey: _getVapidKey(),
                serviceWorkerRegistration: swReg
            });

            if (token) {
                _fcmToken = token;
                console.log('🔔 FCM Token obtained');
                await _saveTokenToFirestore(token);
            }

            // Handle foreground messages
            messaging.onMessage((payload) => {
                console.log('📩 FCM foreground message:', payload);
                const notif = payload.notification || {};
                const data = payload.data || {};
                send(notif.title || 'PwsWork', notif.body || '', data.tag, {
                    page: data.page,
                    date: data.date
                });
            });

        } catch (err) {
            console.error('FCM registration error:', err);
            // Retry once after a delay
            if (!_fcmToken) {
                setTimeout(() => {
                    console.log('🔄 Retrying FCM registration...');
                    _registerFCM();
                }, 5000);
            }
        }
    }

    function _getVapidKey() {
        return 'BLEi_VqOwIlN6yiQL_INh-0APS8rHga6NOwKt3RGQO7p0ImXt4vfvsyzFl8Yi_gPHeEw_ml5kCLGyy5M73xolCM';
    }

    async function _saveTokenToFirestore(token) {
        try {
            // Use a stable device ID based on the token hash
            const docId = 'device_' + _simpleHash(token);
            const currentUser = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;

            await db.collection('fcm_tokens').doc(docId).set({
                token: token,
                userId: currentUser ? currentUser.id : 'unknown',
                userName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'unknown',
                updatedAt: new Date().toISOString(),
                userAgent: navigator.userAgent.substring(0, 100)
            });
            console.log('✅ FCM token saved to Firestore');
        } catch (err) {
            console.error('Error saving FCM token:', err);
        }
    }

    function _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // ==================== SEND (in-app notification) ====================
    function send(title, body, tag, navData) {
        if (!_enabled) return;
        _playSound();

        if (_permission === 'granted') {
            _showNative(title, body, tag, navData);
        }
    }

    function _showNative(title, body, tag, navData) {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(title, {
                        body: body,
                        icon: './icons/icon-192.png',
                        badge: './icons/icon-192.png',
                        tag: tag || 'pws-notif-' + Date.now(),
                        vibrate: [200, 100, 200],
                        renotify: true,
                        data: navData || {}
                    });
                });
            }
        } catch (e) {
            console.warn('Notification error:', e);
        }
    }

    // ==================== NOTIFICATION SOUND ====================
    function _playSound() {
        try {
            if (!_audioCtx) {
                _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = _audioCtx;
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.value = 830;
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.value = 1100;
            gain2.gain.setValueAtTime(0.25, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.3);
        } catch (e) { /* silent */ }
    }

    // ==================== ENABLE / DISABLE ====================
    function setEnabled(val) {
        _enabled = !!val;
        localStorage.setItem('pws_notif_enabled', _enabled ? 'true' : 'false');
    }

    function isEnabled() { return _enabled; }
    function getPermission() { return _permission; }

    // Set VAPID key (called once after generating)
    function setVapidKey(key) {
        localStorage.setItem('pws_vapid_key', key);
    }

    return {
        init,
        requestPermission,
        send,
        setEnabled,
        isEnabled,
        getPermission,
        setVapidKey
    };
})();
