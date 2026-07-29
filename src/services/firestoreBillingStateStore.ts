import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { API_ENDPOINTS, apiRequest, getAuthHeaders } from '../config/api.config';
import type { PlanName } from '../saas/types';
import type { WorkspaceBillingHookDocument, WorkspaceBillingState, WorkspaceUsageSnapshot } from './firestoreBillingTypes';
import {
  getCurrentMonthKey,
  getDefaultUsageSnapshot,
  readWorkspaceUsageFromServer,
} from './saasUsageClient';
import { getDemoBootstrapPlan } from '../demo/demoBootstrap';

function nowIso(): string {
  return new Date().toISOString();
}

function hasWorkspaceContext(workspaceId?: string, tenantId?: string): boolean {
  return Boolean(workspaceId?.trim()) && Boolean(tenantId?.trim());
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

function isPlanName(value: unknown): value is PlanName {
  return value === 'free' || value === 'pro';
}

export async function getWorkspaceBillingState(
  workspaceId: string,
  tenantId: string,
): Promise<WorkspaceBillingState> {
  const demoPlan = getDemoBootstrapPlan();
  if (demoPlan) {
    return {
      workspaceId,
      tenantId,
      plan: demoPlan,
      status: 'active',
      updatedAt: nowIso(),
      updatedByUserId: 'demo',
    };
  }

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

  const workspaceSnapshot = await getDoc(workspaceDocRef(workspaceId));
  const workspaceData = workspaceSnapshot.exists()
    ? workspaceSnapshot.data() as { plan?: unknown; updatedAt?: unknown }
    : null;
  const workspacePlan = isPlanName(workspaceData?.plan) ? workspaceData.plan : 'free';
  const updatedAt = typeof workspaceData?.updatedAt === 'string' ? workspaceData.updatedAt : nowIso();

  return {
    workspaceId,
    tenantId,
    plan: workspacePlan,
    status: 'active',
    updatedAt,
    updatedByUserId: 'system',
  };
}

export async function listWorkspaceBillingHooks(input: {
  workspaceId: string;
  maxItems?: number;
}): Promise<WorkspaceBillingHookDocument[]> {
  if (!input.workspaceId.trim() || getDemoBootstrapPlan()) {
    return [];
  }

  const response = await apiRequest<{ hooks?: WorkspaceBillingHookDocument[] }>(
    API_ENDPOINTS.SAAS.BILLING_HOOKS,
    {
      method: 'GET',
      headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    },
  );

  return Array.isArray(response.hooks)
    ? response.hooks.slice(0, input.maxItems || 20)
    : [];
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
  const demoPlan = getDemoBootstrapPlan();
  if (demoPlan) {
    const billingState: WorkspaceBillingState = {
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      plan: demoPlan,
      status: 'active',
      updatedAt: nowIso(),
      updatedByUserId: 'demo',
    };

    return {
      currentPlan: demoPlan,
      usage: {},
      currentMonthUsage: getDefaultUsageSnapshot(),
      billingState,
      billingHooks: [],
    };
  }

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
    readWorkspaceUsageFromServer(input.workspaceId),
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
