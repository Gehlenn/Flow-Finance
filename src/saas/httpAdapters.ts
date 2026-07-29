import { API_ENDPOINTS, BACKEND_BASE_URL, getAuthHeaders } from '../config/api.config';
import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../services/workspaceSession';
import { BillingHookTransport } from './billingHooks';
import { BillingHookPayload } from './types';

function buildEndpoint(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith('/')) {
    return `${BACKEND_BASE_URL}${pathOrUrl}`;
  }

  return `${BACKEND_BASE_URL}/${pathOrUrl}`;
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
