import { beforeEach, describe, expect, it, vi } from 'vitest';

const addDocMock = vi.fn();
const collectionMock = vi.fn();
const serverTimestampMock = vi.fn(() => 'server-timestamp');
const logInfoMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => addDocMock(...args),
  collection: (...args: unknown[]) => {
    collectionMock(...args);
    return { path: args.slice(1) };
  },
  serverTimestamp: () => serverTimestampMock(),
}));

vi.mock('../../services/firebase', () => ({
  db: { kind: 'firestore-db' },
}));

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

describe('auditLogService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    addDocMock.mockResolvedValue(undefined);
  });

  it('persiste evento no Firestore quando recebe contexto completo', async () => {
    const { logAuditEvent, getAuditLogs } = await import('../../src/security/auditLogService');

    logAuditEvent(
      'transaction_created',
      'financial_event',
      'tx-1',
      { source: 'test' },
      {
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        userId: 'owner-1',
      },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(getAuditLogs()).toHaveLength(1);
    expect(collectionMock).toHaveBeenCalledWith(
      { kind: 'firestore-db' },
      'audit_logs',
      'tenant-1',
      'events',
    );
    expect(addDocMock).toHaveBeenCalledWith(
      { path: ['audit_logs', 'tenant-1', 'events'] },
      expect.objectContaining({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        userId: 'owner-1',
        event_type: 'transaction_created',
        entity: 'financial_event',
        entity_id: 'tx-1',
        action: 'transaction_created',
        resourceType: 'financial_event',
        resourceId: 'tx-1',
        metadata: { source: 'test' },
        createdAt: 'server-timestamp',
      }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      '[Audit] dispatching persistence',
      expect.objectContaining({
        eventType: 'transaction_created',
        workspaceId: 'ws-1',
      }),
    );
  });

  it('mantem cache local e nao tenta persistir sem contexto suficiente', async () => {
    const { logAuditEvent, getAuditLogs } = await import('../../src/security/auditLogService');

    logAuditEvent('transaction_created', 'financial_event', 'tx-1', { source: 'test' });

    expect(getAuditLogs()).toHaveLength(1);
    expect(addDocMock).not.toHaveBeenCalled();
    expect(logInfoMock).toHaveBeenCalledWith(
      '[Audit] recorded event',
      expect.objectContaining({
        persistence: 'local-cache-only',
      }),
    );
  });

  it('engole falha de persistencia e registra erro', async () => {
    addDocMock.mockRejectedValueOnce(new Error('offline'));
    const { logAuditEvent } = await import('../../src/security/auditLogService');

    expect(() => {
      logAuditEvent(
        'transaction_created',
        'financial_event',
        'tx-1',
        { source: 'test' },
        {
          tenantId: 'tenant-1',
          workspaceId: 'ws-1',
          userId: 'owner-1',
        },
      );
    }).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(logErrorMock).toHaveBeenCalledWith(
      '[Audit] failed to persist event',
      expect.any(Error),
      expect.objectContaining({
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
        userId: 'owner-1',
        fallback: 'audit-log-persist-failed',
      }),
    );
  });
});
