import { describe, expect, it, vi } from 'vitest';
import { monitorIntegration } from '../../src/services/observability/monitorIntegration';

const loggerError = vi.fn();

vi.mock('../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerError,
    debug: vi.fn(),
  },
}));

vi.mock('@sentry/node', () => ({
  startSpan: vi.fn(async (_opts, cb) => cb({
    setAttribute: vi.fn(),
  })),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn(),
}));

describe('monitorIntegration observability', () => {
  it('logs contextual data when the wrapped call fails', async () => {
    await expect(
      monitorIntegration(
        {
          integrationName: 'stripe',
          provider: 'stripe',
          operation: 'payment_process',
          requestId: 'req-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          sourceSystem: 'flow',
        },
        async () => {
          throw new Error('integration crashed');
        },
      ),
    ).rejects.toThrow('integration crashed');

    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationName: 'stripe',
        provider: 'stripe',
        operation: 'payment_process',
        sourceSystem: 'flow',
        status: 'error',
        errorMessage: 'integration crashed',
        errorType: 'Error',
        requestId: 'req-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        fallback: 'integration-monitor-error',
      }),
      'integration:stripe:payment_process:error',
    );
  });
});
