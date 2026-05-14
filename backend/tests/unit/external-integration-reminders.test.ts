import { beforeEach, describe, expect, it, vi } from 'vitest';

const integrationMocks = vi.hoisted(() => ({
  appendDomainEvent: vi.fn(),
  recordAuditEvent: vi.fn(),
  getWorkspaceAsync: vi.fn(),
  pushSyncItems: vi.fn(),
  hasProcessedExternalEvent: vi.fn(),
  markExternalEventProcessed: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../src/services/finance/eventStore', () => ({
  appendDomainEvent: integrationMocks.appendDomainEvent,
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  recordAuditEvent: integrationMocks.recordAuditEvent,
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getWorkspaceAsync: integrationMocks.getWorkspaceAsync,
}));

vi.mock('../../src/services/sync/cloudSyncStore', () => ({
  pushSyncItems: integrationMocks.pushSyncItems,
}));

vi.mock('../../src/services/externalIdempotencyStore', () => ({
  hasProcessedExternalEvent: integrationMocks.hasProcessedExternalEvent,
  markExternalEventProcessed: integrationMocks.markExternalEventProcessed,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: integrationMocks.logError,
  },
}));

import { processExternalIntegrationEvent } from '../../src/services/externalIntegrationService';

describe('processExternalIntegrationEvent reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    integrationMocks.getWorkspaceAsync.mockResolvedValue({ workspaceId: 'ws-1', tenantId: 'tenant-1' });
    integrationMocks.hasProcessedExternalEvent.mockReturnValue(false);
    integrationMocks.pushSyncItems.mockResolvedValue({ upserted: 1, deleted: 0, latestServerUpdatedAt: '2026-04-08T00:00:00.000Z', reconciledIds: [] });
    integrationMocks.appendDomainEvent.mockResolvedValue(undefined);
  });

  it('materializes receivable_reminder_created into synced reminders', async () => {
    const result = await processExternalIntegrationEvent({
      eventType: 'receivable_reminder_created',
      externalEventId: 'evt-1',
      sourceSystem: 'clinic-automation',
      workspaceId: 'ws-1',
      occurredAt: '2026-04-08T10:00:00.000Z',
      payload: {
        externalCustomerId: 'customer-1',
        externalReceivableId: 'recv-1',
        dueDate: '2026-04-10',
        outstandingAmount: 250,
        currency: 'BRL',
        description: 'Recebimento consulta',
        serviceDescription: 'Consulta inicial',
      },
    });

    expect(result.operation).toBe('reminder_created');
    expect(integrationMocks.pushSyncItems).toHaveBeenCalledWith(
      'ws-1',
      'reminders',
      [expect.objectContaining({
        id: 'recv-1',
        payload: expect.objectContaining({
          title: 'Consulta inicial',
          amount: 250,
          completed: false,
        }),
      })],
      expect.objectContaining({ workspaceId: 'ws-1' }),
    );
  });

  it('writes a tombstone when receivable_reminder_cleared arrives', async () => {
    const result = await processExternalIntegrationEvent({
      eventType: 'receivable_reminder_cleared',
      externalEventId: 'evt-2',
      sourceSystem: 'clinic-automation',
      workspaceId: 'ws-1',
      occurredAt: '2026-04-08T11:00:00.000Z',
      payload: {
        externalCustomerId: 'customer-1',
        externalReceivableId: 'recv-1',
        clearedAt: '2026-04-08T11:00:00.000Z',
        settledAmount: 250,
        currency: 'BRL',
        description: 'Recebimento consulta',
        reason: 'paid',
      },
    });

    expect(result.operation).toBe('reminder_cleared');
    expect(integrationMocks.pushSyncItems).toHaveBeenCalledWith(
      'ws-1',
      'reminders',
      [expect.objectContaining({
        id: 'recv-1',
        deleted: true,
      })],
      expect.objectContaining({ workspaceId: 'ws-1' }),
    );
  });

  it('logs contextual data when persistence fails before marking the event processed', async () => {
    integrationMocks.pushSyncItems.mockRejectedValueOnce(new Error('sync offline'));

    await expect(processExternalIntegrationEvent({
      eventType: 'receivable_reminder_created',
      externalEventId: 'evt-3',
      sourceSystem: 'clinic-automation',
      workspaceId: 'ws-1',
      occurredAt: '2026-04-08T12:00:00.000Z',
      payload: {
        externalCustomerId: 'customer-1',
        externalReceivableId: 'recv-2',
        dueDate: '2026-04-10',
        outstandingAmount: 250,
        currency: 'BRL',
        description: 'Recebimento consulta',
        serviceDescription: 'Consulta inicial',
      },
    })).rejects.toThrow('sync offline');

    expect(integrationMocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        workspaceId: 'ws-1',
        externalEventId: 'evt-3',
        sourceSystem: 'clinic-automation',
        eventType: 'receivable_reminder_created',
        operation: 'reminder_created',
        fallback: 'external-integration-ingest-failed',
      }),
      'Failed to persist external integration event',
    );
    expect(integrationMocks.markExternalEventProcessed).not.toHaveBeenCalled();
    expect(integrationMocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});
