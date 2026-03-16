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
  if (IS_DEVELOPMENT) {
    return import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_DEV_URL || 'http://localhost:3001';
  }
  // Keep a stable, resolvable fallback for production builds when env vars are missing.
  return import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_PROD_URL || 'https://flow-finance-backend.vercel.app';
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
    LOGOUT: `${BACKEND_BASE_URL}/api/auth/logout`,
    REFRESH_TOKEN: `${BACKEND_BASE_URL}/api/auth/refresh`,
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

// ─── Security Headers ────────────────────────────────────────────────────────

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Client-Version': '0.6.1',
    'X-Client-Platform': getPlatform(),
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
        const error = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${error.message || response.statusText}`);
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
