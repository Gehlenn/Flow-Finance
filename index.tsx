import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './src/styles/tailwind.css';

(window as any).process = (window as any).process || { env: {} };

// ─── SERVICE WORKER AUTO-UPDATE ───────────────────────────────────────────────

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
