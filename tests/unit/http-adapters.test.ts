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

import { createHttpBillingTransport } from '../../src/saas/httpAdapters';

describe('httpAdapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceSessionMocks.ensureActiveWorkspaceMock.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1' });
    workspaceSessionMocks.getCurrentWorkspaceIdentityMock.mockReturnValue({ userId: 'user-1' });
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

});
