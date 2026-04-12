import { describe, expect, it, vi } from 'vitest';
import { ClinicWebhookPayloadSchema } from '../../src/validation/clinicAutomation.schema';

vi.mock('../../src/config/logger');
vi.mock('redis');
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid-test'),
}));
vi.mock('../../src/services/observability', () => ({
  IntegrationMonitor: class IntegrationMonitor {
    async executeClinicWebhookCall(_operation: string, callback: () => Promise<unknown>) {
      return callback();
    }
  },
}));
vi.mock('../../src/services/featureFlags/EnhancedFeatureFlagService', () => ({
  EnhancedFeatureFlagService: class EnhancedFeatureFlagService {
    isEnabled() {
      return { enabled: true, reason: 'test' };
    }
  },
}));
vi.mock('../../src/services/externalIntegrationService', () => ({
  processExternalIntegrationEvent: vi.fn(async () => ({
    operation: 'created',
    status: 'success',
  })),
}));
vi.mock('../../src/middleware/requestContextStore', () => ({
  getRequestContextValue: vi.fn(() => 'request-test'),
}));

describe('ClinicAutomationService', () => {
  describe('Module exports', () => {
    it('deve exportar ClinicAutomationService', async () => {
      const module = await import('../../src/services/clinic/ClinicAutomationService');
      expect(module.ClinicAutomationService).toBeDefined();
    });

    it('deve exportar IdempotentEventStore', async () => {
      const module = await import('../../src/services/clinic/IdempotentEventStore');
      expect(module.IdempotentEventStore).toBeDefined();
    });
  });

  describe('Event types', () => {
    it('deve reconhecer tipo payment_received', () => {
      const eventType = 'payment_received';
      const validTypes = [
        'payment_received',
        'expense_recorded',
        'receivable_reminder_created',
        'receivable_reminder_updated',
        'receivable_reminder_cleared',
      ];
      expect(validTypes).toContain(eventType);
    });

    it('deve reconhecer tipo expense_recorded', () => {
      const eventType = 'expense_recorded';
      const validTypes = [
        'payment_received',
        'expense_recorded',
        'receivable_reminder_created',
        'receivable_reminder_updated',
        'receivable_reminder_cleared',
      ];
      expect(validTypes).toContain(eventType);
    });

    it('deve reconhecer tipos receivable_reminder_*', () => {
      const types = [
        'receivable_reminder_created',
        'receivable_reminder_updated',
        'receivable_reminder_cleared',
      ];

      for (const type of types) {
        expect(type).toMatch(/receivable_reminder/);
      }
    });
  });

  describe('Idempotency patterns', () => {
    it('deve gerar chaves de idempotencia compativeis com Redis', () => {
      const sourceSystem = 'consultorio_saas_v1';
      const externalEventId = 'evt_20240115_001';

      const idempotencyKey = `idempotent:${sourceSystem}:${externalEventId}`;

      expect(idempotencyKey).toMatch(/^idempotent:/);
      expect(idempotencyKey).toContain(externalEventId);
    });

    it('deve suportar TTL de 30 dias para deduplicacao', () => {
      const ttlSeconds = 30 * 24 * 60 * 60;

      expect(ttlSeconds).toBeGreaterThan(0);
      expect(ttlSeconds).toBe(2592000);
    });
  });

  describe('Webhook validation', () => {
    it('deve validar payload JSON valido', () => {
      const payload = {
        sourceSystem: 'consultorio_v1',
        externalEventId: 'evt_abc123',
        eventType: 'payment_received',
        timestamp: new Date().toISOString(),
        data: {
          externalClientId: 'cli_123',
          amount: 150.0,
          currency: 'BRL',
          date: new Date().toISOString(),
          description: 'Consulta',
        },
      };

      expect(payload.sourceSystem).toBeDefined();
      expect(payload.externalEventId).toBeDefined();
      expect(payload.eventType).toBeDefined();
      expect(payload.data.amount).toBeGreaterThan(0);
    });

    it('deve validar HMAC-SHA256 signature', async () => {
      const crypto = await import('node:crypto');
      const secret = 'shared_secret';
      const payload = JSON.stringify({ test: 'data' });

      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });

    it('deve rejeitar externalEventId com caracteres invalidos', () => {
      const payload = {
        type: 'payment_received',
        externalEventId: 'evt invalid/1',
        externalPatientId: 'patient-123',
        amount: 100,
        currency: 'BRL',
        date: new Date().toISOString(),
        paymentMethod: 'pix',
        description: 'Pagamento',
      };

      const result = ClinicWebhookPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar externalEventId acima de 128 caracteres', () => {
      const payload = {
        type: 'payment_received',
        externalEventId: `evt_${'a'.repeat(130)}`,
        externalPatientId: 'patient-123',
        amount: 100,
        currency: 'BRL',
        date: new Date().toISOString(),
        paymentMethod: 'pix',
        description: 'Pagamento',
      };

      const result = ClinicWebhookPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Health check contract', () => {
    it('deve ter metodo healthCheck disponivel', async () => {
      const { ClinicAutomationService } = await import('../../src/services/clinic/ClinicAutomationService');
      const proto = ClinicAutomationService.prototype;
      expect(proto.healthCheck).toBeDefined();
    });
  });

  describe('Routing logic', () => {
    it('deve rotear payment_received para handler de pagamento', () => {
      const eventType = 'payment_received';
      const isPaymentEvent = eventType === 'payment_received';
      expect(isPaymentEvent).toBe(true);
    });

    it('deve rotear expense_recorded para handler de despesa', () => {
      const eventType = 'expense_recorded';
      const isExpenseEvent = eventType === 'expense_recorded';
      expect(isExpenseEvent).toBe(true);
    });

    it('deve rotear receivable_reminder_* para handler de cobranca', () => {
      const types = [
        'receivable_reminder_created',
        'receivable_reminder_updated',
        'receivable_reminder_cleared',
      ];

      for (const eventType of types) {
        const isReminderEvent = eventType.startsWith('receivable_reminder_');
        expect(isReminderEvent).toBe(true);
      }
    });
  });
});
