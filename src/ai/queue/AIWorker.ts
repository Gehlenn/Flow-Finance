/**
 * AI Worker
 * Processes AI tasks from the queue
 */

import { AITask, AITaskType, AITaskStatus } from './taskTypes';
import { taskStore } from './taskStore';
import { Transaction, Goal } from '../../../types';
import { Account } from '../../../models/Account';

// Import AI services
import { generateFinancialInsights } from '../insightGenerator';
import { predictCashflow } from '../../finance/cashflowPredictor';
import { generateMonthlyReport } from '../../finance/reportEngine';
import { detectFinancialLeaks } from '../leakDetector';
import { runFinancialAutopilot } from '../financialAutopilot';
import { detectFinancialRisks } from '../riskAnalyzer';
import { detectSubscriptions } from '../subscriptionDetector';
import { detectSalary } from '../salaryDetector';
import { detectFixedExpenses } from '../fixedExpenseDetector';
import { logError, logInfo, logWarn } from '../../utils/logger';

type AIWorkerPayload = {
  transactions?: Transaction[];
  accounts?: Account[];
  goals?: Goal[];
  [key: string]: unknown;
};

class AIWorker {
  private isRunning = false;
  private processingTaskId: string | null = null;
  private pollingInterval = 2000; // 2 seconds
  private pollingTimer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) {
      logWarn('[AI Worker] Already running', {
        fallback: 'ai-worker-already-running',
      });
      return;
    }

    this.isRunning = true;
    logInfo('[AI Worker] Starting...', {
      fallback: 'ai-worker-starting',
    });
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    logInfo('[AI Worker] Stopped', {
      fallback: 'ai-worker-stopped',
    });
  }

  private poll(): void {
    if (!this.isRunning) return;

    // Process next task
    this.processNextTask()
      .catch((error) => {
        logError('[AI Worker] Processing error while polling queue', error, {
          scope: 'ai-worker',
        });
      })
      .finally(() => {
        // Schedule next poll
        if (this.isRunning) {
          this.pollingTimer = setTimeout(() => this.poll(), this.pollingInterval);
        }
      });
  }

  async runOnce(): Promise<void> {
    await this.processNextTask();
  }

  async runForUser(userId: string): Promise<void> {
    await this.processNextTask(userId);
  }

  private async processNextTask(userId?: string): Promise<void> {
    // Skip if already processing a task
    if (this.processingTaskId) {
      return;
    }

    const task = taskStore.getNextTask(userId);
    if (!task) {
      return; // No pending tasks
    }

    this.processingTaskId = task.id;
    logInfo('[AI Worker] Processing task', {
      taskId: task.id,
      taskType: task.type,
      userId: task.userId,
      fallback: 'ai-worker-processing-task',
    });

    // Update status to processing
    taskStore.updateTaskStatus(task.id, AITaskStatus.PROCESSING);
    this.emitProgress(task.id, AITaskStatus.PROCESSING, 0, 'Starting task...');

    const startTime = Date.now();

    try {
      const result = await this.executeTask(task);
      
      const executionTime = Date.now() - startTime;
      logInfo('[AI Worker] Task completed', {
        taskId: task.id,
        taskType: task.type,
        userId: task.userId,
        executionTime,
        fallback: 'ai-worker-task-completed',
      });

      // Update task with result
      taskStore.updateTask(task.id, {
        status: AITaskStatus.COMPLETED,
        result,
        completedAt: Date.now(),
      });

      this.emitProgress(task.id, AITaskStatus.COMPLETED, 100, 'Task completed');
      this.emitResult(task.id, true, result, executionTime);
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError('[AI Worker] Task execution failed', error, {
        taskId: task.id,
        taskType: task.type,
        userId: task.userId,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        executionTime,
      });

      // Check if should retry
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        taskStore.updateTask(task.id, {
          status: AITaskStatus.PENDING,
          retryCount: task.retryCount,
        });
        logInfo('[AI Worker] Task will be retried', {
          taskId: task.id,
          taskType: task.type,
          userId: task.userId,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
          fallback: 'ai-worker-task-will-be-retried',
        });
      } else {
        taskStore.updateTaskStatus(task.id, AITaskStatus.FAILED, errorMessage);
        this.emitProgress(task.id, AITaskStatus.FAILED, 0, `Failed: ${errorMessage}`);
        this.emitResult(task.id, false, null, executionTime, errorMessage);
      }
    } finally {
      this.processingTaskId = null;
    }
  }

  private async executeTask(task: AITask): Promise<unknown> {
    const { type, userId } = task;
    const payload = task.payload as AIWorkerPayload;

    switch (type) {
      case AITaskType.INSIGHT_GENERATION:
        return generateFinancialInsights(payload.transactions || [], userId, payload.accounts || []);

      case AITaskType.CASHFLOW_SIMULATION:
        return predictCashflow(
          payload.accounts || [],
          payload.transactions || []
        );

      case AITaskType.FINANCIAL_REPORT:
        return generateMonthlyReport(payload.transactions || []);

      case AITaskType.LEAK_DETECTION:
        return detectFinancialLeaks(payload.transactions || []);

      case AITaskType.AUTOPILOT_ANALYSIS: {
        const prediction = predictCashflow(payload.accounts || [], payload.transactions || []);
        const insights = generateFinancialInsights(payload.transactions || [], userId, payload.accounts || []);
        return runFinancialAutopilot(
          payload.accounts || [],
          payload.transactions || [],
          prediction,
          insights
        );
      }

      case AITaskType.RISK_ANALYSIS: {
        const prediction = predictCashflow(payload.accounts || [], payload.transactions || []);
        return detectFinancialRisks(prediction);
      }

      case AITaskType.SUBSCRIPTION_DETECTION:
        return detectSubscriptions(payload.transactions || []);

      case AITaskType.SALARY_DETECTION:
        return detectSalary(payload.transactions || []);

      case AITaskType.FIXED_EXPENSE_DETECTION:
        return detectFixedExpenses(payload.transactions || []);

      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }

  private emitProgress(taskId: string, status: AITaskStatus, progress: number, message: string): void {
    window.dispatchEvent(
      new CustomEvent('ai-task-progress', {
        detail: {
          taskId,
          status,
          progress,
          message,
          timestamp: Date.now(),
        },
      })
    );
  }

  private emitResult(
    taskId: string,
    success: boolean,
    data: unknown,
    executionTime: number,
    error?: string
  ): void {
    window.dispatchEvent(
      new CustomEvent('ai-task-result', {
        detail: {
          taskId,
          success,
          data,
          error,
          executionTime,
          timestamp: Date.now(),
        },
      })
    );
  }

  isProcessing(): boolean {
    return this.processingTaskId !== null;
  }

  getCurrentTaskId(): string | null {
    return this.processingTaskId;
  }
}

// Singleton instance
export const aiWorker = new AIWorker();

// Sprint 3 simple function API.
export async function runAIWorker(): Promise<void> {
  await aiWorker.runOnce();
}

export async function runAIWorkerForUser(userId: string): Promise<void> {
  await aiWorker.runForUser(userId);
}
