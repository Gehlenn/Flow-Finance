import { API_ENDPOINTS, BACKEND_BASE_URL, getAuthHeaders } from '../config/api.config';
import { BillingHookTransport } from './billingHooks';
import { BillingHookPayload } from './types';
import { UsageSnapshot, UsageStoreAdapter } from './usageTracker';

function buildEndpoint(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith('/')) {
    return `${BACKEND_BASE_URL}${pathOrUrl}`;
  }

  return `${BACKEND_BASE_URL}/${pathOrUrl}`;
}

export function createHttpUsageStoreAdapter(baseUrl?: string): UsageStoreAdapter {
  const usageUrl = baseUrl ? `${baseUrl}/api/saas/usage` : API_ENDPOINTS.SAAS.USAGE;

  return {
    async read(): Promise<Record<string, UsageSnapshot>> {
      const response = await fetch(usageUrl, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        return {};
      }

      const body = await response.json() as { usage?: Record<string, UsageSnapshot> };
      return body.usage || {};
    },

    async write(data: Record<string, UsageSnapshot>): Promise<void> {
      await fetch(usageUrl, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ usage: data }),
      });
    },
  };
}

export function createHttpBillingTransport(targetUrl?: string): BillingHookTransport {
  const endpoint = targetUrl ? buildEndpoint(targetUrl) : API_ENDPOINTS.SAAS.BILLING_HOOKS;

  return async (payload: BillingHookPayload): Promise<void> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Billing transport failed: ${response.status}`);
    }
  };
}
