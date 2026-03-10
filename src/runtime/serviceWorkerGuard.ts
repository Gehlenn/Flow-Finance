/**
 * Service Worker Guard
 * Validates and manages service worker cache consistency
 */

import { GuardResult } from './types';

const EXPECTED_CACHE_VERSION = 'flow-finance-v3';

export async function validateServiceWorker(): Promise<GuardResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      guard: 'serviceworker',
      status: 'ok',
      message: 'Service worker not supported',
      timestamp: Date.now(),
    };
  }

  try {
    // Check for stale caches
    const cacheNames = await caches.keys();
    const staleCaches = cacheNames.filter((name) => !name.includes('v3'));

    if (staleCaches.length > 0) {
      console.warn('[SW Guard] Found stale caches:', staleCaches);
      await cleanStaleCaches(staleCaches);
      
      return {
        guard: 'serviceworker',
        status: 'warning',
        message: `Cleaned ${staleCaches.length} stale cache(s)`,
        timestamp: Date.now(),
      };
    }

    // Force update existing service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      registration.update();
    }

    console.log('[SW Guard] Service worker validated');

    return {
      guard: 'serviceworker',
      status: 'ok',
      message: 'Service worker healthy',
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[SW Guard] Validation failed:', error);
    return {
      guard: 'serviceworker',
      status: 'error',
      message: 'Service worker validation failed',
      timestamp: Date.now(),
    };
  }
}

async function cleanStaleCaches(cacheNames: string[]): Promise<void> {
  console.log('[SW Guard] Cleaning stale caches...');
  
  await Promise.all(
    cacheNames.map(async (cacheName) => {
      const deleted = await caches.delete(cacheName);
      console.log(`[SW Guard] Cache "${cacheName}" deleted:`, deleted);
    })
  );
}

export async function clearAllCaches(): Promise<void> {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW Guard] All caches cleared');
}
