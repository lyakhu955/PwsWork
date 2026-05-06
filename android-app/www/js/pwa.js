(() => {
  let deferredPrompt = null;
  let isInstalled = false;

  function canInstall() {
    return !!deferredPrompt && !isInstalled;
  }

  async function promptInstall() {
    if (!deferredPrompt || isInstalled) return { ok: false, reason: 'unavailable' };

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      deferredPrompt = null;
      return { ok: true };
    }

    return { ok: false, reason: 'dismissed' };
  }

  function getState() {
    if (isInstalled) return 'installed';
    if (deferredPrompt) return 'available';
    return 'unavailable';
  }

  window.PWAInstall = {
    canInstall,
    promptInstall,
    getState
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new CustomEvent('pwa-install-state'));
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-install-state'));
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./service-worker.js');
        console.log('✅ Service Worker registrato');
      } catch (error) {
        console.error('❌ Service Worker non registrato:', error);
      }
    });
  }
})();
