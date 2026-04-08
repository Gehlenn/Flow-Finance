import { beforeEach, describe, expect, it, vi } from 'vitest';

const integrationMocks = vi.hoisted(() => ({
  appendDomainEvent: vi.fn(),
  recordAuditEvent: vi.fn(),
  getWorkspaceAsync: vi.fn(),
  pushSyncItems: vi.fn(),
  hasProcessedExternalEvent: vi.fn(),
  markExternalEventProcessed: vi.fn(),
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
});