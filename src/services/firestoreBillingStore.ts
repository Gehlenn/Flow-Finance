import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { BillingHookPayload, PlanName, ResourceKind } from '../saas/types';
import { writeAuditLogEvent } from './firestoreWorkspaceStore';

export interface WorkspaceUsageSnapshot {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
}

export interface WorkspaceBillingState {
  workspaceId: string;
  tenantId: string;
  plan: PlanName;
  status: 'active';
  updatedAt: string;
  updatedByUserId: string;
}

export interface WorkspaceBillingHookDocument extends BillingHookPayload {
  id: string;
  tenantId: string;
  workspaceId: string;
  createdAt: string;
}

const DEFAULT_USAGE: WorkspaceUsageSnapshot = {
  transactions: 0,
  aiQueries: 0,
  bankConnections: 0,
};

const FIREBASE_BILLING_CONFIG_ERROR = new Error('Workspace billing requires Firebase configuration.');

function nowIso(): string {
  return new Date().toISOString();
}

function usageDocRef(workspaceId: string) {
  return doc(collection(db, 'workspaces', workspaceId, 'saas_usage'), 'summary');
}

function billingStateDocRef(workspaceId: string) {
  return doc(collection(db, 'workspaces', workspaceId, 'billing_state'), 'current');
}

function billingHooksCollection(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'billing_hooks');
}

function workspaceDocRef(workspaceId: string) {
  return doc(db, 'workspaces', workspaceId);
}

function normalizeUsageSnapshot(input?: Partial<WorkspaceUsageSnapshot> | null): WorkspaceUsageSnapshot {
  return {
    transactions: Number(input?.transactions || 0),
    aiQueries: Number(input?.aiQueries || 0),
    bankConnections: Number(input?.bankConnections || 0),
  };
}

export function getCurrentMonthKey(at = new Date()): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function readWorkspaceUsage(workspaceId: string): Promise<Record<string, WorkspaceUsageSnapshot>> {
  if (!isFirebaseConfigured) {
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
  if (!isFirebaseConfigured) {
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
  at?: string;
}): Promise<number> {
  const usage = await readWorkspaceUsage(input.workspaceId);
  const monthKey = getCurrentMonthKey(input.at ? new Date(input.at) : new Date());
  const current = normalizeUsageSnapshot(usage[monthKey]);
  current[input.resource] += input.amount;
  usage[monthKey] = current;
  await writeWorkspaceUsage(input.workspaceId, usage);
  return current[input.resource];
}

export async function resetWorkspaceUsage(workspaceId: string, monthKey?: string): Promise<void> {
  const usage = await readWorkspaceUsage(workspaceId);
  const resolvedMonthKey = monthKey || getCurrentMonthKey();
  delete usage[resolvedMonthKey];
  await writeWorkspaceUsage(workspaceId, usage);
}

export async function getWorkspaceBillingState(
  workspaceId: string,
  tenantId: string,
): Promise<WorkspaceBillingState> {
  if (!isFirebaseConfigured) {
    return {
      workspaceId,
      tenantId,
      plan: 'free',
      status: 'active',
      updatedAt: nowIso(),
      updatedByUserId: 'system',
    };
  }

  const stateSnapshot = await getDoc(billingStateDocRef(workspaceId));
  if (stateSnapshot.exists()) {
    return stateSnapshot.data() as WorkspaceBillingState;
  }

  const workspaceSnapshot = await getDoc(workspaceDocRef(workspaceId));
  const workspacePlan = workspaceSnapshot.exists()
    ? ((workspaceSnapshot.data() as { plan?: PlanName }).plan || 'free')
    : 'free';

  return {
    workspaceId,
    tenantId,
    plan: workspacePlan,
    status: 'active',
    updatedAt: nowIso(),
    updatedByUserId: 'system',
  };
}

export async function recordWorkspaceBillingHook(input: {
  tenantId: string;
  workspaceId: string;
  payload: BillingHookPayload;
}): Promise<WorkspaceBillingHookDocument> {
  if (!isFirebaseConfigured) {
    throw FIREBASE_BILLING_CONFIG_ERROR;
  }

  const eventRef = doc(billingHooksCollection(input.workspaceId));
  const event: WorkspaceBillingHookDocument = {
    id: eventRef.id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    createdAt: nowIso(),
    ...input.payload,
  };

  await setDoc(eventRef, event, { merge: true });
  await writeAuditLogEvent({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.payload.userId,
    action: `billing.${input.payload.event}`,
    resourceType: 'billing_hook',
    resourceId: event.id,
    metadata: {
      plan: input.payload.plan,
      resource: input.payload.resource,
      amount: input.payload.amount,
    },
  });

  return event;
}

export async function updateWorkspacePlan(input: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  plan: PlanName;
}): Promise<WorkspaceBillingState> {
  if (!isFirebaseConfigured) {
    throw FIREBASE_BILLING_CONFIG_ERROR;
  }

  const nextState: WorkspaceBillingState = {
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    plan: input.plan,
    status: 'active',
    updatedAt: nowIso(),
    updatedByUserId: input.userId,
  };

  await Promise.all([
    setDoc(billingStateDocRef(input.workspaceId), nextState, { merge: true }),
    setDoc(workspaceDocRef(input.workspaceId), {
      plan: input.plan,
      updatedAt: nextState.updatedAt,
    }, { merge: true }),
    writeAuditLogEvent({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: 'workspace.plan_changed',
      resourceType: 'workspace',
      resourceId: input.workspaceId,
      metadata: {
        plan: input.plan,
      },
    }),
    recordWorkspaceBillingHook({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      payload: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        plan: input.plan,
        event: 'plan_changed',
        resource: 'transactions',
        amount: 0,
        at: nextState.updatedAt,
        metadata: {
          source: 'workspace_admin',
        },
      },
    }),
  ]);

  return nextState;
}

export async function listWorkspaceBillingHooks(input: {
  workspaceId: string;
  maxItems?: number;
}): Promise<WorkspaceBillingHookDocument[]> {
  if (!isFirebaseConfigured) {
    return [];
  }

  const snapshot = await getDocs(query(
    billingHooksCollection(input.workspaceId),
    orderBy('createdAt', 'desc'),
    limit(input.maxItems || 20),
  ));

  return snapshot.docs.map((entry) => entry.data() as WorkspaceBillingHookDocument);
}

export async function getWorkspaceBillingOverview(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<{
  currentPlan: PlanName;
  usage: Record<string, WorkspaceUsageSnapshot>;
  currentMonthUsage: WorkspaceUsageSnapshot;
  billingState: WorkspaceBillingState;
  billingHooks: WorkspaceBillingHookDocument[];
}> {
  const [billingState, usage, billingHooks] = await Promise.all([
    getWorkspaceBillingState(input.workspaceId, input.tenantId),
    readWorkspaceUsage(input.workspaceId),
    listWorkspaceBillingHooks({ workspaceId: input.workspaceId, maxItems: 10 }),
  ]);

  const currentMonthKey = getCurrentMonthKey();

  return {
    currentPlan: billingState.plan,
    usage,
    currentMonthUsage: normalizeUsageSnapshot(usage[currentMonthKey] || DEFAULT_USAGE),
    billingState,
    billingHooks,
  };
}
