/**
 * API Guard
 * Monitors backend API health and connectivity
 */

import { GuardResult } from './types';

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_PROD_URL ||
  '';
const HAS_EXPLICIT_API_BASE_URL = Boolean(API_BASE_URL);

let apiOfflineMode = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_COOLDOWN = 30000; // 30s entre checks

export function isAPIOffline(): boolean {
  return apiOfflineMode;
}

export async function checkAPIHealth(): Promise<GuardResult> {
  const now = Date.now();
  
  // Avoid spamming health checks
  if (now - lastHealthCheck < HEALTH_CHECK_COOLDOWN) {
    return {
      guard: 'api',
      status: apiOfflineMode ? 'warning' : 'ok',
      message: apiOfflineMode ? 'API offline (cached result)' : 'API online (cached result)',
      timestamp: now,
    };
  }

  lastHealthCheck = now;

  try {
    const endpoint = API_BASE_URL ? `${API_BASE_URL}/api/health` : '/api/health';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      apiOfflineMode = false;
      console.log('[API Guard] Backend is healthy');
      return {
        guard: 'api',
        status: 'ok',
        message: 'API online',
        timestamp: now,
      };
    } else if (!HAS_EXPLICIT_API_BASE_URL && response.status === 404) {
      apiOfflineMode = false;
      return {
        guard: 'api',
        status: 'ok',
        message: 'API health probe skipped (frontend-only environment)',
        timestamp: now,
      };
    } else {
      apiOfflineMode = true;
      console.warn('[API Guard] Backend returned non-OK status:', response.status);
      return {
        guard: 'api',
        status: 'warning',
        message: `API returned status ${response.status}`,
        retryable: true,
        timestamp: now,
      };
    }
  } catch (error) {
    apiOfflineMode = true;
    console.warn('[API Guard] Backend health check failed:', error);
    return {
      guard: 'api',
      status: 'warning',
      message: 'API unreachable',
      retryable: true,
      timestamp: now,
    };
  }
}
