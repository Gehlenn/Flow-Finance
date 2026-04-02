import { describe, expect, it, vi, beforeEach } from 'vitest';

const adapterMocks = vi.hoisted(() => ({
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  incrementWorkspaceUsage: vi.fn(),
  readWorkspaceUsage: vi.fn(),
  recordWorkspaceBillingHook: vi.fn(),
  resetWorkspaceUsage: vi.fn(),
  writeWorkspaceUsage: vi.fn(),
}));

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: adapterMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: adapterMocks.getCurrentWorkspaceIdentity,
}));

vi.mock('../../src/services/firestoreBillingStore', () => ({
  incrementWorkspaceUsage: adapterMocks.incrementWorkspaceUsage,
  readWorkspaceUsage: adapterMocks.readWorkspaceUsage,
  recordWorkspaceBillingHook: adapterMocks.recordWorkspaceBillingHook,
  resetWorkspaceUsage: adapterMocks.resetWorkspaceUsage,
  writeWorkspaceUsage: adapterMocks.writeWorkspaceUsage,
}));

import {
  createFirestoreBillingTransport,
  createFirestoreUsageStoreAdapter,
} from '../../src/saas/firestoreAdapters';

describe('firestore SaaS adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapterMocks.getCurrentWorkspaceIdentity.mockReturnValue({
      userId: 'user-1',
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
    });
    adapterMocks.ensureActiveWorkspace.mockResolvedValue({
      userId: 'user-1',
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Workspace 1',
      role: 'admin',
    });
  });

  it('hydrates usage through the active workspace context', async () => {
    adapterMocks.readWorkspaceUsage.mockResolvedValue({
      '2026-04': { transactions: 3, aiQueries: 2, bankConnections: 1 },
    });

    const adapter = createFirestoreUsageStoreAdapter();
    const usage = await adapter.read();

    expect(adapterMocks.ensureActiveWorkspace).toHaveBeenCalled();
    expect(adapterMocks.readWorkspaceUsage).toHaveBeenCalledWith('ws-1');
    expect(usage['2026-04']).toEqual({
      transactions: 3,
      aiQueries: 2,
      bankConnections: 1,
    });
  });

  it('records billing hooks with resolved tenant and workspace ids', async () => {
    const transport = createFirestoreBillingTransport();

    await transport({
      userId: 'user-1',
      plan: 'pro',
      event: 'plan_changed',
      resource: 'transactions',
      amount: 0,
      at: '2026-04-02T00:00:00.000Z',
      metadata: { source: 'test' },
    });

    expect(adapterMocks.recordWorkspaceBillingHook).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      payload: expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'ws-1',
        plan: 'pro',
        event: 'plan_changed',
      }),
    });
  });
});
