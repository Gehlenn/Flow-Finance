import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertAuditEvent: vi.fn(),
  loadRecentAuditEvents: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  insertAuditEvent: mocks.insertAuditEvent,
  loadRecentAuditEvents: mocks.loadRecentAuditEvents,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mocks.loggerWarn,
  },
}));

import {
  recordAuditEvent,
  resetAuditLogForTests,
} from '../../src/services/admin/auditLog';

describe('audit log persistence observability', () => {
  beforeEach(() => {
    mocks.insertAuditEvent.mockReset();
    mocks.loadRecentAuditEvents.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.insertAuditEvent.mockResolvedValue(undefined);
    mocks.loadRecentAuditEvents.mockResolvedValue([]);
    resetAuditLogForTests();
  });

  it('keeps the in-memory event and logs a failed durable write', async () => {
    const persistenceError = new Error('postgres audit write failed');
    mocks.insertAuditEvent.mockRejectedValueOnce(persistenceError);

    const event = recordAuditEvent({
      action: 'security.forbidden',
      status: 'blocked',
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
    });

    await vi.waitFor(() => {
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: persistenceError,
          eventId: event.id,
          action: 'security.forbidden',
          status: 'blocked',
          tenantId: 'tenant-1',
          workspaceId: 'workspace-1',
          fallback: 'audit-log-postgres-write-failed',
        }),
        'Failed to persist audit event; in-memory buffer remains active',
      );
    });
  });
});
