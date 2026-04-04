import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getWorkspaceAsync: vi.fn(),
  isUserInWorkspaceAsync: vi.fn(),
  getTenantAsync: vi.fn(),
}));

import { workspaceContextMiddleware } from '../../src/middleware/workspaceContext';
import { getTenantAsync, getWorkspaceAsync, isUserInWorkspaceAsync } from '../../src/services/admin/workspaceStore';

function createRequest(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = {
    'x-workspace-id': 'ws-1',
  };

  return {
    header: (name: string) => headers[name.toLowerCase()] || headers[name],
    params: {},
    query: {},
    body: {},
    userId: 'user-1',
    ...overrides,
  } as unknown as Request;
}

function createResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

async function runMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  workspaceContextMiddleware(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
}

describe('tenant isolation middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects request without workspaceId', async () => {
    const req = createRequest({
      header: () => undefined,
      params: {},
      query: {},
      body: {},
    } as Partial<Request>);
    const res = createResponse();
    const next = vi.fn();

    await runMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request when workspace does not exist', async () => {
    vi.mocked(getWorkspaceAsync).mockResolvedValue(undefined);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    await runMiddleware(req, res, next);

    expect(getWorkspaceAsync).toHaveBeenCalledWith('ws-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request when user is not a workspace member', async () => {
    vi.mocked(getWorkspaceAsync).mockResolvedValue({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      plan: 'free',
      entitlements: {
        limits: { transactionsPerMonth: 10, aiQueriesPerMonth: 10, bankConnections: 1 },
        features: [],
      },
    } as Awaited<ReturnType<typeof getWorkspaceAsync>>);
    vi.mocked(isUserInWorkspaceAsync).mockResolvedValue(false);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    await runMiddleware(req, res, next);

    expect(isUserInWorkspaceAsync).toHaveBeenCalledWith('user-1', 'ws-1');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('injects tenant and workspace context when user is authorized', async () => {
    vi.mocked(getWorkspaceAsync).mockResolvedValue({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      plan: 'pro',
      entitlements: {
        limits: { transactionsPerMonth: 1000, aiQueriesPerMonth: 100, bankConnections: 10 },
        features: ['advancedInsights'],
      },
    } as Awaited<ReturnType<typeof getWorkspaceAsync>>);
    vi.mocked(isUserInWorkspaceAsync).mockResolvedValue(true);
    vi.mocked(getTenantAsync).mockResolvedValue({
      tenantId: 'tenant-1',
      name: 'Tenant 1',
      plan: 'pro',
      ownerUserId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Awaited<ReturnType<typeof getTenantAsync>>);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    await runMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { tenantId?: string }).tenantId).toBe('tenant-1');
    expect((req as Request & { workspaceId?: string }).workspaceId).toBe('ws-1');
  });
});
