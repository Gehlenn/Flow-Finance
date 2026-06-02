import { beforeEach, describe, expect, it, vi } from 'vitest';

const queueMocks = vi.hoisted(() => ({
  getNextTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../../src/ai/queue/taskStore', () => ({
  taskStore: {
    getNextTask: queueMocks.getNextTask,
    updateTaskStatus: queueMocks.updateTaskStatus,
    updateTask: queueMocks.updateTask,
    clear: vi.fn(),
  },
}));

vi.mock('../../src/ai/insightGenerator', () => ({
  generateFinancialInsights: vi.fn(),
}));

vi.mock('../../src/finance/cashflowPredictor', () => ({
  predictCashflow: vi.fn(),
}));

vi.mock('../../src/finance/reportEngine', () => ({
  generateMonthlyReport: vi.fn(),
}));

vi.mock('../../src/ai/leakDetector', () => ({
  detectFinancialLeaks: vi.fn(),
}));

vi.mock('../../src/ai/financialAutopilot', () => ({
  runFinancialAutopilot: vi.fn(),
}));

vi.mock('../../src/ai/riskAnalyzer', () => ({
  detectFinancialRisks: vi.fn(),
}));

vi.mock('../../src/ai/subscriptionDetector', () => ({
  detectSubscriptions: vi.fn(),
}));

vi.mock('../../src/ai/salaryDetector', () => ({
  detectSalary: vi.fn(),
}));

vi.mock('../../src/ai/fixedExpenseDetector', () => ({
  detectFixedExpenses: vi.fn(),
}));

import { runAIWorker } from '../../src/ai/queue/AIWorker';
import { AITaskPriority, AITaskStatus, AITaskType } from '../../src/ai/queue/taskTypes';
import { logError, logInfo, logWarn } from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

describe('AIWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data when task execution fails', async () => {
    queueMocks.getNextTask.mockReturnValueOnce({
      id: 'task-1',
      userId: 'user-1',
      type: 'invalid_task_type' as AITaskType,
      status: AITaskStatus.PENDING,
      priority: AITaskPriority.NORMAL,
      createdAt: Date.now(),
      payload: { transactions: [] },
      retryCount: 0,
      maxRetries: 1,
    });
    queueMocks.updateTaskStatus.mockImplementation(() => undefined);
    queueMocks.updateTask.mockImplementation(() => undefined);

    await expect(runAIWorker()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(
      '[AI Worker] Task execution failed',
      expect.any(Error),
      expect.objectContaining({
        taskId: 'task-1',
        taskType: 'invalid_task_type',
        userId: 'user-1',
        retryCount: 0,
        maxRetries: 1,
        executionTime: expect.any(Number),
      }),
    );
  });

  it('logs contextual data for lifecycle and retry paths', async () => {
    queueMocks.getNextTask.mockReturnValueOnce({
      id: 'task-2',
      userId: 'user-2',
      type: 'invalid_task_type' as AITaskType,
      status: AITaskStatus.PENDING,
      priority: AITaskPriority.NORMAL,
      createdAt: Date.now(),
      payload: { transactions: [] },
      retryCount: 0,
      maxRetries: 2,
    });
    queueMocks.updateTaskStatus.mockImplementation(() => undefined);
    queueMocks.updateTask.mockImplementation(() => undefined);

    const { aiWorker } = await import('../../src/ai/queue/AIWorker');

    aiWorker.start();
    aiWorker.start();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logInfo).toHaveBeenCalledWith(
      '[AI Worker] Starting...',
      expect.objectContaining({ fallback: 'ai-worker-starting' }),
    );
    expect(logWarn).toHaveBeenCalledWith(
      '[AI Worker] Already running',
      expect.objectContaining({ fallback: 'ai-worker-already-running' }),
    );
    expect(logInfo).toHaveBeenCalledWith(
      '[AI Worker] Processing task',
      expect.objectContaining({
        taskId: 'task-2',
        taskType: 'invalid_task_type',
        userId: 'user-2',
        fallback: 'ai-worker-processing-task',
      }),
    );
    expect(logInfo).toHaveBeenCalledWith(
      '[AI Worker] Task will be retried',
      expect.objectContaining({
        taskId: 'task-2',
        taskType: 'invalid_task_type',
        userId: 'user-2',
        retryCount: 1,
        maxRetries: 2,
        fallback: 'ai-worker-task-will-be-retried',
      }),
    );

    aiWorker.stop();

    expect(logInfo).toHaveBeenCalledWith(
      '[AI Worker] Stopped',
      expect.objectContaining({ fallback: 'ai-worker-stopped' }),
    );
  });
});
