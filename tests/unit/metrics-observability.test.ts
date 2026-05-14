import { beforeEach, describe, expect, it, vi } from 'vitest';

const logInfoMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
}));

describe('metrics observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('logs contextual data when metrics are recorded and incremented', async () => {
    const { recordMetric, incrementMetric, getMetric } = await import('../../src/observability/metrics');

    recordMetric('ai.queue.pending', 1);
    const next = incrementMetric('ai.queue.pending', 2);

    expect(next).toBe(3);
    expect(getMetric('ai.queue.pending')).toBe(3);
    expect(logInfoMock).toHaveBeenCalledWith(
      '[Metric] recorded',
      expect.objectContaining({
        name: 'ai.queue.pending',
        value: 1,
        fallback: 'metric-recorded',
      }),
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      '[Metric] incremented',
      expect.objectContaining({
        name: 'ai.queue.pending',
        value: 3,
        incrementBy: 2,
        fallback: 'metric-incremented',
      }),
    );
  });
});
