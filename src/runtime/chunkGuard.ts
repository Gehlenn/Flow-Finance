/**
 * Chunk Guard
 * Detects and recovers from dynamic chunk loading failures
 */

import { GuardResult } from './types';
import { logError, logInfo } from '../utils/logger';

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

  window.addEventListener('error', (event) => {
    const error = event.error || event.message;
    const errorMessage = error?.message || error?.toString() || '';

    const isChunkError =
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('Importing a module script failed') ||
      errorMessage.includes('error loading dynamically imported module') ||
      (event.filename && event.filename.includes('.js') && errorMessage.includes('404'));

    if (isChunkError) {
      handleChunkError(errorMessage);
      event.preventDefault();
    }
  });

  logInfo('[Chunk Guard] Initialized - monitoring dynamic imports', {
    fallback: 'chunk-guard-initialized',
  });

  return {
    guard: 'chunk',
    status: 'ok',
    message: 'Chunk guard active',
    timestamp: Date.now(),
  };
}

function handleChunkError(error: string): void {
  chunkErrorCount++;

  logError('[Chunk Guard] Chunk loading error detected', error, {
    chunkErrorCount,
    maxChunkErrors: MAX_CHUNK_ERRORS,
    fallback: 'chunk-guard-chunk-loading-failed',
  });

  showChunkErrorNotification();

  if (chunkErrorCount >= MAX_CHUNK_ERRORS || (!hasReloaded && import.meta.env.PROD)) {
    reloadApplication();
  }
}

function showChunkErrorNotification(): void {
  const existingNotification = document.getElementById('chunk-error-notification');
  if (existingNotification) return;

  const notification = document.createElement('div');
  notification.id = 'chunk-error-notification';
  notification.className = 'chunk-error-notification';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'chunk-error-notification-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  const warningPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  warningPath.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
  const warningLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  warningLine.setAttribute('x1', '12');
  warningLine.setAttribute('y1', '9');
  warningLine.setAttribute('x2', '12');
  warningLine.setAttribute('y2', '13');
  const warningDot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  warningDot.setAttribute('x1', '12');
  warningDot.setAttribute('y1', '17');
  warningDot.setAttribute('x2', '12.01');
  warningDot.setAttribute('y2', '17');
  icon.append(warningPath, warningLine, warningDot);

  const copy = document.createElement('div');

  const title = document.createElement('strong');
  title.className = 'chunk-error-notification-title';
  title.textContent = 'Atualizacao detectada';

  const description = document.createElement('span');
  description.className = 'chunk-error-notification-description';
  description.textContent = 'Recarregando aplicacao...';

  copy.append(title, description);
  notification.append(icon, copy);
  document.body.appendChild(notification);

  setTimeout(() => {
    if (!hasReloaded) {
      reloadApplication();
    }
  }, 2000);
}

function reloadApplication(): void {
  if (hasReloaded) return;

  hasReloaded = true;
  logInfo('[Chunk Guard] Reloading application to fetch updated chunks', {
    fallback: 'chunk-guard-reload-triggered',
  });

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
