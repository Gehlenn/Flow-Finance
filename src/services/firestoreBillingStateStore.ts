import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { BillingHookPayload, PlanName } from '../saas/types';
import { writeAuditLogEvent } from './firestoreWorkspaceStore';
import type { WorkspaceBillingHookDocument, WorkspaceBillingState, WorkspaceUsageSnapshot } from './firestoreBillingTypes';
import { getCurrentMonthKey, getDefaultUsageSnapshot, readWorkspaceUsage } from './firestoreBillingUsageStore';

const FIREBASE_BILLING_CONFIG_ERROR = new Error('Workspace billing requires Firebase configuration.');
const FIREBASE_BILLING_CONTEXT_ERROR = new Error('Workspace billing requires a workspaceId and tenantId.');

function nowIso(): string {
  return new Date().toISOString();
}

function hasWorkspaceContext(workspaceId?: string, tenantId?: string): boolean {
  return Boolean(workspaceId?.trim()) && Boolean(tenantId?.trim());
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

export async function getWorkspaceBillingState(
  workspaceId: string,
  tenantId: string,
): Promise<WorkspaceBillingState> {
  if (!isFirebaseConfigured || !hasWorkspaceContext(workspaceId, tenantId)) {
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
  if (!hasWorkspaceContext(input.workspaceId, input.tenantId)) {
    throw FIREBASE_BILLING_CONTEXT_ERROR;
  }

  const eventRef = doc(billingHooksCollection(input.workspaceId));
  const event: WorkspaceBillingHookDocument = {
    ...input.payload,
    id: eventRef.id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    createdAt: nowIso(),
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
  if (!hasWorkspaceContext(input.workspaceId, input.tenantId)) {
    throw FIREBASE_BILLING_CONTEXT_ERROR;
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
  if (!isFirebaseConfigured || !input.workspaceId.trim()) {
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
  if (!hasWorkspaceContext(input.workspaceId, input.tenantId)) {
    return {
      currentPlan: 'free',
      usage: {},
      currentMonthUsage: getDefaultUsageSnapshot(),
      billingState: {
        workspaceId: input.workspaceId,
        tenantId: input.tenantId,
        plan: 'free',
        status: 'active',
        updatedAt: nowIso(),
        updatedByUserId: 'system',
      },
      billingHooks: [],
    };
  }

  const [billingState, usage, billingHooks] = await Promise.all([
    getWorkspaceBillingState(input.workspaceId, input.tenantId),
    readWorkspaceUsage(input.workspaceId),
    listWorkspaceBillingHooks({ workspaceId: input.workspaceId, maxItems: 10 }),
  ]);

  const currentMonthKey = getCurrentMonthKey();
  const usageForCurrentMonth = usage[currentMonthKey]
    ?? (Object.keys(usage).sort().pop() ? usage[Object.keys(usage).sort().pop()!] : undefined);

  return {
    currentPlan: billingState.plan,
    usage,
    currentMonthUsage: normalizeUsageSnapshot(usageForCurrentMonth || getDefaultUsageSnapshot()),
    billingState,
    billingHooks,
  };
}
