/**
 * Flow Finance — Service Worker v5
 * Estratégia: Cache-First para assets, Network-First para API calls e CSS
 */

const CACHE_NAME = 'flow-finance-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

console.log('[SW v5] Service Worker iniciando');

// ─── Message handler: force skip waiting ──────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW v5] SKIP_WAITING recebido - ativando imediatamente');
    self.skipWaiting();
  }
});

// ─── Install: pre-cache assets ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW v5] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v5] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW v5] Pre-cache falhou:', err);
        // Falha silenciosa — assets serão cacheados no primeiro fetch
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: limpar caches antigos ──────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: Cache-First para assets, Network-First para API ───────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests não-GET e chamadas externas (Firebase, Gemini)
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // Network-First para navegação/HTML para evitar prender index.html antigo.
  const isNavigation = request.mode === 'navigate';
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  const isCssRequest = url.pathname.endsWith('.css') || request.destination === 'style';
  
  // Network-First também para CSS para evitar estilos desatualizados
  if (isNavigation || acceptsHtml || isCssRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              if (isCssRequest) {
                cache.put(request, clone);
              } else {
                cache.put('/index.html', clone);
              }
            });
          }
          return response;
        })
        .catch(async () => {
          if (isCssRequest) {
            return (await caches.match(request)) || Response.error();
          }
          return (await caches.match('/index.html')) || Response.error();
        })
    );
    return;
  }

  // Network-First para .tsx/.ts (módulos ESM em dev)
  if (url.pathname.endsWith('.tsx') || url.pathname.endsWith('.ts')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-First para assets estáticos
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const contentType = response.headers.get('content-type') || '';
        const isScriptRequest = url.pathname.endsWith('.js') || request.destination === 'script';
        const isStyleRequest = url.pathname.endsWith('.css') || request.destination === 'style';
        const gotHtml = contentType.includes('text/html');

        // Never cache HTML as if it were JS/CSS. This avoids stale MIME errors
        // when a previous deploy/router served index.html for chunk paths.
        if ((isScriptRequest || isStyleRequest) && gotHtml) {
          return response;
        }

        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    }).catch(() => {
      // Fallback para index.html em caso de offline
      if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/index.html');
      }
      return Response.error();
    })
  );
});

// ─── Background sync placeholder ──────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'flow-sync') {
    console.log('[SW] Background sync: flow-sync');
  }
});
