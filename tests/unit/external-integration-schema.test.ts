import { describe, expect, it } from 'vitest';
import { ExternalIntegrationEventSchema } from '../../backend/src/validation/externalIntegration.schema';

describe('ExternalIntegrationEventSchema', () => {
  it('accepts payment_received payload contract', () => {
    const result = ExternalIntegrationEventSchema.safeParse({
      eventType: 'payment_received',
      externalEventId: 'evt_1',
      sourceSystem: 'consultorio-core',
      workspaceId: 'ws_1',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'cust_1',
        externalReceivableId: 'recv_1',
        amount: 500,
        currency: 'BRL',
        description: 'Pagamento confirmado',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown fields to avoid unsafe free-form payloads', () => {
    const result = ExternalIntegrationEventSchema.safeParse({
      eventType: 'payment_received',
      externalEventId: 'evt_1',
      sourceSystem: 'consultorio-core',
      workspaceId: 'ws_1',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'cust_1',
        externalReceivableId: 'recv_1',
        amount: 500,
        currency: 'BRL',
        description: 'Pagamento confirmado',
        cpf: '00000000000',
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts receivable reminder contracts', () => {
    const result = ExternalIntegrationEventSchema.safeParse({
      eventType: 'receivable_reminder_updated',
      externalEventId: 'evt_2',
      sourceSystem: 'consultorio-core',
      workspaceId: 'ws_1',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'cust_1',
        externalReceivableId: 'recv_1',
        dueDate: new Date().toISOString(),
        outstandingAmount: 120,
        currency: 'BRL',
        description: 'Saldo pendente atualizado',
      },
    });

    expect(result.success).toBe(true);
  });
});
