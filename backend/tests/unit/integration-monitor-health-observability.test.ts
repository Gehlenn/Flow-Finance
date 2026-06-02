import { describe, expect, it, vi } from 'vitest';
import { IntegrationMonitor } from '../../src/services/observability/IntegrationMonitor';

type TelemetryLike = {
  checkHealthFor: (name: string) => Promise<{
    name: string;
    healthy: boolean;
    lastChecked: Date;
  }>;
  recordDegradation: (...args: unknown[]) => void;
};

type LoggerLike = {
  error: (...args: unknown[]) => void;
};

describe('IntegrationMonitor health observability', () => {
  it('logs contextual data when a dependency health check fails', async () => {
    const error = vi.fn();
    const telemetry: TelemetryLike = {
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
    };

    const monitor = new IntegrationMonitor(telemetry as never, { error } as LoggerLike as never);

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
