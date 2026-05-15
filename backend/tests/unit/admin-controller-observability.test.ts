import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  getAuditEvents: vi.fn(),
  isPostgresStateStoreEnabled: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mocks.loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  getAuditEvents: mocks.getAuditEvents,
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: mocks.isPostgresStateStoreEnabled,
  queryAuditEvents: vi.fn(),
  queryWorkspaceMeteringSummary: vi.fn(),
  queryWorkspaceUsageEvents: vi.fn(),
}));

import { listAuditLogs } from '../../src/admin/adminController';

type MockRes = {
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
};

function makeRes() {
  const res = {} as MockRes;
  res.json = vi.fn();
  res.setHeader = vi.fn();
  return res;
}

describe('adminController observability', () => {
  it('registra contexto quando o cursor de auditoria nao pode ser decodificado', async () => {
    mocks.isPostgresStateStoreEnabled.mockReturnValue(false);
    mocks.getAuditEvents.mockReturnValue([
      { id: 'evt-1', at: '2026-05-10T00:00:00.000Z', action: 'audit.test' },
    ]);

    const req = {
      query: { cursor: 'invalid-cursor' },
      workspaceId: 'workspace-1',
      tenantId: 'tenant-1',
    } as unknown as Request;
    const res = makeRes();

    await listAuditLogs(req, res as Response, vi.fn());

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        cursor: 'invalid-cursor',
        cursorLength: 'invalid-cursor'.length,
        fallback: 'admin-cursor-decode-failed',
      }),
      'Cursor decode failed',
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.any(Array),
        nextCursor: expect.any(String),
      }),
    );
  });
});
