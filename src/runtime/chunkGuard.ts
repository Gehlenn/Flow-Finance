/**
 * Chunk Guard
 * Detects and recovers from dynamic chunk loading failures
 */

import { GuardResult } from './types';

let chunkErrorCount = 0;
const MAX_CHUNK_ERRORS = 3;
let hasReloaded = false;

export function protectChunkLoading(): GuardResult {
  if (typeof window === 'undefined') {
    return {
      guard: 'chunk',
      status: 'ok',
      message: 'Not in browser context',
      timestamp: Date.now(),
    };
  }

  // Intercept global errors
  window.addEventListener('error', (event) => {
    const error = event.error || event.message;
    const errorMessage = error?.message || error?.toString() || '';

    // Detect chunk loading failures
    const isChunkError =
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('Importing a module script failed') ||
      errorMessage.includes('error loading dynamically imported module') ||
      (event.filename && event.filename.includes('.js') && errorMessage.includes('404'));

    if (isChunkError) {
      handleChunkError(errorMessage);
      event.preventDefault(); // Prevent default error handling
    }
  });

  console.log('[Chunk Guard] Initialized - monitoring dynamic imports');

  return {
    guard: 'chunk',
    status: 'ok',
    message: 'Chunk guard active',
    timestamp: Date.now(),
  };
}

// Backward-compatible alias.
export const initChunkGuard = protectChunkLoading;

function handleChunkError(error: string): void {
  chunkErrorCount++;

  console.error(`[Chunk Guard] Chunk loading error detected (${chunkErrorCount}/${MAX_CHUNK_ERRORS}):`, error);

  // Show user notification
  showChunkErrorNotification();

  // Force reload if too many errors or first error in production
  if (chunkErrorCount >= MAX_CHUNK_ERRORS || (!hasReloaded && import.meta.env.PROD)) {
    reloadApplication();
  }
}

function showChunkErrorNotification(): void {
  // Create notification overlay
  const existingNotification = document.getElementById('chunk-error-notification');
  if (existingNotification) return; // Already showing

  const notification = document.createElement('div');
  notification.id = 'chunk-error-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 9999;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideDown 0.3s ease-out;
  `;

  notification.innerHTML = `
    <style>
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    </style>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <div>
      <strong style="display: block; margin-bottom: 4px;">Atualização detectada</strong>
      <span style="opacity: 0.9; font-size: 14px;">Recarregando aplicação...</span>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto reload after 2s
  setTimeout(() => {
    if (!hasReloaded) {
      reloadApplication();
    }
  }, 2000);
}

function reloadApplication(): void {
  if (hasReloaded) return;
  
  hasReloaded = true;
  console.log('[Chunk Guard] Reloading application to fetch updated chunks');

  // Clear service worker cache before reload
  if ('serviceWorker' in navigator && 'caches' in window) {
    caches.keys().then((keys) => {
      Promise.all(keys.map((key) => caches.delete(key))).then(() => {
        window.location.reload();
      });
    });
  } else {
    window.location.reload();
  }
}

export function resetChunkErrorCount(): void {
  chunkErrorCount = 0;
}
