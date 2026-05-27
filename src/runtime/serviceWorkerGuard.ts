/**
 * Service Worker Guard
 * Validates and manages service worker cache consistency
 */

import { GuardResult } from "./types";
import { logError, logInfo, logWarn } from "../utils/logger";

const EXPECTED_CACHE_VERSION = "flow-finance-v3";
const IS_DEV = import.meta.env.DEV;

export async function validateServiceWorker(): Promise<GuardResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return {
      guard: "serviceworker",
      status: "ok",
      message: "Service worker not supported",
      timestamp: Date.now(),
    };
  }

  try {
    // Check for stale caches
    const cacheNames = await caches.keys();
    const staleCaches = cacheNames.filter((name) => !name.includes("v3"));

    if (staleCaches.length > 0) {
      if (IS_DEV) {
        logInfo("[SW Guard] Found stale caches during local cleanup", {
          staleCaches,
          expectedCacheVersion: EXPECTED_CACHE_VERSION,
          fallback: "service-worker-stale-caches-dev-cleanup",
        });
      } else {
        logWarn("[SW Guard] Found stale caches", {
          staleCaches,
          expectedCacheVersion: EXPECTED_CACHE_VERSION,
          fallback: "service-worker-stale-caches",
        });
      }
      await cleanStaleCaches(staleCaches);

      return {
        guard: "serviceworker",
        status: IS_DEV ? "ok" : "warning",
        message: `Cleaned ${staleCaches.length} stale cache(s)`,
        timestamp: Date.now(),
      };
    }

    // Force update existing service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      registration.update();
    }

    logInfo("[SW Guard] Service worker validated", {
      expectedCacheVersion: EXPECTED_CACHE_VERSION,
      fallback: "service-worker-validated",
    });

    return {
      guard: "serviceworker",
      status: "ok",
      message: "Service worker healthy",
      timestamp: Date.now(),
    };
  } catch (error) {
    logError("[SW Guard] Validation failed", error, {
      expectedCacheVersion: EXPECTED_CACHE_VERSION,
      fallback: "service-worker-validation-failed",
    });
    return {
      guard: "serviceworker",
      status: "error",
      message: "Service worker validation failed",
      timestamp: Date.now(),
    };
  }
}

async function cleanStaleCaches(cacheNames: string[]): Promise<void> {
  logInfo("[SW Guard] Cleaning stale caches", {
    staleCacheCount: cacheNames.length,
    fallback: "service-worker-cleaning-stale-caches",
  });

  await Promise.all(
    cacheNames.map(async (cacheName) => {
      const deleted = await caches.delete(cacheName);
      logInfo("[SW Guard] Cache deleted", {
        cacheName,
        deleted,
        fallback: "service-worker-cache-deleted",
      });
    }),
  );
}

export async function clearAllCaches(): Promise<void> {
  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  logInfo("[SW Guard] All caches cleared", {
    cacheCount: cacheNames.length,
    fallback: "service-worker-caches-cleared",
  });
}
