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
import { logError, logInfo, logWarn } from './src/utils/logger';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  if (isLocal && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => logInfo('[SW Guard] Service workers removidos em DEV'))
      .catch((err) => logWarn('[SW Guard] Falha ao remover SW em DEV', err, {
        fallback: 'sw-guard-unregister-failed',
      }));

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => logInfo('[SW Guard] Caches limpos em DEV'))
        .catch((err) => logWarn('[SW Guard] Falha ao limpar caches em DEV', err, {
          fallback: 'sw-guard-cache-cleanup-failed',
        }));
    }
  }
}

type WindowWithProcess = Window & {
  process?: {
    env: Record<string, string>;
  };
};

const windowWithProcess = window as WindowWithProcess;
windowWithProcess.process = windowWithProcess.process || { env: {} };

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
      logError('[App] Runtime guard initialization failed', error, {
        fallback: 'app-runtime-guard-initialization-failed',
      });
      // Continue anyway - some guards may still be active
    }
  } else {
    logInfo('[App] Benchmark mode enabled - runtime guards skipped');
  }

  // AI task queue initialization

  try {
    aiTaskQueue.initialize();
    logInfo('[App] AI Task Queue initialized');
  } catch (error) {
    logError('[App] AI Task Queue initialization failed', error, {
      fallback: 'app-ai-task-queue-initialization-failed',
    });
    // Non-critical - app can run without task queue
  }

  try {
    initializeFinancialEventPipeline();
    logInfo('[App] Financial Event Pipeline initialized');
  } catch (error) {
    logError('[App] Financial Event Pipeline initialization failed', error, {
      fallback: 'app-financial-event-pipeline-initialization-failed',
    });
  }

  try {
    registerEventListeners();
  } catch (error) {
    logError('[App] Event listeners registration failed', error, {
      fallback: 'app-event-listeners-registration-failed',
    });
  }

  // Version log

  logInfo('[Flow Finance] bootstrap version banner', {
    version: '0.6.3',
    mode: import.meta.env.MODE,
    features: ['event-listeners', 'cache', 'observability'],
  });

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
                  logInfo('[SW] New version available, reload recommended');
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
  logError('[App] Fatal initialization error', error, {
    fallback: 'app-fatal-initialization-error',
  });
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


