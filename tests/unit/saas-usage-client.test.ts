import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiConfigMocks = vi.hoisted(() => ({
  getAuthHeadersMock: vi.fn(({ workspaceId }: { workspaceId?: string } = {}) => ({
    Authorization: 'Bearer test-token',
    ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
  })),
}));

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: { SAAS: { USAGE: 'https://api.flow-finance.test/api/saas/usage' } },
  getAuthHeaders: apiConfigMocks.getAuthHeadersMock,
}));

import {
  getCurrentMonthKey,
  readWorkspaceUsageFromServer,
} from '../../src/services/saasUsageClient';

describe('saasUsageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the typed server-side snapshot and drops malformed months', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scope: 'workspace',
        workspaceId: 'ws-1',
        usage: {
          '2026-05': null,
          '2026-06': { transactions: '3', aiQueries: 'invalid', bankConnections: 1 },
          '2026-07': 'broken',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(readWorkspaceUsageFromServer('ws-1')).resolves.toEqual({
      '2026-06': { transactions: 3, aiQueries: 0, bankConnections: 1 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.flow-finance.test/api/saas/usage',
      expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer test-token', 'x-workspace-id': 'ws-1' } }),
    );
  });

  it('does not issue a request without a workspace and surfaces failed server reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(readWorkspaceUsageFromServer('')).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(readWorkspaceUsageFromServer('ws-1')).rejects.toThrow('Usage read failed: 503');
  });

  it('uses the local calendar month for usage aggregation', () => {
    expect(getCurrentMonthKey(new Date(2026, 3, 30, 23, 59))).toBe('2026-04');
    expect(getCurrentMonthKey(new Date(2026, 4, 1, 0, 0))).toBe('2026-05');
  });
});
