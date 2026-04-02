import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../services/workspaceSession';
import {
  incrementWorkspaceUsage,
  readWorkspaceUsage,
  recordWorkspaceBillingHook,
  resetWorkspaceUsage,
  writeWorkspaceUsage,
} from '../services/firestoreBillingStore';
import { BillingHookTransport } from './billingHooks';
import type { BillingHookPayload } from './types';
import { UsageSnapshot, UsageStoreAdapter } from './usageTracker';

function normalizeUsageRecord(record: Record<string, { transactions: number; aiQueries: number; bankConnections: number }>): Record<string, UsageSnapshot> {
  const normalized: Record<string, UsageSnapshot> = {};

  for (const [monthKey, usage] of Object.entries(record)) {
    normalized[monthKey] = {
      transactions: Number(usage.transactions || 0),
      aiQueries: Number(usage.aiQueries || 0),
      bankConnections: Number(usage.bankConnections || 0),
    };
  }

  return normalized;
}

export function createFirestoreUsageStoreAdapter(): UsageStoreAdapter {
  return {
    async read(): Promise<Record<string, UsageSnapshot>> {
      const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
      return normalizeUsageRecord(await readWorkspaceUsage(workspace.workspaceId));
    },

    async write(data: Record<string, UsageSnapshot>): Promise<void> {
      const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
      await writeWorkspaceUsage(workspace.workspaceId, data);
    },

    async increment(params): Promise<number> {
      const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
      return incrementWorkspaceUsage({
        workspaceId: workspace.workspaceId,
        resource: params.resource,
        amount: params.amount,
        at: params.at,
      });
    },

    async reset(monthKey?: string): Promise<void> {
      const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
      await resetWorkspaceUsage(workspace.workspaceId, monthKey);
    },
  };
}

export function createFirestoreBillingTransport(): BillingHookTransport {
  return async (payload: BillingHookPayload): Promise<void> => {
    const identity = getCurrentWorkspaceIdentity();
    const workspace = await ensureActiveWorkspace(identity);

    await recordWorkspaceBillingHook({
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      payload: {
        ...payload,
        userId: payload.userId || identity?.userId || 'unknown',
        workspaceId: workspace.workspaceId,
      },
    });
  };
}
