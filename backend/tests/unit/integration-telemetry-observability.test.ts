import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntegrationTelemetry } from '../../src/services/observability/IntegrationTelemetry';
import logger from '../../src/config/logger';
import * as Sentry from '@sentry/node';

vi.mock('@sentry/node', () => ({
  startTransaction: vi.fn(() => ({
    startChild: vi.fn(() => ({ end: vi.fn() })),
    finish: vi.fn(),
  })),
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((fn) => fn({ setTag: vi.fn(), setContext: vi.fn(), setUser: vi.fn() })),
  captureException: vi.fn(),
  setTag: vi.fn(),
}));

describe('IntegrationTelemetry observability', () => {
  let telemetry: IntegrationTelemetry;

  beforeEach(() => {
    telemetry = new IntegrationTelemetry(logger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data when executeWithTelemetry fails', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const context = {
      integrationName: 'stripe',
      operation: 'payment_process',
      provider: 'stripe',
      environment: 'production' as const,
      requestId: 'req-123',
      tenantId: 'tenant-456',
      retryCount: 2,
      timeoutMs: 25,
    };

    await expect(
      telemetry.executeWithTelemetry(context, async () => {
        throw new Error('integration boom');
      })
    ).rejects.toThrow('integration boom');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationName: 'stripe',
        operation: 'payment_process',
        status: 'error',
        errorMessage: 'integration boom',
        errorType: 'Error',
        retryCount: 2,
        requestId: 'req-123',
        tenantId: 'tenant-456',
        fallback: 'integration-error',
      }),
      'Integration telemetry failed: stripe - payment_process'
    );

    expect(Sentry.captureException).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('captures an instrumented failure once at the telemetry owner', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const descriptor: PropertyDescriptor = {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('instrumented boom')),
      writable: true,
    };

    IntegrationTelemetry.instrument(telemetry, {
      integrationName: 'stripe',
      operation: 'payment_process',
      requestId: 'req-instrumented',
    })({}, 'run', descriptor);

    await expect(descriptor.value()).rejects.toThrow('instrumented boom');
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
