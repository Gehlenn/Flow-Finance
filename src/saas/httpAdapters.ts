import { API_ENDPOINTS, BACKEND_BASE_URL, getAuthHeaders } from '../config/api.config';
import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../services/workspaceSession';
import { BillingHookTransport } from './billingHooks';
import { BillingHookPayload } from './types';
import { UsageSnapshot, UsageStoreAdapter } from './usageTracker';

function normalizeUsageRecord(record: unknown): Record<string, UsageSnapshot> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {};
  }

  const normalized: Record<string, UsageSnapshot> = {};

  for (const [monthKey, usage] of Object.entries(record as Record<string, unknown>)) {
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      continue;
    }

    const snapshot = usage as Partial<UsageSnapshot>;
    normalized[monthKey] = {
      transactions: Number(snapshot.transactions || 0),
      aiQueries: Number(snapshot.aiQueries || 0),
      bankConnections: Number(snapshot.bankConnections || 0),
    };
  }

  return normalized;
}

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
      const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
      const response = await fetch(usageUrl, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders({ workspaceId: workspace.workspaceId }),
      });

      if (!response.ok) {
        return {};
      }

      const body = await response.json() as { usage?: unknown };
      return normalizeUsageRecord(body.usage);
    },

    async write(data: Record<string, UsageSnapshot>): Promise<void> {
      const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
      const response = await fetch(usageUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders({ workspaceId: workspace.workspaceId }),
        body: JSON.stringify({ workspaceId: workspace.workspaceId, usage: data }),
      });

      if (!response.ok) {
        throw new Error(`Usage transport failed: ${response.status}`);
      }
    },
  };
}

export function createHttpBillingTransport(targetUrl?: string): BillingHookTransport {
  const endpoint = targetUrl ? buildEndpoint(targetUrl) : API_ENDPOINTS.SAAS.BILLING_HOOKS;

  return async (payload: BillingHookPayload): Promise<void> => {
    const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders({ workspaceId: workspace.workspaceId }),
      body: JSON.stringify({
        ...payload,
        workspaceId: payload.workspaceId || workspace.workspaceId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Billing transport failed: ${response.status}`);
    }
  };
}
