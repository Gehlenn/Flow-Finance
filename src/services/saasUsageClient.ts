import { API_ENDPOINTS, getAuthHeaders } from '../config/api.config';
import type { WorkspaceUsageSnapshot } from './firestoreBillingTypes';

type WorkspaceUsageResponse = {
  scope: 'workspace';
  workspaceId: string;
  usage: Record<string, unknown>;
};

function normalizeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function normalizeUsageSnapshot(input: unknown): WorkspaceUsageSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return getDefaultUsageSnapshot();
  }

  const snapshot = input as Partial<WorkspaceUsageSnapshot>;
  return {
    transactions: normalizeCount(snapshot.transactions),
    aiQueries: normalizeCount(snapshot.aiQueries),
    bankConnections: normalizeCount(snapshot.bankConnections),
  };
}

function normalizeUsageRecord(input: unknown): Record<string, WorkspaceUsageSnapshot> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
      .map(([monthKey, value]) => [monthKey, normalizeUsageSnapshot(value)]),
  );
}

export function getCurrentMonthKey(at = new Date()): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDefaultUsageSnapshot(): WorkspaceUsageSnapshot {
  return { transactions: 0, aiQueries: 0, bankConnections: 0 };
}

/**
 * Reads the authoritative workspace meter from the backend. Client code must
 * never mutate this snapshot: quotaMiddleware owns server-side increments.
 */
export async function readWorkspaceUsageFromServer(
  workspaceId: string,
): Promise<Record<string, WorkspaceUsageSnapshot>> {
  if (!workspaceId.trim()) {
    return {};
  }

  const response = await fetch(API_ENDPOINTS.SAAS.USAGE, {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders({ workspaceId }),
  });

  if (!response.ok) {
    throw new Error(`Usage read failed: ${response.status}`);
  }

  const body = await response.json() as Partial<WorkspaceUsageResponse>;
  return normalizeUsageRecord(body.usage);
}
