import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessIntegrationMocks = vi.hoisted(() => ({
  getWorkspaceAsync: vi.fn(),
  pullSyncItems: vi.fn(),
  pushSyncItems: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getWorkspaceAsync: businessIntegrationMocks.getWorkspaceAsync,
}));

vi.mock('../../src/services/sync/cloudSyncStore', () => ({
  pullSyncItems: businessIntegrationMocks.pullSyncItems,
  pushSyncItems: businessIntegrationMocks.pushSyncItems,
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  recordAuditEvent: businessIntegrationMocks.recordAuditEvent,
}));

import {
  ingestIntegrationReminder,
  ingestIntegrationTransaction,
} from '../../src/services/businessIntegrationService';

function emptyPullState() {
  return {
    since: null,
    serverTime: new Date().toISOString(),
    entities: {
      accounts: [],
      transactions: [],
      goals: [],
      reminders: [],
      subscriptions: [],
    },
  };
}

describe('businessIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    businessIntegrationMocks.getWorkspaceAsync.mockResolvedValue({ workspaceId: 'ws_123', tenantId: 'tenant_123' });
    businessIntegrationMocks.pullSyncItems.mockResolvedValue(emptyPullState());
    businessIntegrationMocks.pushSyncItems.mockResolvedValue({ upserted: 1, deleted: 0, latestServerUpdatedAt: new Date().toISOString(), reconciledIds: [] });
  });

  it('creates a confirmed transaction as synced transaction payload', async () => {
    const result = await ingestIntegrationTransaction({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      type: 'income',
      amount: 250,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento confirmado',
      status: 'confirmed',
    });

    expect(result.action).toBe('created');
    expect(result.storedAs).toBe('transactions');
    expect(businessIntegrationMocks.pushSyncItems).toHaveBeenCalledWith(
      'ws_123',
      'transactions',
      [expect.objectContaining({ payload: expect.objectContaining({ type: 'Receita', amount: 250 }) })],
      expect.objectContaining({ workspaceId: 'ws_123' }),
    );
  });

  it('materializes pending receivable as reminder to avoid confirmed cash inflation', async () => {
    const result = await ingestIntegrationTransaction({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_2',
      type: 'receivable',
      amount: 500,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      dueAt: '2026-04-15T14:30:00.000Z',
      description: 'Recebivel em aberto',
      status: 'pending',
    });

    expect(result.entity).toBe('reminder');
    expect(result.storedAs).toBe('reminders');
    expect(businessIntegrationMocks.pushSyncItems).toHaveBeenCalledWith(
      'ws_123',
      'reminders',
      [expect.objectContaining({ payload: expect.objectContaining({ integration_status: 'pending', amount: 500 }) })],
      expect.objectContaining({ workspaceId: 'ws_123' }),
    );
  });

  it('returns replayed and does not write again when payload is identical', async () => {
    const first = await ingestIntegrationTransaction({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_replay',
      type: 'income',
      amount: 300,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento replay',
      status: 'confirmed',
    });

    const createdItem = businessIntegrationMocks.pushSyncItems.mock.calls[0][2][0];
    businessIntegrationMocks.pullSyncItems.mockResolvedValue({
      ...emptyPullState(),
      entities: {
        ...emptyPullState().entities,
        transactions: [{
          id: createdItem.id,
          serverUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payload: createdItem.payload,
        }],
      },
    });

    const replay = await ingestIntegrationTransaction({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_replay',
      type: 'income',
      amount: 300,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento replay',
      status: 'confirmed',
    });

    expect(first.action).toBe('created');
    expect(replay.action).toBe('replayed');
    expect(businessIntegrationMocks.pushSyncItems).toHaveBeenCalledTimes(1);
  });

  it('updates without duplicating when same external record changes', async () => {
    const existingPayload = {
      id: 'existing-id',
      user_id: 'integration:n8n_ops',
      workspace_id: 'ws_123',
      amount: 100,
      type: 'Receita',
      category: 'Negócio',
      description: 'Pagamento antigo',
      date: '2026-04-09T14:30:00.000Z',
      source: 'import',
      confidence_score: 1,
      integration_status: 'confirmed',
      integration_type: 'income',
      source_system: 'n8n_ops',
      external_record_id: 'txn_update',
    };

    const seed = await ingestIntegrationTransaction({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_update',
      type: 'income',
      amount: 100,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento antigo',
      status: 'confirmed',
    });

    businessIntegrationMocks.pullSyncItems.mockResolvedValue({
      ...emptyPullState(),
      entities: {
        ...emptyPullState().entities,
        transactions: [{
          id: businessIntegrationMocks.pushSyncItems.mock.calls[0][2][0].id,
          serverUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payload: existingPayload,
        }],
      },
    });

    const result = await ingestIntegrationTransaction({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_update',
      type: 'income',
      amount: 150,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento atualizado',
      status: 'confirmed',
    });

    expect(seed.action).toBe('created');
    expect(result.action).toBe('updated');
    expect(businessIntegrationMocks.pushSyncItems).toHaveBeenCalledTimes(2);
  });

  it('upserts reminders without duplicating', async () => {
    const result = await ingestIntegrationReminder({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'rem_1',
      title: 'Pagar fornecedor',
      remindAt: '2026-04-10T10:00:00.000Z',
      kind: 'financial',
      status: 'active',
      priority: 'high',
    });

    expect(result.action).toBe('created');
    expect(result.storedAs).toBe('reminders');
    expect(businessIntegrationMocks.pushSyncItems).toHaveBeenCalledWith(
      'ws_123',
      'reminders',
      [expect.objectContaining({ payload: expect.objectContaining({ title: 'Pagar fornecedor', priority: 'alta' }) })],
      expect.objectContaining({ workspaceId: 'ws_123' }),
    );
  });
});
