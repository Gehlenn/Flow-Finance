import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceSessionMocks = vi.hoisted(() => ({
  ensureActiveWorkspaceMock: vi.fn(),
  getCurrentWorkspaceIdentityMock: vi.fn(),
}));

const apiConfigMocks = vi.hoisted(() => ({
  getAuthHeadersMock: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
}));

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: workspaceSessionMocks.ensureActiveWorkspaceMock,
  getCurrentWorkspaceIdentity: workspaceSessionMocks.getCurrentWorkspaceIdentityMock,
}));

vi.mock('../../src/config/api.config', () => ({
  getAuthHeaders: apiConfigMocks.getAuthHeadersMock,
}));

import { createHttpBillingTransport, createHttpUsageStoreAdapter } from '../../src/saas/httpAdapters';

describe('httpAdapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceSessionMocks.ensureActiveWorkspaceMock.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1' });
    workspaceSessionMocks.getCurrentWorkspaceIdentityMock.mockReturnValue({ userId: 'user-1' });
  });

  it('throws on failed usage writes instead of pretending the sync succeeded', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const adapter = createHttpUsageStoreAdapter('https://api.flow-finance.test');

    await expect(adapter.write({
      '2026-05': { transactions: 1, aiQueries: 0, bankConnections: 0 },
    })).rejects.toThrow('Usage transport failed: 500');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.flow-finance.test/api/saas/usage',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          workspaceId: 'ws-1',
          usage: {
            '2026-05': { transactions: 1, aiQueries: 0, bankConnections: 0 },
          },
        }),
      }),
    );
  });

  it('uses the active workspace id when billing payload omits one', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const transport = createHttpBillingTransport('https://api.flow-finance.test/api/billing/hooks');

    await transport({
      userId: 'user-1',
      workspaceId: '',
      plan: 'pro',
      event: 'plan_changed',
      resource: 'transactions',
      amount: 0,
      at: '2026-05-08T00:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.flow-finance.test/api/billing/hooks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-1',
          workspaceId: 'ws-1',
          plan: 'pro',
          event: 'plan_changed',
          resource: 'transactions',
          amount: 0,
          at: '2026-05-08T00:00:00.000Z',
        }),
      }),
    );
  });

  it('normalizes malformed usage payloads to an empty record', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        usage: {
          '2026-05': null,
          '2026-06': { transactions: '3', aiQueries: 2, bankConnections: 1 },
          '2026-07': 'broken',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const adapter = createHttpUsageStoreAdapter('https://api.flow-finance.test');
    await expect(adapter.read()).resolves.toEqual({
      '2026-06': { transactions: 3, aiQueries: 2, bankConnections: 1 },
    });
  });
});
