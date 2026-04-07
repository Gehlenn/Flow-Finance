import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/externalIntegrationService', () => ({
  processExternalIntegrationEvent: vi.fn(),
}));

import { ClinicAutomationService } from '../../src/services/clinic/ClinicAutomationService';
import { processExternalIntegrationEvent } from '../../src/services/externalIntegrationService';

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persiste payment_received via pipeline externo quando auto-post esta habilitado', async () => {
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

    vi.mocked(processExternalIntegrationEvent).mockResolvedValue({
      status: 'applied',
      eventType: 'payment_received',
      externalEventId: 'evt_payment_1',
      workspaceId: 'workspace_clinic_1',
      operation: 'transaction_created',
    });

    const service = new ClinicAutomationService(logger, redis, monitor, featureFlags);
    const payload = {
      type: 'payment_received',
      externalEventId: 'evt_payment_1',
      externalPatientId: 'patient_1',
      externalFacilityId: 'workspace_clinic_1',
      amount: 100,
      currency: 'BRL',
      date: new Date().toISOString(),
      paymentMethod: 'pix',
      description: 'Consulta',
      notes: 'Pago no caixa',
    };

    const result = await service.processWebhookEvent(payload as any, '', '127.0.0.1', {
      environment: 'development',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('transaction_created');
    expect(processExternalIntegrationEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'payment_received',
      workspaceId: 'workspace_clinic_1',
      payload: expect.objectContaining({
        externalCustomerId: 'patient_1',
        externalReceivableId: 'evt_payment_1',
        notes: 'Pago no caixa',
      }),
    }));
  });

  it('retorna falha controlada quando externalFacilityId nao existe no payload', async () => {
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
    const result = await service.processWebhookEvent({
      type: 'payment_received',
      externalEventId: 'evt_missing_workspace',
      externalPatientId: 'patient_1',
      amount: 100,
      currency: 'BRL',
      date: new Date().toISOString(),
      paymentMethod: 'pix',
      description: 'Consulta',
    } as any, '', '127.0.0.1', {
      environment: 'development',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('externalFacilityId is required');
    expect(processExternalIntegrationEvent).not.toHaveBeenCalled();
  });

  it('bloqueia persistencia quando clinic_automation_auto_post_enabled estiver desligada', async () => {
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
      isEnabled: vi.fn((flagName: string) => {
        if (flagName === 'clinic_automation_auto_post_enabled') {
          return { enabled: false, reason: 'manual kill switch' };
        }

        return { enabled: true, reason: 'enabled' };
      }),
    } as any;

    const service = new ClinicAutomationService(logger, redis, monitor, featureFlags);
    const result = await service.processWebhookEvent({
      type: 'payment_received',
      externalEventId: 'evt_auto_post_blocked',
      externalPatientId: 'patient_1',
      externalFacilityId: 'workspace_clinic_1',
      amount: 100,
      currency: 'BRL',
      date: new Date().toISOString(),
      paymentMethod: 'pix',
      description: 'Consulta',
    } as any, '', '127.0.0.1', {
      environment: 'development',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('auto-post is disabled');
    expect(processExternalIntegrationEvent).not.toHaveBeenCalled();
  });
});
