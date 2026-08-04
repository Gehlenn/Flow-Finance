import { getEphemeralAccessToken } from '../services/authSessionStore';
import { reportError } from './sentry';
import { logError, logWarn } from '../utils/logger';

/**
 * API CONFIGURATION - Backend Proxy Setup
 *
 * CRITICAL: Gemini API Key must NEVER be exposed in client-side code.
 * This configuration defines backend proxy endpoints for all API calls.
 *
 * Flow:
 *   Client -> Backend Proxy -> Gemini API
 *                    |
 *          Rate limiting + Auth verification
 */

// Environment Detection

export const IS_DEVELOPMENT = import.meta.env.MODE === 'development';
export const IS_PRODUCTION = !IS_DEVELOPMENT;

// Backend API Endpoints (Update with your actual backend domain)

export const BACKEND_BASE_URL = (() => {
  const configuredUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_PROD_URL ||
    import.meta.env.VITE_API_DEV_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (IS_DEVELOPMENT) {
    return 'http://localhost:3001';
  }

  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location;
    const isLocalHostname = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

    if (!isLocalHostname) {
      return origin.replace(/\/$/, '');
    }
  }

  // Keep a deterministic local fallback for local preview/test environments.
  return 'http://localhost:3001';
})();

export const HAS_EXPLICIT_BACKEND_URL = Boolean(
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_PROD_URL ||
  import.meta.env.VITE_API_DEV_URL,
);

export const API_ENDPOINTS = {
  // Gemini AI proxy endpoints
  AI: {
    INTERPRET: `${BACKEND_BASE_URL}/api/ai/interpret`,
    CLASSIFY_TRANSACTIONS: `${BACKEND_BASE_URL}/api/ai/classify-transactions`,
    SCAN_RECEIPT: `${BACKEND_BASE_URL}/api/ai/scan-receipt`,
    GENERATE_INSIGHTS: `${BACKEND_BASE_URL}/api/ai/insights`,
    CREDIT_TOKEN_COUNT: `${BACKEND_BASE_URL}/api/ai/token-count`,
    CFO: `${BACKEND_BASE_URL}/api/ai/cfo`,    // new route for financial assistant
  },

  // Bank sync endpoints
  BANKING: {
    BANKS: `${BACKEND_BASE_URL}/api/banking/banks`,
    CONNECTORS: `${BACKEND_BASE_URL}/api/banking/connectors`,
    CONNECTIONS: `${BACKEND_BASE_URL}/api/banking/connections`,
    HEALTH: `${BACKEND_BASE_URL}/api/banking/health`,
    CONNECT_TOKEN: `${BACKEND_BASE_URL}/api/banking/connect-token`,
    CONNECT: `${BACKEND_BASE_URL}/api/banking/connect`,
    SYNC: `${BACKEND_BASE_URL}/api/banking/sync`,
    DISCONNECT: `${BACKEND_BASE_URL}/api/banking/disconnect`,
  },

  // Auth endpoints
  AUTH: {
    LOGIN: `${BACKEND_BASE_URL}/api/auth/login`,
    FIREBASE_SESSION: `${BACKEND_BASE_URL}/api/auth/firebase`,
    LOGOUT: `${BACKEND_BASE_URL}/api/auth/logout`,
    REFRESH_TOKEN: `${BACKEND_BASE_URL}/api/auth/refresh`,
  },

  WORKSPACE: {
    ROOT: `${BACKEND_BASE_URL}/api/workspace`,
  },


  FINANCE: {
    EVENTS: `${BACKEND_BASE_URL}/api/finance/events`,
    METRICS: `${BACKEND_BASE_URL}/api/finance/metrics`,
  },

  // SaaS endpoints
  SAAS: {
    USAGE: `${BACKEND_BASE_URL}/api/saas/usage`,
    PLANS: `${BACKEND_BASE_URL}/api/saas/plans`,
    PLAN_CHANGE: `${BACKEND_BASE_URL}/api/saas/plan`,
    BILLING_HOOKS: `${BACKEND_BASE_URL}/api/saas/billing-hooks`,
    STRIPE_CHECKOUT_SESSION: `${BACKEND_BASE_URL}/api/saas/stripe/checkout-session`,
    STRIPE_PORTAL_SESSION: `${BACKEND_BASE_URL}/api/saas/stripe/portal-session`,
  },

  SYNC: {
    HEALTH: `${BACKEND_BASE_URL}/api/sync/health`,
    PUSH: `${BACKEND_BASE_URL}/api/sync/push`,
    PULL: `${BACKEND_BASE_URL}/api/sync/pull`,
  },

  INTEGRATION_KEYS: {
    ROOT: `${BACKEND_BASE_URL}/api/integrations/keys`,
    GENERATE: `${BACKEND_BASE_URL}/api/integrations/keys/generate`,
  },
};

