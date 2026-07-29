import { beforeEach, describe, expect, it, vi } from 'vitest';

const billingMocks = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(),
  generatedId: { value: 0 },
  writeAuditLogEventMock: vi.fn().mockResolvedValue(undefined),
  isFirebaseConfigured: { value: true },
  demoPlan: { value: null as 'free' | 'pro' | null },
  readWorkspaceUsageFromServerMock: vi.fn(),
  apiRequestMock: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  get isFirebaseConfigured() {
    return billingMocks.isFirebaseConfigured.value;
  },
}));

vi.mock('../../src/demo/demoBootstrap', () => ({
  getDemoBootstrapPlan: () => billingMocks.demoPlan.value,
}));

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  writeAuditLogEvent: billingMocks.writeAuditLogEventMock,
}));

vi.mock('../../src/services/saasUsageClient', () => ({
  getCurrentMonthKey: () => '2026-04',
  getDefaultUsageSnapshot: () => ({ transactions: 0, aiQueries: 0, bankConnections: 0 }),
  readWorkspaceUsageFromServer: billingMocks.readWorkspaceUsageFromServerMock,
}));

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: { SAAS: { BILLING_HOOKS: 'https://backend.test/api/saas/billing-hooks' } },
  apiRequest: billingMocks.apiRequestMock,
  getAuthHeaders: ({ workspaceId }: { workspaceId?: string }) => ({
    'Content-Type': 'application/json',
    ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (...segments: unknown[]) => ({ type: 'collection', path: segments.slice(1).join('/') }),
  doc: (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && 'path' in (args[0] as Record<string, unknown>)) {
      billingMocks.generatedId.value += 1;
      return { id: `generated-${billingMocks.generatedId.value}`, path: `${(args[0] as { path: string }).path}/generated-${billingMocks.generatedId.value}` };
    }

    if (args.length === 2 && typeof args[0] === 'object' && args[0] !== null && 'path' in (args[0] as Record<string, unknown>)) {
      return { id: String(args[1]), path: `${(args[0] as { path: string }).path}/${String(args[1])}` };
    }

    const segments = args.slice(1).map(String);
    const id = String(args[args.length - 1]);
    return { id, path: segments.join('/') };
  },
  getDoc: billingMocks.getDocMock,
  getDocs: billingMocks.getDocsMock,
  limit: (...args: unknown[]) => ({ type: 'limit', args }),
  orderBy: (...args: unknown[]) => ({ type: 'orderBy', args }),
  query: (...args: unknown[]) => ({ type: 'query', args }),
  setDoc: billingMocks.setDocMock,
}));

import { getWorkspaceBillingOverview, listWorkspaceBillingHooks } from '../../src/services/firestoreBillingStore';

describe('firestoreBillingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingMocks.generatedId.value = 0;
    billingMocks.isFirebaseConfigured.value = true;
    billingMocks.demoPlan.value = null;
    billingMocks.readWorkspaceUsageFromServerMock.mockResolvedValue({});
    billingMocks.apiRequestMock.mockResolvedValue({ hooks: [] });
  });

  it('uses the workspace plan as the billing authority instead of legacy billing state', async () => {
    billingMocks.getDocMock
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ plan: 'free', updatedAt: '2026-04-03T00:00:00.000Z' }),
      });
    billingMocks.readWorkspaceUsageFromServerMock.mockResolvedValue({
      '2026-04': { transactions: 4, aiQueries: 2, bankConnections: 1 },
    });

    billingMocks.apiRequestMock.mockResolvedValueOnce({
      hooks: [
        { id: 'hook-1', tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-1', plan: 'pro', event: 'plan_changed', resource: 'transactions', amount: 0, at: '2026-04-02T00:00:00.000Z', createdAt: '2026-04-02T00:00:00.000Z' },
      ],
    });

    const overview = await getWorkspaceBillingOverview({ tenantId: 'tenant-1', workspaceId: 'ws-1' });

    expect(overview.currentPlan).toBe('free');
    expect(overview.billingState).toMatchObject({
      plan: 'free',
      updatedAt: '2026-04-03T00:00:00.000Z',
      updatedByUserId: 'system',
    });
    expect(billingMocks.getDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1' }),
    );
    expect(billingMocks.readWorkspaceUsageFromServerMock).toHaveBeenCalledWith('ws-1');
    expect(overview.currentMonthUsage.transactions).toBe(4);
    expect(overview.billingHooks).toHaveLength(1);
  });

  it('keeps workspace usage server-side when Firebase billing is not configured', async () => {
    billingMocks.isFirebaseConfigured.value = false;
    billingMocks.readWorkspaceUsageFromServerMock.mockResolvedValue({
      '2026-04': { transactions: 7, aiQueries: 3, bankConnections: 1 },
    });
    await expect(listWorkspaceBillingHooks({ workspaceId: 'ws-1' })).resolves.toEqual([]);
    await expect(getWorkspaceBillingOverview({ tenantId: 'tenant-1', workspaceId: 'ws-1' })).resolves.toEqual(
      expect.objectContaining({
        currentPlan: 'free',
        currentMonthUsage: { transactions: 7, aiQueries: 3, bankConnections: 1 },
        billingHooks: [], 
      }),
    );
  });

  it('returns safe defaults when billing context is incomplete', async () => {
    await expect(getWorkspaceBillingOverview({ tenantId: '', workspaceId: 'ws-1' })).resolves.toEqual(
      expect.objectContaining({
        currentPlan: 'free',
        currentMonthUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
        billingHooks: [],
      }),
    );

    await expect(listWorkspaceBillingHooks({ workspaceId: '' })).resolves.toEqual([]);
  });

  it('returns a pro billing overview in demo mode without Firestore reads', async () => {
    billingMocks.demoPlan.value = 'pro';

    await expect(getWorkspaceBillingOverview({ tenantId: 'tenant-demo', workspaceId: 'ws-demo' })).resolves.toEqual(
      expect.objectContaining({
        currentPlan: 'pro',
        billingState: expect.objectContaining({
          plan: 'pro',
          updatedByUserId: 'demo',
        }),
        currentMonthUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
        billingHooks: [],
      }),
    );

    expect(billingMocks.getDocMock).not.toHaveBeenCalled();
    expect(billingMocks.apiRequestMock).not.toHaveBeenCalled();
  });
});
