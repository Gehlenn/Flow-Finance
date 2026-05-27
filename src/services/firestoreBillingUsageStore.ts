import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { ResourceKind } from '../saas/types';
import type { WorkspaceUsageSnapshot } from './firestoreBillingTypes';
import { DEFAULT_USAGE } from './firestoreBillingTypes';

function nowIso(): string {
  return new Date().toISOString();
}

function usageDocRef(workspaceId: string) {
  return doc(db, 'workspaces', workspaceId, 'saas_usage', 'summary');
}

function normalizeUsageSnapshot(input?: Partial<WorkspaceUsageSnapshot> | null): WorkspaceUsageSnapshot {
  return {
    transactions: Number(input?.transactions || 0),
    aiQueries: Number(input?.aiQueries || 0),
    bankConnections: Number(input?.bankConnections || 0),
  };
}

export function getCurrentMonthKey(at = new Date()): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function toMonthDate(at?: string | Date): Date {
  if (!at) {
    return new Date();
  }

  if (at instanceof Date) {
    return at;
  }

  const trimmed = at.trim();
  if (!trimmed) {
    return new Date();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function readWorkspaceUsage(workspaceId: string): Promise<Record<string, WorkspaceUsageSnapshot>> {
  if (!isFirebaseConfigured || !workspaceId.trim()) {
    return {};
  }

  const snapshot = await getDoc(usageDocRef(workspaceId));
  if (!snapshot.exists()) {
    return {};
  }

  const data = snapshot.data() as { usage?: Record<string, Partial<WorkspaceUsageSnapshot>> };
  const usage = data.usage || {};
  const normalized: Record<string, WorkspaceUsageSnapshot> = {};

  for (const [monthKey, monthUsage] of Object.entries(usage)) {
    normalized[monthKey] = normalizeUsageSnapshot(monthUsage);
  }

  return normalized;
}

export async function writeWorkspaceUsage(
  workspaceId: string,
  usage: Record<string, WorkspaceUsageSnapshot>,
): Promise<void> {
  if (!isFirebaseConfigured || !workspaceId.trim()) {
    return;
  }

  await setDoc(usageDocRef(workspaceId), {
    workspaceId,
    usage,
    updatedAt: nowIso(),
  }, { merge: true });
}

export async function incrementWorkspaceUsage(input: {
  workspaceId: string;
  resource: ResourceKind;
  amount: number;
  at?: string | Date;
}): Promise<number> {
  if (!input.workspaceId.trim()) {
    return 0;
  }

  const usage = await readWorkspaceUsage(input.workspaceId);
  const monthKey = getCurrentMonthKey(toMonthDate(input.at));
  const current = normalizeUsageSnapshot(usage[monthKey]);
  current[input.resource] += input.amount;
  usage[monthKey] = current;
  await writeWorkspaceUsage(input.workspaceId, usage);
  return current[input.resource];
}

export async function resetWorkspaceUsage(workspaceId: string, monthKey?: string): Promise<void> {
  if (!workspaceId.trim()) {
    return;
  }

  const usage = await readWorkspaceUsage(workspaceId);
  const resolvedMonthKey = monthKey || getCurrentMonthKey();
  delete usage[resolvedMonthKey];
  await writeWorkspaceUsage(workspaceId, usage);
}

export function getDefaultUsageSnapshot(): WorkspaceUsageSnapshot {
  return { ...DEFAULT_USAGE };
}

export { DEFAULT_USAGE };
