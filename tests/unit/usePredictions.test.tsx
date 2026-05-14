import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePredictions } from '../../src/hooks/usePredictions';

const loggerMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: loggerMocks.logWarn,
}));

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function errorJson(status: number, error: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error }),
  } as Response;
}

describe('usePredictions observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('authToken', 'token-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs contextual data when the initial cash-flow fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(errorJson(500, 'prediction offline'));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => usePredictions(45));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('prediction offline');
    });

    expect(loggerMocks.logWarn).toHaveBeenCalledWith(
      '[usePredictions] fetchPrediction failed',
      expect.objectContaining({
        route: 'cash-flow',
        days: 45,
        endpoint: 'http://localhost:3001/api/predictions/cash-flow',
        error: expect.any(Error),
      }),
    );
  });

  it('logs contextual data when refreshPrediction fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson({
        success: true,
        data: {
          dailyPredictions: [],
          dateRange: {
            start: '2026-05-01T00:00:00.000Z',
            end: '2026-05-30T00:00:00.000Z',
          },
          generatedAt: '2026-05-01T00:00:00.000Z',
        },
      }))
      .mockResolvedValueOnce(errorJson(404, 'no shortfall risk'))
      .mockResolvedValueOnce(errorJson(500, 'refresh offline'));

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => usePredictions(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    await act(async () => {
      await result.current.refreshPrediction();
    });

    expect(result.current.error).toBe('refresh offline');
    expect(loggerMocks.logWarn).toHaveBeenCalledWith(
      '[usePredictions] refreshPrediction failed',
      expect.objectContaining({
        route: 'refresh',
        days: 30,
        endpoint: 'http://localhost:3001/api/predictions/refresh',
        error: expect.any(Error),
      }),
    );
  });
});
