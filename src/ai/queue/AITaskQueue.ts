/**
 * AI Task Queue
 * Main queue engine for managing AI tasks
 */

import { AITask, AITaskType, AITaskStatus, AITaskPriority } from './taskTypes';
import { taskStore } from './taskStore';
import { aiWorker } from './AIWorker';
import { makeId } from '../../utils/helpers';

class AITaskQueue {
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      console.warn('[AI Task Queue] Already initialized');
      return;
    }

    console.log('[AI Task Queue] Initializing...');
    
    // Start worker
    aiWorker.start();

    this.initialized = true;
    console.log('[AI Task Queue] Ready');
  }

  shutdown(): void {
    aiWorker.stop();
    this.initialized = false;
    console.log('[AI Task Queue] Shutdown complete');
  }

  enqueueTask<T = any>(
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
    console.log(`[AI Task Queue] Task enqueued: ${taskId} (${type})`);

    // Emit event
    window.dispatchEvent(
      new CustomEvent('ai-task-enqueued', {
        detail: { taskId, type, priority: task.priority },
      })
    );

    return taskId;
  }

  getTask(taskId: string): AITask | undefined {
    return taskStore.getTask(taskId);
  }

  getTaskStatus(taskId: string): AITaskStatus | null {
    const task = taskStore.getTask(taskId);
    return task ? task.status : null;
  }

  getTaskResult(taskId: string): any | null {
    const task = taskStore.getTask(taskId);
    return task?.result || null;
  }

  cancelTask(taskId: string): boolean {
    const task = taskStore.getTask(taskId);
    if (!task || task.status !== AITaskStatus.PENDING) {
      return false;
    }

    taskStore.updateTaskStatus(taskId, AITaskStatus.CANCELLED);
    console.log(`[AI Task Queue] Task cancelled: ${taskId}`);
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
  } {
    const allTasks = taskStore.getAllTasks();
    return {
      pending: allTasks.filter((t) => t.status === AITaskStatus.PENDING).length,
      processing: allTasks.filter((t) => t.status === AITaskStatus.PROCESSING).length,
      completed: allTasks.filter((t) => t.status === AITaskStatus.COMPLETED).length,
      failed: allTasks.filter((t) => t.status === AITaskStatus.FAILED).length,
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Convenience methods for common tasks

  enqueueInsightGeneration(userId: string, accounts: any[], transactions: any[]): string {
    return this.enqueueTask(
      AITaskType.INSIGHT_GENERATION,
      { accounts, transactions },
      userId,
      { priority: AITaskPriority.NORMAL }
    );
  }

  enqueueCashflowSimulation(userId: string, transactions: any[], horizon: number = 30): string {
    return this.enqueueTask(
      AITaskType.CASHFLOW_SIMULATION,
      { transactions, horizon },
      userId,
      { priority: AITaskPriority.LOW }
    );
  }

  enqueueFinancialReport(userId: string, transactions: any[], month: number, year: number): string {
    return this.enqueueTask(
      AITaskType.FINANCIAL_REPORT,
      { transactions, month, year },
      userId,
      { priority: AITaskPriority.NORMAL }
    );
  }

  enqueueLeakDetection(userId: string, transactions: any[]): string {
    return this.enqueueTask(
      AITaskType.LEAK_DETECTION,
      { transactions },
      userId,
      { priority: AITaskPriority.HIGH }
    );
  }

  enqueueAutopilotAnalysis(
    userId: string,
    accounts: any[],
    transactions: any[],
    goals?: any[]
  ): string {
    return this.enqueueTask(
      AITaskType.AUTOPILOT_ANALYSIS,
      { accounts, transactions, goals },
      userId,
      { priority: AITaskPriority.NORMAL }
    );
  }

  enqueueRiskAnalysis(userId: string, accounts: any[], transactions: any[]): string {
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

// Sprint 3 simple function API.
export function enqueueTask<T = any>(type: AITaskType, payload: T): string {
  if (!aiTaskQueue.isInitialized()) {
    aiTaskQueue.initialize();
  }
  return aiTaskQueue.enqueueTask(type, payload, 'system');
}
