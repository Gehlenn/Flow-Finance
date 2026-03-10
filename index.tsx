import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './src/styles/tailwind.css';
import { initializeRuntimeGuard } from './src/runtime/runtimeGuard';
import { aiTaskQueue } from './src/ai/queue';

(window as any).process = (window as any).process || { env: {} };

// ─── RUNTIME GUARD INITIALIZATION ─────────────────────────────────────────────

async function initializeApp() {
  // Initialize runtime protection before rendering
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

  // ─── AI TASK QUEUE INITIALIZATION ──────────────────────────────────────────

  try {
    aiTaskQueue.initialize();
    console.log('[App] AI Task Queue initialized');
  } catch (error) {
    console.error('[App] AI Task Queue initialization failed:', error);
    // Non-critical - app can run without task queue
  }

  // ─── SERVICE WORKER AUTO-UPDATE ─────────────────────────────────────────────

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
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

  root.render(
    <React.StrictMode>
      <App />
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
