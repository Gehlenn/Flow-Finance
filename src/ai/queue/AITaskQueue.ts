/**
 * AI Task Queue
 * Main queue engine for managing AI tasks
 */

import {
  AITask,
  AITaskType,
  AITaskStatus,
  AITaskPriority,
  InsightGenerationPayload,
  CashflowSimulationPayload,
  FinancialReportPayload,
  LeakDetectionPayload,
  AutopilotAnalysisPayload,
  RiskAnalysisPayload,
} from './taskTypes';
import { taskStore } from './taskStore';
import { aiWorker } from './AIWorker';
import { makeId } from '../../utils/helpers';
import { logInfo, logWarn } from '../../utils/logger';

class AITaskQueue {
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      logWarn('[AI Task Queue] Already initialized', {
        fallback: 'ai-task-queue-already-initialized',
      });
      return;
    }

    logInfo('[AI Task Queue] Initializing...', {
      fallback: 'ai-task-queue-initializing',
    });
    
    // Start worker
    aiWorker.start();

    this.initialized = true;
    logInfo('[AI Task Queue] Ready', {
      fallback: 'ai-task-queue-ready',
    });
  }

  shutdown(): void {
    aiWorker.stop();
    this.initialized = false;
    logInfo('[AI Task Queue] Shutdown complete', {
      fallback: 'ai-task-queue-shutdown-complete',
    });
  }

  enqueueTask<T = unknown>(
    type: AITaskType,
    payload: T,
    userId = 'system',
    options?: {
      priority?: AITaskPriority;
      maxRetries?: number;
    }
  ): string {
    if (!this.initialized) {
      throw new Error('[AI Task Queue] Not initialized. Call initialize() first.');
    }

    const taskId = makeId();
    const task: AITask = {
      id: taskId,
      type,
      payload,
      status: AITaskStatus.PENDING,
      priority: options?.priority || AITaskPriority.NORMAL,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 2,
      userId,
    };

    taskStore.addTask(task);
    logInfo('[AI Task Queue] Task enqueued', {
      taskId,
      taskType: type,
      userId,
      priority: task.priority,
      fallback: 'ai-task-queue-task-enqueued',
    });

    return taskId;
  }

  getTask(taskId: string): AITask | undefined {
    return taskStore.getTask(taskId);
  }

  getTaskStatus(taskId: string): AITaskStatus | null {
    const task = taskStore.getTask(taskId);
    return task ? task.status : null;
  }

  getTaskResult(taskId: string): unknown | null {
    const task = taskStore.getTask(taskId);
    return task?.result || null;
  }

  cancelTask(taskId: string): boolean {
    const task = taskStore.getTask(taskId);
    if (!task || task.status !== AITaskStatus.PENDING) {
      return false;
    }

    taskStore.updateTaskStatus(taskId, AITaskStatus.CANCELLED);
    logInfo('[AI Task Queue] Task cancelled', {
      taskId,
      fallback: 'ai-task-queue-task-cancelled',
    });
    return true;
  }

  getUserTasks(userId: string): AITask[] {
    return taskStore.getTasksByUser(userId);
  }

  getPendingTasks(): AITask[] {
    return taskStore.getTasksByStatus(AITaskStatus.PENDING);
  }

  getCompletedTasks(): AITask[] {
    return taskStore.getTasksByStatus(AITaskStatus.COMPLETED);
  }

  clearCompletedTasks(userId?: string): void {
    taskStore.clearCompletedTasks(userId);
  }

  getQueueStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const allTasks = taskStore.getAllTasks();
    return {
      pending: allTasks.filter((t) => t.status === AITaskStatus.PENDING).length,
      processing: allTasks.filter((t) => t.status === AITaskStatus.PROCESSING).length,
      completed: allTasks.filter((t) => t.status === AITaskStatus.COMPLETED).length,
      failed: allTasks.filter((t) => t.status === AITaskStatus.FAILED).length,
      cancelled: allTasks.filter((t) => t.status === AITaskStatus.CANCELLED).length,
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Convenience methods for common tasks

  enqueueInsightGeneration(userId: string, accounts: InsightGenerationPayload['accounts'], transactions: InsightGenerationPayload['transactions']): string {
    return this.enqueueTask(
      AITaskType.INSIGHT_GENERATION,
      { accounts, transactions },
      userId,
      { priority: AITaskPriority.NORMAL }
    );
  }

  enqueueCashflowSimulation(userId: string, transactions: CashflowSimulationPayload['transactions'], horizon: number = 30): string {
    return this.enqueueTask(
      AITaskType.CASHFLOW_SIMULATION,
      { transactions, horizon },
      userId,
      { priority: AITaskPriority.LOW }
    );
  }

  enqueueFinancialReport(userId: string, transactions: FinancialReportPayload['transactions'], month: number, year: number): string {
    return this.enqueueTask(
      AITaskType.FINANCIAL_REPORT,
      { transactions, month, year },
      userId,
      { priority: AITaskPriority.NORMAL }
    );
  }

  enqueueLeakDetection(userId: string, transactions: LeakDetectionPayload['transactions']): string {
    return this.enqueueTask(
      AITaskType.LEAK_DETECTION,
      { transactions },
      userId,
      { priority: AITaskPriority.HIGH }
    );
  }

  enqueueAutopilotAnalysis(
    userId: string,
    accounts: AutopilotAnalysisPayload['accounts'],
    transactions: AutopilotAnalysisPayload['transactions'],
    goals?: AutopilotAnalysisPayload['goals']
  ): string {
    return this.enqueueTask(
      AITaskType.AUTOPILOT_ANALYSIS,
      { accounts, transactions, goals },
      userId,
      { priority: AITaskPriority.NORMAL }
    );
  }

  enqueueRiskAnalysis(userId: string, accounts: RiskAnalysisPayload['accounts'], transactions: RiskAnalysisPayload['transactions']): string {
    return this.enqueueTask(
      AITaskType.RISK_ANALYSIS,
      { accounts, transactions },
      userId,
      { priority: AITaskPriority.HIGH }
    );
  }
}

// Singleton instance
export const aiTaskQueue = new AITaskQueue();

export function enqueueTaskForUser<T = unknown>(
  userId: string,
  type: AITaskType,
  payload: T,
  options?: { priority?: AITaskPriority; maxRetries?: number }
): string {
  if (!aiTaskQueue.isInitialized()) {
    aiTaskQueue.initialize();
  }
  return aiTaskQueue.enqueueTask(type, payload, userId, options);
}
