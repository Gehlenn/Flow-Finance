/**
 * API CONFIGURATION — Backend Proxy Setup
 *
 * CRITICAL: Gemini API Key must NEVER be exposed in client-side code.
 * This configuration defines backend proxy endpoints for all API calls.
 *
 * Flow:
 *   Client → Backend Proxy → Gemini API
 *                    ↓
 *          Rate limiting + Auth verification
 */

// ─── Environment Detection ────────────────────────────────────────────────────

export const IS_DEVELOPMENT = import.meta.env.MODE === 'development';
export const IS_PRODUCTION = !IS_DEVELOPMENT;

// ─── Backend API Endpoints (Update with your actual backend domain) ──────────

export const BACKEND_BASE_URL = (() => {
  const configuredUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_PROD_URL ||
    import.meta.env.VITE_API_DEV_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  if (IS_DEVELOPMENT) {
    return 'http://localhost:3001';
  }

  // Test and local build environments need a stable absolute fallback so
  // endpoint contracts remain fully qualified even without injected env vars.
  return 'http://localhost:3001';
})();

export const API_ENDPOINTS = {
  // Gemini AI proxy endpoints
  AI: {
    INTERPRET: `${BACKEND_BASE_URL}/api/ai/interpret`,
    ANALYZE: `${BACKEND_BASE_URL}/api/ai/analyze`,
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

  // User data endpoints
  USER: {
    PROFILE: `${BACKEND_BASE_URL}/api/user/profile`,
    PREFERENCES: `${BACKEND_BASE_URL}/api/user/preferences`,
    SYNC_DATA: `${BACKEND_BASE_URL}/api/user/sync`,
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
};

// ─── Request Configuration ────────────────────────────────────────────────────

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // ms
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 60,
    REQUESTS_PER_HOUR: 1000,
  },
};

export class ApiRequestError extends Error {
  statusCode: number;
  requestId?: string;
  routeScope?: string;
  details?: Record<string, unknown>;

  constructor(params: {
    statusCode: number;
    message: string;
    requestId?: string;
    routeScope?: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.statusCode = params.statusCode;
    this.requestId = params.requestId;
    this.routeScope = params.routeScope;
    this.details = params.details;
  }
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

// ─── Security Headers ────────────────────────────────────────────────────────

export function getAuthHeaders(options?: {
  workspaceId?: string | null;
  includeWorkspace?: boolean;
}): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const includeWorkspace = options?.includeWorkspace !== false;
  const workspaceId = options?.workspaceId ?? getStoredWorkspaceId();

  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Client-Version': '0.6.1',
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
    /* */
  }
  return 'web';
}

// ─── API Request Wrapper ─────────────────────────────────────────────────────

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit & { timeout?: number; retries?: number; silent?: boolean }
): Promise<T> {
  const timeout = options?.timeout ?? API_CONFIG.TIMEOUT;
  const maxRetries = options?.retries ?? API_CONFIG.RETRY_ATTEMPTS;
  const silent = options?.silent === true;
  
  const headers = {
    ...getAuthHeaders(),
    ...(options?.headers || {}),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({} as Record<string, unknown>));
        const message = String((errorPayload as any).message || response.statusText || 'Request failed');
        const requestIdFromBody = typeof (errorPayload as any).requestId === 'string' ? (errorPayload as any).requestId : undefined;
        const requestIdFromHeader = response.headers.get('x-request-id') || undefined;

        throw new ApiRequestError({
          statusCode: response.status,
          message: `API Error ${response.status}: ${message}`,
          requestId: requestIdFromBody || requestIdFromHeader,
          routeScope: typeof (errorPayload as any).routeScope === 'string' ? (errorPayload as any).routeScope : undefined,
          details: typeof (errorPayload as any).details === 'object' && (errorPayload as any).details !== null
            ? (errorPayload as any).details as Record<string, unknown>
            : undefined,
        });
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      const statusMatch = String(error?.message ?? '').match(/API Error\s+(\d{3})/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      
      // Don't retry on auth errors or non-network issues
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw error;
      }

      // 4xx errors are typically deterministic (except 429 rate-limit)
      if (statusCode !== null && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        throw error;
      }

      if (attempt < maxRetries) {
        if (!silent) {
          console.warn(`[API] Request to ${endpoint} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (attempt + 1)));
      }
    }
  }

  if (!silent) {
    console.error(`[API] Request to ${endpoint} failed after ${maxRetries + 1} attempts:`, lastError);
  }
  throw lastError;
}

// add CFO example to documentation
// ─── Usage Example (for documentation) ──────────────────────────────────────

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
