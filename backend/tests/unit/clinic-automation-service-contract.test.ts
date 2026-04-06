import { describe, expect, it, vi } from 'vitest';

import { ClinicAutomationService } from '../../src/services/clinic/ClinicAutomationService';

function createRedisMock() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    setEx: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    keys: vi.fn(async () => Array.from(store.keys())),
    ttl: vi.fn(async () => 60),
    ping: vi.fn(async () => 'PONG'),
  };
}

describe('ClinicAutomationService contract safety', () => {
  it('does not report success for unimplemented payment ingestion', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
    const redis = createRedisMock() as any;
    const monitor = {
      executeClinicWebhookCall: vi.fn(async (_operation: string, callback: () => Promise<unknown>) => callback()),
    } as any;
    const featureFlags = {
      isEnabled: vi.fn(() => ({ enabled: true, reason: 'enabled' })),
    } as any;

    const service = new ClinicAutomationService(logger, redis, monitor, featureFlags);
    const payload = {
      type: 'payment_received',
      externalEventId: 'evt_payment_1',
      externalPatientId: 'patient_1',
      externalFacilityId: 'facility_1',
      amount: 100,
      currency: 'BRL',
      date: new Date().toISOString(),
      paymentMethod: 'pix',
      description: 'Consulta',
    };

    const result = await service.processWebhookEvent(payload as any, '', '127.0.0.1', {
      environment: 'development',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('not implemented');
  });
});
