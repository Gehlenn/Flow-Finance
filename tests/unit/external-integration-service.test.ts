import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendDomainEventMock = vi.fn();
const recordAuditEventMock = vi.fn();
const getWorkspaceAsyncMock = vi.fn();
const pushSyncItemsMock = vi.fn();

vi.mock('../../backend/src/services/finance/eventStore', () => ({
  appendDomainEvent: appendDomainEventMock,
}));

vi.mock('../../backend/src/services/admin/auditLog', () => ({
  recordAuditEvent: recordAuditEventMock,
}));

vi.mock('../../backend/src/services/admin/workspaceStore', () => ({
  getWorkspaceAsync: getWorkspaceAsyncMock,
}));

vi.mock('../../backend/src/services/sync/cloudSyncStore', () => ({
  pushSyncItems: pushSyncItemsMock,
}));

import { processExternalIntegrationEvent } from '../../backend/src/services/externalIntegrationService';
import { resetExternalIdempotencyStoreForTests } from '../../backend/src/services/externalIdempotencyStore';

describe('processExternalIntegrationEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetExternalIdempotencyStoreForTests();
    getWorkspaceAsyncMock.mockResolvedValue({
      workspaceId: 'ws_1',
      tenantId: 'tenant_1',
    });
    appendDomainEventMock.mockResolvedValue({ id: 'domain_event_1' });
    pushSyncItemsMock.mockResolvedValue({ upserted: 1, deleted: 0, latestServerUpdatedAt: new Date().toISOString(), reconciledIds: [] });
  });

  it('applies payment_received and creates transaction reflection', async () => {
    const result = await processExternalIntegrationEvent({
      eventType: 'payment_received',
      externalEventId: 'evt_1',
      sourceSystem: 'consultorio-core',
      workspaceId: 'ws_1',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'cust_1',
        externalReceivableId: 'recv_1',
        amount: 250,
        currency: 'BRL',
        description: 'Pagamento',
      },
    });

    expect(result.status).toBe('applied');
    expect(result.operation).toBe('transaction_created');
    expect(pushSyncItemsMock).toHaveBeenCalledTimes(1);
    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
  });

  it('returns duplicate for already processed events', async () => {
    const payload = {
      eventType: 'expense_recorded' as const,
      externalEventId: 'evt_dup',
      sourceSystem: 'consultorio-core',
      workspaceId: 'ws_1',
      occurredAt: new Date().toISOString(),
      payload: {
        externalExpenseId: 'exp_1',
        amount: 99,
        currency: 'BRL' as const,
        description: 'Despesa',
      },
    };

    const first = await processExternalIntegrationEvent(payload);
    const second = await processExternalIntegrationEvent(payload);

    expect(first.status).toBe('applied');
    expect(second.status).toBe('duplicate');
    expect(pushSyncItemsMock).toHaveBeenCalledTimes(1);
  });

  it('applies reminder events as operational reflection in domain events', async () => {
    const result = await processExternalIntegrationEvent({
      eventType: 'receivable_reminder_created',
      externalEventId: 'evt_rem_1',
      sourceSystem: 'consultorio-core',
      workspaceId: 'ws_1',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'cust_1',
        externalReceivableId: 'recv_1',
        dueDate: new Date().toISOString(),
        outstandingAmount: 120,
        currency: 'BRL',
        description: 'Criar lembrete',
      },
    });

    expect(result.status).toBe('applied');
    expect(result.operation).toBe('reminder_created');
    expect(appendDomainEventMock).toHaveBeenCalled();
  });
});
