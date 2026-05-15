import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';

const performanceLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: performanceLoggerMock.logWarn,
}));

describe('usePerformanceMonitoring', () => {
  beforeEach(() => {
    performanceLoggerMock.logWarn.mockReset();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('registra aviso quando a API de performance nao existe', () => {
    const hadPerformanceObserver = 'PerformanceObserver' in window;
    const originalPerformanceObserver = window.PerformanceObserver;

    Reflect.deleteProperty(window, 'PerformanceObserver');

    renderHook(() => usePerformanceMonitoring());

    expect(performanceLoggerMock.logWarn).toHaveBeenCalledWith(
      '[Performance Monitoring] Performance API not supported',
      expect.objectContaining({
        fallback: 'performance-api-not-supported',
      }),
    );

    if (hadPerformanceObserver) {
      Object.defineProperty(window, 'PerformanceObserver', {
        configurable: true,
        value: originalPerformanceObserver,
      });
    }
  });

  it('registra aviso quando o observer falha ao iniciar', async () => {
    const observeMock = vi.fn(() => {
      throw new Error('observer blocked');
    });

    class PerformanceObserverMock {
      observe = observeMock;
      disconnect = vi.fn();

      constructor(_callback: PerformanceObserverCallback) {}
    }

    Object.defineProperty(window, 'PerformanceObserver', {
      configurable: true,
      value: PerformanceObserverMock,
    });

    renderHook(() => usePerformanceMonitoring());

    await waitFor(() => {
      expect(performanceLoggerMock.logWarn).toHaveBeenCalledWith(
        '[Performance Monitoring] Performance observer setup failed',
        expect.objectContaining({
          error: expect.any(Error),
          fallback: 'performance-observer-setup-failed',
        }),
      );
    });
  });
});
