import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const persistenceMocks = vi.hoisted(() => ({
  isPostgresStateStoreEnabled: vi.fn(),
  queryAuditEvents: vi.fn(),
  queryWorkspaceMeteringSummary: vi.fn(),
  queryWorkspaceUsageEvents: vi.fn(),
}));

vi.mock('../../backend/src/services/persistence/postgresStateStore', () => persistenceMocks);
vi.mock('../../backend/src/services/admin/workspaceStore', () => ({
  getWorkspaceUsers: vi.fn(() => []),
}));

async function loadControllerModule() {
  vi.resetModules();
  return import('../../backend/src/admin/adminController');
}

function createResponseMock() {
  const response = {
    json: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
  } as unknown as Response;

  return response;
}

async function runHandler(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>,
  res: Response,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    handler(req as Request, res, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });

    setTimeout(resolve, 0);
  });
}

describe('adminController Postgres read path', () => {
  beforeEach(() => {
    persistenceMocks.isPostgresStateStoreEnabled.mockReset();
    persistenceMocks.queryAuditEvents.mockReset();
    persistenceMocks.queryWorkspaceMeteringSummary.mockReset();
    persistenceMocks.queryWorkspaceUsageEvents.mockReset();
  });

  it('listAuditLogs prefers Postgres when the state store is enabled', async () => {
    const controllerModule = await loadControllerModule();
    persistenceMocks.isPostgresStateStoreEnabled.mockReturnValue(true);
    persistenceMocks.queryAuditEvents.mockResolvedValue([
      {
        id: 'audit-1',
        at: '2026-03-31T12:00:00.000Z',
        action: 'billing.plan_changed',
        status: 'success',
        resource: 'ws-1',
      },
    ]);

    const req = {
      workspaceId: 'ws-1',
      query: {},
    } as Partial<Request>;
    const res = createResponseMock();

    await runHandler(controllerModule.listAuditLogs, req, res);

    expect(persistenceMocks.queryAuditEvents).toHaveBeenCalledWith({
      resource: 'ws-1',
      resourceId: undefined,
      resourceType: undefined,
      tenantId: undefined,
      workspaceId: 'ws-1',
      limit: undefined,
      since: undefined,
      until: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({
      items: [
        {
          id: 'audit-1',
          at: '2026-03-31T12:00:00.000Z',
          action: 'billing.plan_changed',
          status: 'success',
          resource: 'ws-1',
        },
      ],
      nextCursor: expect.any(String),
    });
  });

  it('listUsageMetering prefers Postgres summary and event queries when enabled', async () => {
    const controllerModule = await loadControllerModule();
    persistenceMocks.isPostgresStateStoreEnabled.mockReturnValue(true);
    persistenceMocks.queryWorkspaceMeteringSummary.mockResolvedValue({
      totals: { transactions: 4, aiQueries: 6, bankConnections: 1 },
      months: {
        '2026-03': { transactions: 4, aiQueries: 6, bankConnections: 1 },
      },
    });
    persistenceMocks.queryWorkspaceUsageEvents.mockResolvedValue([
      {
        id: 'usage-1',
        workspaceId: 'ws-1',
        userId: 'owner-1',
        resource: 'aiQueries',
        amount: 6,
        at: '2026-03-31T12:00:00.000Z',
      },
    ]);

    const req = {
      workspaceId: 'ws-1',
      query: {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T23:59:59.999Z',
      },
    } as Partial<Request>;
    const res = createResponseMock();

    await runHandler(controllerModule.listUsageMetering, req, res);

    expect(persistenceMocks.queryWorkspaceMeteringSummary).toHaveBeenCalledWith('ws-1', {
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
      resource: undefined,
    });
    expect(persistenceMocks.queryWorkspaceUsageEvents).toHaveBeenCalledWith('ws-1', {
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
      resource: undefined,
      limit: 100,
    });
    expect(res.json).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      filters: {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T23:59:59.999Z',
        resource: undefined,
      },
      summary: {
        totals: { transactions: 4, aiQueries: 6, bankConnections: 1 },
        months: {
          '2026-03': { transactions: 4, aiQueries: 6, bankConnections: 1 },
        },
      },
      events: [
        {
          id: 'usage-1',
          workspaceId: 'ws-1',
          userId: 'owner-1',
          resource: 'aiQueries',
          amount: 6,
          at: '2026-03-31T12:00:00.000Z',
        },
      ],
      nextCursor: expect.any(String),
    });
  });
});
