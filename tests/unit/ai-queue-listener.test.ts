import { describe, expect, it, vi, beforeEach } from 'vitest';

const enqueueTaskMock = vi.fn();
const subscribeMock = vi.fn();

vi.mock('../../src/ai/queue/AITaskQueue', () => ({
  aiTaskQueue: {
    enqueueTask: (...args: unknown[]) => enqueueTaskMock(...args),
  },
}));

vi.mock('../../src/events/eventEngine', () => ({
  subscribeToFinancialEvents: (callback: (event: { type: string; payload: unknown }) => void) => {
    subscribeMock(callback);
    return () => undefined;
  },
}));

describe('aiQueueListener', () => {
  beforeEach(() => {
    enqueueTaskMock.mockReset();
    subscribeMock.mockReset();
    vi.clearAllMocks();
  });

  it('warns when queueing a task fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    enqueueTaskMock.mockImplementation(() => {
      throw new Error('queue unavailable');
    });

    const { registerAIQueueListener } = await import('../../src/events/listeners/aiQueueListener');
    registerAIQueueListener();

    const callback = subscribeMock.mock.calls[0]?.[0] as (event: { type: string; payload: unknown }) => void;
    callback({
      type: 'transaction_created',
      payload: { id: 'tx-1' },
    });

    expect(enqueueTaskMock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[AIQueueListener] failed to enqueue task from financial event',
      expect.objectContaining({
        eventType: 'transaction_created',
        taskType: expect.any(String),
      }),
    );
    warnSpy.mockRestore();
  });
});
