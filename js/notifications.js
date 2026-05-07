/* ========================================
   PWSWORK - NOTIFICATIONS MODULE
   Browser Push Notifications + Sound
   ======================================== */

const Notifica = (() => {

    let _permission = 'default'; // 'granted', 'denied', 'default'
    let _enabled = true;
    let _audioCtx = null;

    // ==================== INIT ====================
    function init() {
        // Load user preference
        _enabled = localStorage.getItem('pws_notif_enabled') !== 'false';

        // Check current permission
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
                        // If it's a schedule notification with a date, open that day
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

    // ==================== REQUEST PERMISSION ====================
    async function requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }

        if (_permission === 'granted') return true;

        try {
            const result = await Notification.requestPermission();
            _permission = result;
            return result === 'granted';
        } catch (e) {
            console.error('Notification permission error:', e);
            return false;
        }
    }

    // ==================== SEND NOTIFICATION ====================
    // navData = { page: 'schedule'|'availabilities', date: '2026-05-10' }
    function send(title, body, tag, navData) {
        if (!_enabled) return;

        // Play sound regardless of permission (in-app)
        _playSound();

        // Show native notification
        if (_permission === 'granted') {
            _showNative(title, body, tag, navData);
        } else if (_permission === 'default') {
            requestPermission().then(granted => {
                if (granted) _showNative(title, body, tag, navData);
            });
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
            } else {
                const n = new Notification(title, {
                    body: body,
                    icon: './icons/icon-192.png',
                    tag: tag || 'pws-notif-' + Date.now()
                });
                n.onclick = () => {
                    window.focus();
                    if (navData && navData.page && typeof App !== 'undefined') {
                        App.navigateTo(navData.page);
                    }
                };
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

            // Two-tone chime (like a short messenger notification)
            const now = ctx.currentTime;

            // First tone
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

            // Second tone (higher)
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

        } catch (e) {
            // Silently fail (user hasn't interacted yet or AudioContext blocked)
        }
    }

    // ==================== ENABLE / DISABLE ====================
    function setEnabled(val) {
        _enabled = !!val;
        localStorage.setItem('pws_notif_enabled', _enabled ? 'true' : 'false');
    }

    function isEnabled() {
        return _enabled;
    }

    function getPermission() {
        return _permission;
    }

    return {
        init,
        requestPermission,
        send,
        setEnabled,
        isEnabled,
        getPermission
    };
})();
