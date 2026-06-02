import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditLogMocks = vi.hoisted(() => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logError: (...args: unknown[]) => auditLogMocks.logError(...args),
  logInfo: (...args: unknown[]) => auditLogMocks.logInfo(...args),
  logWarn: (...args: unknown[]) => auditLogMocks.logWarn(...args),
}));

describe('auditLogService observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('logs contextual data when an audit event is recorded', async () => {
    const { logAuditEvent, getAuditLogs } = await import('../../src/security/auditLogService');

    logAuditEvent('transaction_created', 'financial_event', 'tx-1', { source: 'test' });

    expect(getAuditLogs()).toHaveLength(1);
    expect(auditLogMocks.logInfo).toHaveBeenCalledWith(
      '[Audit] recorded event',
      expect.objectContaining({
        eventType: 'transaction_created',
        entity: 'financial_event',
        entityId: 'tx-1',
        fallback: 'audit-log-event-recorded',
      }),
    );
  });
});
