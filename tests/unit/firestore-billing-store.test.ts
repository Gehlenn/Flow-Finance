import { beforeEach, describe, expect, it, vi } from 'vitest';

const billingMocks = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(),
  generatedId: { value: 0 },
  writeAuditLogEventMock: vi.fn().mockResolvedValue(undefined),
  isFirebaseConfigured: { value: true },
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  get isFirebaseConfigured() {
    return billingMocks.isFirebaseConfigured.value;
  },
}));

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  writeAuditLogEvent: billingMocks.writeAuditLogEventMock,
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

import {
  getWorkspaceBillingOverview,
  listWorkspaceBillingHooks,
  readWorkspaceUsage,
  updateWorkspacePlan,
} from '../../src/services/firestoreBillingStore';

describe('firestoreBillingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingMocks.generatedId.value = 0;
    billingMocks.isFirebaseConfigured.value = true;
  });

  it('reads billing overview from Firestore collections', async () => {
    billingMocks.getDocMock
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ workspaceId: 'ws-1', tenantId: 'tenant-1', plan: 'pro', status: 'active', updatedAt: '2026-04-02T00:00:00.000Z', updatedByUserId: 'user-1' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ usage: { '2026-04': { transactions: 4, aiQueries: 2, bankConnections: 1 } } }),
      });

    billingMocks.getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({ id: 'hook-1', tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-1', plan: 'pro', event: 'plan_changed', resource: 'transactions', amount: 0, at: '2026-04-02T00:00:00.000Z', createdAt: '2026-04-02T00:00:00.000Z' }),
        },
      ],
    });

    const overview = await getWorkspaceBillingOverview({ tenantId: 'tenant-1', workspaceId: 'ws-1' });

    expect(overview.currentPlan).toBe('pro');
    expect(overview.currentMonthUsage.transactions).toBe(4);
    expect(overview.billingHooks).toHaveLength(1);
  });

  it('updates the workspace plan and writes audit data', async () => {
    await updateWorkspacePlan({
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      plan: 'pro',
    });

    expect(billingMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1/billing_state/current' }),
      expect.objectContaining({ plan: 'pro' }),
      { merge: true },
    );
    expect(billingMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1' }),
      expect.objectContaining({ plan: 'pro' }),
      { merge: true },
    );
    expect(billingMocks.writeAuditLogEventMock).toHaveBeenCalled();
  });

  it('returns safe defaults when Firebase billing is not configured', async () => {
    billingMocks.isFirebaseConfigured.value = false;

    await expect(readWorkspaceUsage('ws-1')).resolves.toEqual({});
    await expect(listWorkspaceBillingHooks({ workspaceId: 'ws-1' })).resolves.toEqual([]);
    await expect(getWorkspaceBillingOverview({ tenantId: 'tenant-1', workspaceId: 'ws-1' })).resolves.toEqual(
      expect.objectContaining({
        currentPlan: 'free',
        currentMonthUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
        billingHooks: [],
      }),
    );
  });
});
