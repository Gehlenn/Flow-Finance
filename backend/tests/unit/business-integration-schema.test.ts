import { describe, expect, it } from 'vitest';
import {
  IntegrationReminderSchema,
  IntegrationTransactionSchema,
} from '../../src/validation/businessIntegration.schema';

describe('business integration schemas', () => {
  it('accepts a valid confirmed transaction payload', () => {
    const result = IntegrationTransactionSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      type: 'income',
      amount: 250,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento confirmado',
      status: 'confirmed',
      category: 'servicos',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid reminder payload', () => {
    const result = IntegrationReminderSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'rem_1',
      title: 'Cobrar fornecedor amanha',
      remindAt: '2026-04-10T10:00:00.000Z',
      kind: 'financial',
      status: 'active',
      priority: 'high',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid transaction enum values', () => {
    const result = IntegrationTransactionSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      type: 'credit',
      amount: 250,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento confirmado',
      status: 'confirmed',
    });

    expect(result.success).toBe(false);
  });

  it('rejects forbidden sensitive fields in metadata', () => {
    const result = IntegrationTransactionSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      type: 'income',
      amount: 250,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Pagamento confirmado',
      status: 'confirmed',
      metadata: {
        cpf: '123.456.789-00',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects externalCustomerId containing email/phone/cpf', () => {
    const result = IntegrationReminderSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'rem_1',
      title: 'Lembrete operacional',
      remindAt: '2026-04-10T10:00:00.000Z',
      kind: 'operational',
      status: 'active',
      externalCustomerId: 'cliente@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('rejects income or expense with non-confirmed status', () => {
    const result = IntegrationTransactionSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      type: 'expense',
      amount: 99,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Despesa pendente',
      status: 'pending',
    });

    expect(result.success).toBe(false);
  });

  it('requires dueAt for receivable/payable when pending or overdue', () => {
    const result = IntegrationTransactionSchema.safeParse({
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      type: 'receivable',
      amount: 99,
      currency: 'BRL',
      occurredAt: '2026-04-09T14:30:00.000Z',
      description: 'Recebivel em aberto',
      status: 'overdue',
    });

    expect(result.success).toBe(false);
  });
});
