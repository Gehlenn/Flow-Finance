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

describe('AIWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data when task execution fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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

    expect(errorSpy).toHaveBeenCalledWith(
      '[AI Worker] Task execution failed:',
      expect.objectContaining({
        taskId: 'task-1',
        taskType: 'invalid_task_type',
        userId: 'user-1',
        retryCount: 0,
        maxRetries: 1,
        error: expect.any(Error),
      }),
    );

    errorSpy.mockRestore();
  });
});