// Request Configuration

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // ms
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 60,
    REQUESTS_PER_HOUR: 1000,
  },
};

export const CLIENT_APP_VERSION =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION
    ? String(import.meta.env.VITE_APP_VERSION)
    : '0.9.7');
export const QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE = 'quota_persistence_unavailable' as const;
type ApiRequestErrorCode = typeof QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE;
export class ApiRequestError extends Error {
  statusCode: number;
  errorCode?: ApiRequestErrorCode;
  requestId?: string;
  routeScope?: string;
  details?: Record<string, unknown>;
  constructor(params: {
    statusCode: number;
    message: string;
    errorCode?: ApiRequestErrorCode;
    requestId?: string;
    routeScope?: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.requestId = params.requestId;
    this.routeScope = params.routeScope;
    this.details = params.details;
  }
}

const readErrorPayloadField = (payload: unknown, key: 'message' | 'error' | 'requestId' | 'routeScope' | 'details'): unknown => {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  return (payload as Record<string, unknown>)[key];
};

type WorkspaceSummaryLite = {
  workspaceId?: string;
};

type WorkspaceListResponse = {
  workspaces?: WorkspaceSummaryLite[];
};

function reportApiFailure(endpoint: string, error: Error | null, silent: boolean): void {
  if (!error || silent) {
    return;
  }

  if (error instanceof ApiRequestError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
    return;
  }

  reportError(error, {
    endpoint,
    ...(error instanceof ApiRequestError ? {
      statusCode: error.statusCode,
      requestId: error.requestId,
      routeScope: error.routeScope,
      ...(error.details || {}),
    } : {}),
  });
}

function isWorkspaceContextFailure(error: ApiRequestError): boolean {
  const msg = error.message.toLowerCase();
  return (
    (error.statusCode === 400 && msg.includes('workspaceid obrigatorio'))
    || (error.statusCode === 403 && msg.includes('acesso negado ao workspace'))
    || (error.statusCode === 404 && msg.includes('workspace nao encontrado'))
  );
}

async function recoverWorkspaceFromBackend(): Promise<boolean> {
  const headers = getAuthHeaders({ includeWorkspace: false });
  const response = await fetch(API_ENDPOINTS.WORKSPACE.ROOT, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json() as WorkspaceListResponse;
  const workspaceId = payload.workspaces?.[0]?.workspaceId;
  if (!workspaceId) {
    return false;
  }

  setStoredWorkspaceId(workspaceId);
  return true;
}

export const ACTIVE_WORKSPACE_STORAGE_KEY = 'active_workspace_id';

export function getStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
}

export function setStoredWorkspaceId(workspaceId: string | null): void {
  if (typeof window === 'undefined') return;

  if (!workspaceId) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

// Security Headers

export function getAuthHeaders(options?: {
  workspaceId?: string | null;
  includeWorkspace?: boolean;
}): Record<string, string> {
  const token = getEphemeralAccessToken();
  const includeWorkspace = options?.includeWorkspace !== false;
  const workspaceId = options?.workspaceId ?? getStoredWorkspaceId();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Client-Version': CLIENT_APP_VERSION,
    'X-Client-Platform': getPlatform(),
    ...(includeWorkspace && workspaceId ? { 'x-workspace-id': workspaceId } : {}),
  };
}

function getPlatform(): string {
  if (typeof window === 'undefined') return 'unknown';
  try {
    if (window.Capacitor?.isNativePlatform?.()) {
      const platform = window.Capacitor.getPlatform?.();
      return platform || 'native';
    }
  } catch {
    return 'web';
  }
  return 'web';
}

const IDEMPOTENT_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure random generator unavailable for idempotent request');
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getRequestHeaders(headersInit: HeadersInit | undefined, idempotencyKey: string | null): Headers {
  const headers = new Headers(getAuthHeaders());

  if (headersInit) {
    new Headers(headersInit).forEach((value, key) => headers.set(key, value));
  }

  if (idempotencyKey && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  return headers;
}

// API Request Wrapper

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit & { timeout?: number; retries?: number; silent?: boolean }
): Promise<T> {
  const timeout = options?.timeout ?? API_CONFIG.TIMEOUT;
  const maxRetries = options?.retries ?? API_CONFIG.RETRY_ATTEMPTS;
  const silent = options?.silent === true;
  const method = options?.method?.toUpperCase() ?? 'GET';
  const callerProvidedIdempotencyKey = options?.headers
    ? new Headers(options.headers).has('Idempotency-Key')
    : false;
  const idempotencyKey =
    IDEMPOTENT_HTTP_METHODS.has(method) && !callerProvidedIdempotencyKey
      ? createIdempotencyKey()
      : null;
  
  let lastError: unknown = null;
  let workspaceRecoveryAttempted = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = getRequestHeaders(options?.headers, idempotencyKey);

      const response = await fetch(endpoint, {
        ...options,
        credentials: options?.credentials ?? 'include',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => ({}));
        const payloadError = readErrorPayloadField(errorPayload, 'error');
        const payloadMessage = readErrorPayloadField(errorPayload, 'message') || payloadError;
        const message = String(payloadMessage || response.statusText || 'Request failed');
        const requestIdFromBody = typeof readErrorPayloadField(errorPayload, 'requestId') === 'string'
          ? String(readErrorPayloadField(errorPayload, 'requestId'))
          : undefined;
        const requestIdFromHeader = response.headers.get('x-request-id') || undefined;

        const apiError = new ApiRequestError({
          statusCode: response.status,
          message: `API Error ${response.status}: ${message}`,
          errorCode: payloadError === QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE
            ? QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE
            : undefined,
          requestId: requestIdFromBody || requestIdFromHeader,
          routeScope: typeof readErrorPayloadField(errorPayload, 'routeScope') === 'string'
            ? String(readErrorPayloadField(errorPayload, 'routeScope'))
            : undefined,
          details: typeof readErrorPayloadField(errorPayload, 'details') === 'object' && readErrorPayloadField(errorPayload, 'details') !== null
            ? readErrorPayloadField(errorPayload, 'details') as Record<string, unknown>
            : undefined,
        });

        // Self-heal workspace header drift (missing, stale or unauthorized workspace id).
        if (
          !workspaceRecoveryAttempted
          && endpoint !== API_ENDPOINTS.WORKSPACE.ROOT
          && isWorkspaceContextFailure(apiError)
        ) {
          workspaceRecoveryAttempted = true;
          const recovered = await recoverWorkspaceFromBackend().catch(() => false);
          if (recovered) {
            attempt -= 1;
            continue;
          }
        }

        throw apiError;
      }

      return await response.json();
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      lastError = error;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusMatch = errorMessage.match(/API Error\s+(\d{3})/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      
      // Don't retry on auth errors or non-network issues
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
        throw error;
      }

      if (
        error instanceof ApiRequestError
        && error.statusCode === 503
        && error.errorCode === QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE
      ) {
        throw error;
      }

      // 4xx errors are typically deterministic (except 429 rate-limit)
      if (statusCode !== null && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        throw error;
      }

      if (attempt < maxRetries) {
        if (!silent) {
          logWarn(`[API] Request to ${endpoint} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`, {
            endpoint,
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            fallback: 'api-request-retry',
          });
        }
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (attempt + 1)));
      }
    }
  }

  if (!silent) {
    logError(`[API] Request to ${endpoint} failed after ${maxRetries + 1} attempts`, {
      endpoint,
      attempts: maxRetries + 1,
      error: lastError,
      fallback: 'api-request-exhausted',
    });
  }
  reportApiFailure(endpoint, lastError instanceof Error ? lastError : null, silent);
  throw lastError;
}

// add CFO example to documentation
// Usage Example (for documentation)

/**
 * Example: Replace direct Gemini call with backend proxy
 *
 * // OLD (INSECURE - API Key in client)
 * import { GoogleGenerativeAI } from '@google/generative-ai';
 * const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
 *
 * // NEW (SECURE - Backend proxy)
 * const result = await apiRequest<InterpretResult>(
 *   API_ENDPOINTS.AI.INTERPRET,
 *   {
 *     method: 'POST',
 *     body: JSON.stringify({ text, context: { userId, locale: 'pt-BR' } }),
 *   }
 * );
 */













