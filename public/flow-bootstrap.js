(function () {
  window.__FLOW_BOOTSTRAP_LOGS__ = window.__FLOW_BOOTSTRAP_LOGS__ || [];

  function pushBootstrapLog(level, message, data) {
    window.__FLOW_BOOTSTRAP_LOGS__.push({
      level,
      message,
      data,
      ts: new Date().toISOString(),
    });
  }

  var benchmarkParams = new URLSearchParams(window.location.search);
  var benchmarkMode =
    benchmarkParams.has('bench') ||
    benchmarkParams.has('benchmark') ||
    benchmarkParams.has('lh');

  if (benchmarkMode || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async function () {
    try {
      var cacheNames = await window.caches.keys();
      var oldCaches = cacheNames.filter(function (name) {
        return name.startsWith('flow-finance-') && !name.includes('-v5');
      });

      if (oldCaches.length > 0) {
        pushBootstrapLog('INFO', '[Flow] Limpando caches antigos', { oldCaches });
        await Promise.all(oldCaches.map(function (name) {
          return window.caches.delete(name);
        }));

        var registrations = await navigator.serviceWorker.getRegistrations();
        for (var registration of registrations) {
          await registration.unregister();
        }

        pushBootstrapLog('INFO', '[Flow] Cache limpo! Recarregando pagina...');
        return;
      }

      var reg = await navigator.serviceWorker.register('/sw.js');
      pushBootstrapLog('INFO', '[Flow] SW v5 registrado', { scope: reg.scope });

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.update();
    } catch (err) {
      pushBootstrapLog('WARN', '[Flow] SW error', { error: String(err) });
    }
  });
}());
