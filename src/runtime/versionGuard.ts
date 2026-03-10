/**
 * Version Guard
 * Monitors app version consistency between frontend and backend
 */

import { GuardResult } from './types';

const LOCAL_VERSION = import.meta.env.VITE_APP_VERSION || '0.4.0';
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_PROD_URL ||
  'https://flow-finance-backend.vercel.app';

let lastVersionCheck = 0;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function checkAppVersion(): Promise<GuardResult> {
  const now = Date.now();

  // Rate limit version checks
  if (now - lastVersionCheck < VERSION_CHECK_INTERVAL) {
    return {
      guard: 'version',
      status: 'ok',
      message: 'Version check skipped (cooldown)',
      timestamp: now,
    };
  }

  lastVersionCheck = now;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/api/version`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Version Guard] Failed to fetch backend version:', response.status);
      return {
        guard: 'version',
        status: 'warning',
        message: 'Could not check version',
        timestamp: now,
      };
    }

    const data = await response.json();
    const backendVersion = data.version;

    if (backendVersion && backendVersion !== LOCAL_VERSION) {
      console.warn(
        `[Version Guard] Version mismatch detected - Frontend: ${LOCAL_VERSION}, Backend: ${backendVersion}`
      );

      // Show version mismatch notification
      showVersionMismatchNotification(LOCAL_VERSION, backendVersion);

      return {
        guard: 'version',
        status: 'warning',
        message: `Version mismatch: ${LOCAL_VERSION} (local) vs ${backendVersion} (backend)`,
        retryable: false,
        timestamp: now,
      };
    }

    console.log('[Version Guard] Versions match:', LOCAL_VERSION);

    return {
      guard: 'version',
      status: 'ok',
      message: `Version ${LOCAL_VERSION} consistent`,
      timestamp: now,
    };
  } catch (error) {
    console.warn('[Version Guard] Version check failed:', error);
    return {
      guard: 'version',
      status: 'warning',
      message: 'Version check failed',
      retryable: true,
      timestamp: now,
    };
  }
}

function showVersionMismatchNotification(localVersion: string, backendVersion: string): void {
  // Check if already showing
  if (document.getElementById('version-mismatch-notification')) return;

  const notification = document.createElement('div');
  notification.id = 'version-mismatch-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 9998;
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 320px;
    animation: slideIn 0.3s ease-out;
  `;

  notification.innerHTML = `
    <style>
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
    <div style="display: flex; align-items: start; gap: 12px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div style="flex: 1;">
        <strong style="display: block; margin-bottom: 8px;">Nova versão disponível</strong>
        <p style="margin: 0 0 12px 0; opacity: 0.95; font-size: 13px;">
          Frontend: v${localVersion}<br/>
          Backend: v${backendVersion}
        </p>
        <button 
          onclick="window.location.reload()" 
          style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.4);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 13px;
          "
        >
          Atualizar Agora
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-dismiss after 30s
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 30000);
}

export function getLocalVersion(): string {
  return LOCAL_VERSION;
}
