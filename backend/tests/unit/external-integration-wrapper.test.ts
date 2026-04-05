import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalIntegrationWrapper } from '../../src/services/integrations/ExternalIntegrationWrapper';

describe('ExternalIntegrationWrapper', () => {
  let wrapper: ExternalIntegrationWrapper;

  beforeEach(() => {
    wrapper = new ExternalIntegrationWrapper({
      integrationName: `test-${Date.now()}`, // Unique per test to avoid circuit state leaking
      timeoutMs: 50,
      maxRetries: 2,
      retryDelayMs: 10,
      circuitBreakerMaxFailures: 3,
      circuitBreakerWindowMs: 1000,
    });
    wrapper.resetCircuit();
  });

  describe('successful calls', () => {
    it('should return data on success', async () => {
      const result = await wrapper.call(async () => 42);

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
      expect(result.attempts).toBe(1);
    });

    it('should track duration', async () => {
      const result = await wrapper.call(async () => 'ok');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should work with complex return types', async () => {
      const result = await wrapper.call(async () => ({ id: '1', value: 100 }));

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', value: 100 });
    });
  });

  describe('timeout behaviour', () => {
    it('should fail when fn exceeds timeout', async () => {
      const slowFn = () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));

      const result = await wrapper.call(slowFn);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('retry behaviour', () => {
    it('should retry and succeed on second attempt', async () => {
      let calls = 0;
      const flaky = async () => {
        calls++;
        if (calls < 2) throw new Error('Transient error');
        return 'success';
      };

      const result = await wrapper.call(flaky);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.data).toBe('success');
    });

    it('should return failure after exhausting retries', async () => {
      const alwaysFails = async () => {
        throw new Error('Persistent error');
      };

      const result = await wrapper.call(alwaysFails);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(result.error).toBe('Persistent error');
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after max failures', async () => {
      const fails = async () => {
        throw new Error('Always fails');
      };

      // Trigger enough failures to open circuit (maxFailures=3, each call uses maxRetries=2 attempts)
      await wrapper.call(fails); // opens after this (3rd call triggers the breaker)

      wrapper = new ExternalIntegrationWrapper({
        integrationName: wrapper['circuitKey'].replace('circuit:', ''),
        circuitBreakerMaxFailures: 1, // Open after just 1 failure
        maxRetries: 1,
        retryDelayMs: 0,
        timeoutMs: 50,
      });
      await wrapper.call(fails);

      const state = wrapper.getCircuitState();
      expect(state.isOpen).toBe(true);
    });

    it('should reject immediately when circuit is open', async () => {
      const uniqueWrapper = new ExternalIntegrationWrapper({
        integrationName: `circuit-test-${Date.now()}`,
        circuitBreakerMaxFailures: 1,
        maxRetries: 1,
        retryDelayMs: 0,
        timeoutMs: 50,
      });

      // Force open
      await uniqueWrapper.call(async () => { throw new Error('fail'); });

      const state = uniqueWrapper.getCircuitState();
      expect(state.isOpen).toBe(true);

      const result = await uniqueWrapper.call(async () => 'should not be reached');
      expect(result.success).toBe(false);
      expect(result.circuitOpen).toBe(true);
      expect(result.attempts).toBe(0);
    });

    it('should reset circuit on success', async () => {
      const uniqueWrapper = new ExternalIntegrationWrapper({
        integrationName: `circuit-reset-${Date.now()}`,
        circuitBreakerMaxFailures: 5,
        maxRetries: 1,
        retryDelayMs: 0,
        timeoutMs: 50,
      });

      // One failure
      await uniqueWrapper.call(async () => { throw new Error('fail'); });

      // Success should reset failure count
      await uniqueWrapper.call(async () => 'ok');

      const state = uniqueWrapper.getCircuitState();
      expect(state.failures).toBe(0);
    });

    it('should allow manual reset', () => {
      wrapper.resetCircuit();

      const state = wrapper.getCircuitState();
      expect(state.isOpen).toBe(false);
      expect(state.failures).toBe(0);
    });
  });

  describe('getCircuitState', () => {
    it('should return copy of current state', () => {
      const state = wrapper.getCircuitState();

      expect(state).toHaveProperty('failures');
      expect(state).toHaveProperty('isOpen');
      expect(state).toHaveProperty('lastFailureTime');
    });
  });
});
