/**
 * Version Guard
 * Monitors app version consistency between frontend and backend
 */

import { GuardResult } from './types';
import { isBenchmarkBrowserSession } from './benchmarkMode';
import { logInfo, logWarn } from '../utils/logger';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.9.7';
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_PROD_URL ||
  '';
const IS_DEV = import.meta.env.DEV;
const IS_AUTOMATED_BROWSER = typeof navigator !== 'undefined' && navigator.webdriver === true;

function isLocalNetworkTarget(url: string): boolean {
  if (!url) return true;

  try {
    const parsed = new URL(url, window.location.origin);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const SHOULD_SKIP_NETWORK_PROBES = IS_AUTOMATED_BROWSER || (isLocalNetworkTarget(API_BASE_URL) && IS_DEV);

let lastVersionCheck = 0;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;

export async function checkAppVersion(): Promise<GuardResult> {
  const now = Date.now();

  if (SHOULD_SKIP_NETWORK_PROBES) {
    return {
      guard: 'version',
      status: 'ok',
      message: 'Version check skipped (local/non-production runtime)',
      timestamp: now,
    };
  }

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

    const endpoint = API_BASE_URL ? `${API_BASE_URL}/api/version` : '/api/version';
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404 && isLocalNetworkTarget(API_BASE_URL)) {
        return {
          guard: 'version',
          status: 'ok',
          message: 'Version check skipped (frontend-only environment)',
          timestamp: now,
        };
      }

      logWarn('[Version Guard] Failed to fetch backend version', {
        status: response.status,
        fallback: 'version-guard-backend-version-fetch-failed',
      });
      return {
        guard: 'version',
        status: 'warning',
        message: 'Could not check version',
        timestamp: now,
      };
    }

    const data = await response.json();
    const backendVersion = data.version;

    if (backendVersion && backendVersion !== APP_VERSION) {
      logWarn('[Version Guard] Version mismatch detected', {
        frontendVersion: APP_VERSION,
        backendVersion,
        fallback: 'version-guard-version-mismatch',
      });

      if (!isBenchmarkBrowserSession()) {
        logWarn('[HOTFIX] reload bloqueado', {
          frontendVersion: APP_VERSION,
          backendVersion,
          fallback: 'version-guard-reload-blocked',
        });
      } else {
        logInfo('[Version Guard] Reload skipped in benchmark mode', {
          frontendVersion: APP_VERSION,
          backendVersion,
          fallback: 'version-guard-reload-skipped-benchmark',
        });
      }

      return {
        guard: 'version',
        status: 'warning',
        message: `Version mismatch: ${APP_VERSION} (local) vs ${backendVersion} (backend)`,
        retryable: false,
        timestamp: now,
      };
    }

    logInfo('[Version Guard] Versions match', {
      frontendVersion: APP_VERSION,
      fallback: 'version-guard-versions-match',
    });

    return {
      guard: 'version',
      status: 'ok',
      message: `Version ${APP_VERSION} consistent`,
      timestamp: now,
    };
  } catch (error) {
    logWarn('[Version Guard] Version check failed', {
      error,
      fallback: 'version-guard-check-failed',
    });
    return {
      guard: 'version',
      status: 'warning',
      message: 'Version check failed',
      retryable: true,
      timestamp: now,
    };
  }
}

export function getLocalVersion(): string {
  return APP_VERSION;
}
