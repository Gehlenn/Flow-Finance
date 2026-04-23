import React from 'react';
import { createRoot } from 'react-dom/client';
import AppWithAnalytics from './AppWithAnalytics';
import './src/styles/tailwind.css';
import { initializeRuntimeGuard } from './src/runtime/runtimeGuard';
import { isBenchmarkBrowserSession } from './src/runtime/benchmarkMode';
import { aiTaskQueue } from './src/ai/queue';
import { initializeFinancialEventPipeline } from './src/events/financialEventPipeline';
import { registerEventListeners } from './src/events/listeners/registerListeners';
import { AIControlPanel } from './src/debug/aiPanel/AIControlPanel';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  if (isLocal && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => console.info('[SW Guard] Service workers removidos em DEV'))
      .catch((err) => console.warn('[SW Guard] Falha ao remover SW em DEV', err));

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => console.info('[SW Guard] Caches limpos em DEV'))
        .catch((err) => console.warn('[SW Guard] Falha ao limpar caches em DEV', err));
    }
  }
}

(window as any).process = (window as any).process || { env: {} };

// Runtime guard initialization

async function initializeApp() {
  const benchmarkMode = isBenchmarkBrowserSession();

  // Initialize runtime protection before rendering
  if (!benchmarkMode) {
    try {
      await initializeRuntimeGuard({
        apiHealthCheckInterval: 60000, // 1 min
        versionCheckInterval: 300000, // 5 min
        enableChunkRetry: true,
        enableAutoReload: true,
      });
    } catch (error) {
      console.error('[App] Runtime guard initialization failed:', error);
      // Continue anyway - some guards may still be active
    }
  } else {
    console.info('[App] Benchmark mode enabled - runtime guards skipped');
  }

  // AI task queue initialization

  try {
    aiTaskQueue.initialize();
    console.log('[App] AI Task Queue initialized');
  } catch (error) {
    console.error('[App] AI Task Queue initialization failed:', error);
    // Non-critical - app can run without task queue
  }

  try {
    initializeFinancialEventPipeline();
    console.log('[App] Financial Event Pipeline initialized');
  } catch (error) {
    console.error('[App] Financial Event Pipeline initialization failed:', error);
  }

  try {
    registerEventListeners();
  } catch (error) {
    console.error('[App] Event listeners registration failed:', error);
  }

  // Version log

  console.info(
    `%c[Flow Finance] v0.6.3 | ${import.meta.env.MODE} | event-listeners + cache + observability`,
    'color: #34d399; font-weight: bold;'
  );

  // Service worker auto-update

  if (!benchmarkMode && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // Force service worker update on load
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          reg.update();
          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New version available, reload recommended');
                  // Optionally notify user or auto-reload after delay
                }
              });
            }
          });
        });
      });
    });
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = createRoot(rootElement);

  const debugPanelEnabled = Boolean(import.meta.env.VITE_AI_DEBUG_PANEL);
  const isAIDebugRoute = typeof window !== 'undefined' && window.location.pathname === '/ai-debug';

  if (debugPanelEnabled && isAIDebugRoute) {
    root.render(
      <React.StrictMode>
        <AIControlPanel />
      </React.StrictMode>
    );
    return;
  }

  root.render(
    <React.StrictMode>
      <AppWithAnalytics />
    </React.StrictMode>
  );
}

// Start app initialization
initializeApp().catch((error) => {
  console.error('[App] Fatal initialization error:', error);
  document.body.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: system-ui, sans-serif;
      color: white;
      text-align: center;
      padding: 20px;
    ">
      <div>
        <h1 style="font-size: 32px; margin-bottom: 16px;">Erro ao Inicializar</h1>
        <p style="font-size: 16px; margin-bottom: 24px; opacity: 0.9;">Não foi possível carregar a aplicação</p>
        <button 
          onclick="window.location.reload()"
          style="
            background: white;
            color: #667eea;
            border: none;
            padding: 12px 32px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
          "
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  `;
});


