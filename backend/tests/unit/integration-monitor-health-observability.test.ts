import { describe, expect, it, vi } from 'vitest';
import { IntegrationMonitor } from '../../src/services/observability/IntegrationMonitor';

describe('IntegrationMonitor health observability', () => {
  it('logs contextual data when a dependency health check fails', async () => {
    const error = vi.fn();
    const telemetry = {
      checkHealthFor: vi.fn(async (name: string) => {
        if (name === 'stripe') {
          throw new Error('stripe health offline');
        }

        return {
          name,
          healthy: true,
          lastChecked: new Date('2026-05-10T12:00:00.000Z'),
        };
      }),
      recordDegradation: vi.fn(),
    } as any;

    const monitor = new IntegrationMonitor(telemetry, { error } as any);

    const checks = await monitor.checkAllHealths();

    const stripeCheck = checks.find((check) => check.name === 'stripe');
    expect(stripeCheck?.healthy).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationName: 'stripe',
        error: 'stripe health offline',
        errorType: 'Error',
        fallback: 'healthcheck-false',
      }),
      'Health check failed for stripe',
    );
  });
});
