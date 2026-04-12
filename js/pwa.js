(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
      console.log('✅ Service Worker registrato');
    } catch (error) {
      console.error('❌ Service Worker non registrato:', error);
    }
  });
})();
