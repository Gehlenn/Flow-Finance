import { describe, expect, it, vi, beforeEach } from 'vitest';
import logger from '../../src/config/logger';
import { ExternalIntegrationWrapper } from '../../src/services/integrations/ExternalIntegrationWrapper';

describe('ExternalIntegrationWrapper observability', () => {
  let wrapper: ExternalIntegrationWrapper;

  beforeEach(() => {
    wrapper = new ExternalIntegrationWrapper({
      integrationName: `observability-${Date.now()}`,
      timeoutMs: 20,
      maxRetries: 1,
      retryDelayMs: 0,
      circuitBreakerMaxFailures: 1,
      circuitBreakerWindowMs: 1000,
    });
    wrapper.resetCircuit();
  });

  it('logs contextual data when retries are exhausted', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = await wrapper.call(async () => {
      throw new Error('integration down');
    });

    expect(result.success).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        integration: expect.stringMatching(/^observability-/),
        attempts: 1,
        error: 'integration down',
        circuitOpen: true,
        fallback: 'external-call-exhausted',
      }),
      'External call failed after exhausting retries',
    );

    errorSpy.mockRestore();
  });

  it('logs contextual data when circuit is open', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await wrapper.call(async () => {
      throw new Error('first failure');
    });

    const result = await wrapper.call(async () => 'should not run');

    expect(result.circuitOpen).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        integration: expect.stringMatching(/^observability-/),
        circuitOpen: true,
        fallback: 'circuit-open',
      }),
      'Circuit breaker open — request rejected',
    );

    warnSpy.mockRestore();
  });
});
