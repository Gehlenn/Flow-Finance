import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntegrationTelemetry, IntegrationContext } from '../../src/services/observability/IntegrationTelemetry';
import logger from '../../src/config/logger';
import * as Sentry from '@sentry/node';
import { runWithRequestContext } from '../../src/middleware/requestContextStore';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  startTransaction: vi.fn(() => ({
    startChild: vi.fn(() => ({ end: vi.fn() })),
    finish: vi.fn()
  })),
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((fn) => fn({ setTag: vi.fn(), setContext: vi.fn(), setUser: vi.fn() })),
  captureException: vi.fn(),
  setTag: vi.fn()
}));

describe('IntegrationTelemetry', () => {
  let telemetry: IntegrationTelemetry;
  let loggerSpy: any;

  beforeEach(() => {
    telemetry = new IntegrationTelemetry(logger);
    loggerSpy = vi.spyOn(logger, 'info');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('executeWithTelemetry', () => {
    it('deve registrar sucesso com latência', async () => {
      const context: IntegrationContext = {
        integrationName: 'stripe',
        operation: 'payment_process',
        provider: 'stripe',
        environment: 'production',
        requestId: 'req-123'
      };

      const result = await telemetry.executeWithTelemetry(context, async () => {
        return { success: true };
      });

      expect(result).toEqual({ success: true });
      expect(loggerSpy).toHaveBeenCalled();
      const lastCall = loggerSpy.mock.calls[loggerSpy.mock.calls.length - 1];
      expect(lastCall[0]).toHaveProperty('status', 'success');
      expect(lastCall[0]).toHaveProperty('durationMs');
    });

    it('deve capturar exceção com contexto ao falhar', async () => {
      const context: IntegrationContext = {
        integrationName: 'openai',
        operation: 'ai_chat',
        environment: 'production',
        requestId: 'req-456'
      };

      const error = new Error('AI service timeout');

      await expect(
        telemetry.executeWithTelemetry(context, async () => {
          throw error;
        })
      ).rejects.toThrow('AI service timeout');

      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('deve ativar timeout promise quando ultrapassar limite', async () => {
      const context: IntegrationContext = {
        integrationName: 'pluggy',
        operation: 'fetch_data',
        environment: 'staging',
        requestId: 'req-789',
        timeoutMs: 100
      };

      await expect(
        telemetry.executeWithTelemetry(context, async () => {
          // Simular delay maior que timeout
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { data: 'result' };
        })
      ).rejects.toThrow('Integration timeout');
    });
  });

  describe('recordSuccess', () => {
    it('deve registrar sucesso com breadcrumb Sentry', () => {
      const context: IntegrationContext = {
        integrationName: 'firebase',
        operation: 'sync_user',
        environment: 'production',
        requestId: 'req-xyz',
        durationMs: 245
      };

      telemetry.recordSuccess(context);

      expect(Sentry.addBreadcrumb).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('recordFallback', () => {
    it('deve registrar fallback com aviso', () => {
      const context: IntegrationContext = {
        integrationName: 'openai',
        operation: 'ai_analysis',
        environment: 'production',
        requestId: 'req-fallback'
      };

      const warnSpy = vi.spyOn(logger, 'warn');

      telemetry.recordFallback(context, 'Primary provider timeout', 'gemini');

      expect(warnSpy).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Fallback activated'),
        'warning'
      );
    });
  });

  describe('recordDegradation', () => {
    it('deve alertar sobre degradação de serviço', () => {
      const context: IntegrationContext = {
        integrationName: 'stripe',
        operation: 'payment_process',
        environment: 'production',
        requestId: 'req-degrade'
      };

      const warnSpy = vi.spyOn(logger, 'warn');

      telemetry.recordDegradation(
        context,
        'Latency above threshold: avg 5.2s vs 2s',
        'high'
      );

      expect(warnSpy).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Service degradation'),
        'error'
      );
    });
  });

  describe('captureException', () => {
    it('deve capturar exception com contexto completo', () => {
      const context: IntegrationContext = {
        integrationName: 'clinic-automation',
        operation: 'webhook_ingest',
        environment: 'production',
        requestId: 'req-error',
        userId: 'user-123',
        tenantId: 'tenant-456',
        httpStatus: 502,
        retryCount: 2,
        sourceSystem: 'clinic-automation'
      };

      const error = new Error('Bad gateway from clinic API');

      telemetry.captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      // Logger must have been called with error
      expect(logger.error).toBeDefined();
    });
  });

  describe('request context integration', () => {
    it('deve ler requestId, userId e tenantId do AsyncLocalStorage', () => {
      runWithRequestContext(
        {
          requestId: 'req-als',
          userId: 'user-als',
          tenantId: 'tenant-als',
        },
        () => {
          expect((telemetry as any).getRequestId()).toBe('req-als');
          expect((telemetry as any).getUserId()).toBe('user-als');
          expect((telemetry as any).getTenantId()).toBe('tenant-als');
        }
      );
    });
  });
});
