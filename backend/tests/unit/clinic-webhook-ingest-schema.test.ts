import { describe, expect, it } from 'vitest';
import { ClinicWebhookIngestSchema } from '../../src/validation/clinicAutomation.schema';

describe('ClinicWebhookIngestSchema', () => {
  it('normaliza envelope v1 payment_received para payload interno legado', () => {
    const envelope = {
      schemaVersion: '1.0',
      sourceSystem: 'clinic-automation',
      workspaceId: 'workspace-clinic-01',
      externalEventId: 'evt_v1_001',
      eventType: 'payment_received',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'customer_123',
        externalReceivableId: 'recv_123',
        amount: 199.9,
        currency: 'BRL',
        description: 'Pagamento da consulta',
      },
    };

    const result = ClinicWebhookIngestSchema.safeParse(envelope);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toMatchObject({
      type: 'payment_received',
      externalEventId: 'evt_v1_001',
      externalPatientId: 'customer_123',
      externalFacilityId: 'workspace-clinic-01',
      amount: 199.9,
      currency: 'BRL',
      description: 'Pagamento da consulta',
    });
  });

  it('rejeita envelope v1 sem schemaVersion', () => {
    const envelope = {
      sourceSystem: 'clinic-automation',
      workspaceId: 'workspace-clinic-01',
      externalEventId: 'evt_v1_002',
      eventType: 'payment_received',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'customer_123',
        externalReceivableId: 'recv_123',
        amount: 100,
        currency: 'BRL',
        description: 'Pagamento',
      },
    };

    const result = ClinicWebhookIngestSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });
});
