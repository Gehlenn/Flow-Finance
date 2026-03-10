/**
 * AI Worker
 * Processes AI tasks from the queue
 */

import { AITask, AITaskType, AITaskStatus } from './taskTypes';
import { taskStore } from './taskStore';

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

class AIWorker {
  private isRunning = false;
  private processingTaskId: string | null = null;
  private pollingInterval = 2000; // 2 seconds
  private pollingTimer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) {
      console.warn('[AI Worker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[AI Worker] Starting...');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    console.log('[AI Worker] Stopped');
  }

  private poll(): void {
    if (!this.isRunning) return;

    // Process next task
    this.processNextTask()
      .catch((error) => {
        console.error('[AI Worker] Processing error:', error);
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

  private async processNextTask(): Promise<void> {
    // Skip if already processing a task
    if (this.processingTaskId) {
      return;
    }

    const task = taskStore.getNextTask();
    if (!task) {
      return; // No pending tasks
    }

    this.processingTaskId = task.id;
    console.log(`[AI Worker] Processing task ${task.id} (${task.type})`);

    // Update status to processing
    taskStore.updateTaskStatus(task.id, AITaskStatus.PROCESSING);
    this.emitProgress(task.id, AITaskStatus.PROCESSING, 0, 'Starting task...');

    const startTime = Date.now();

    try {
      const result = await this.executeTask(task);
      
      const executionTime = Date.now() - startTime;
      console.log(`[AI Worker] Task ${task.id} completed in ${executionTime}ms`);

      // Update task with result
      taskStore.updateTask(task.id, {
        status: AITaskStatus.COMPLETED,
        result,
        completedAt: Date.now(),
      });

      this.emitProgress(task.id, AITaskStatus.COMPLETED, 100, 'Task completed');
      this.emitResult(task.id, true, result, executionTime);
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error?.message || 'Unknown error';

      console.error(`[AI Worker] Task ${task.id} failed:`, error);

      // Check if should retry
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        taskStore.updateTask(task.id, {
          status: AITaskStatus.PENDING,
          retryCount: task.retryCount,
        });
        console.log(`[AI Worker] Task ${task.id} will be retried (${task.retryCount}/${task.maxRetries})`);
      } else {
        taskStore.updateTaskStatus(task.id, AITaskStatus.FAILED, errorMessage);
        this.emitProgress(task.id, AITaskStatus.FAILED, 0, `Failed: ${errorMessage}`);
        this.emitResult(task.id, false, null, executionTime, errorMessage);
      }
    } finally {
      this.processingTaskId = null;
    }
  }

  private async executeTask(task: AITask): Promise<any> {
    const { type, payload, userId } = task;

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
    data: any,
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
