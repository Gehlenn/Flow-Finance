/**
 * AI Task Store
 * Manages task persistence and retrieval
 */

import { AITask, AITaskStatus } from './taskTypes';
import { getActiveWorkspaceScopedStorageKey } from '../../utils/workspaceStorage';
import { logInfo, logWarn } from '../../utils/logger';
import {
  QUEUE_EVENT_NAMES,
  countTasksByStatus,
  deserializeTaskMap,
  emitQueueEvent,
  filterTasksByStatus,
  filterTasksByUser,
  pruneExpiredTasks,
  serializeTaskMap,
  sortTasksByCreatedAtDesc,
  sortTasksByPriority,
  trimTaskMap,
} from './taskStoreHelpers';

const STORAGE_KEY = 'flow_ai_task_queue';
const MAX_STORED_TASKS = 100;
const TASK_TTL = 24 * 60 * 60 * 1000; // 24 hours

class TaskStore {
  private tasks: Map<string, AITask> = new Map();
  private initialized = false;
  private activeStorageKey = '';

  constructor() {
    this.loadFromStorage();
  }

  private getStorageKey(): string {
    return getActiveWorkspaceScopedStorageKey(STORAGE_KEY);
  }

  private ensureWorkspaceScope(): void {
    const nextStorageKey = this.getStorageKey();
    if (!this.initialized || this.activeStorageKey !== nextStorageKey) {
      this.loadFromStorage();
    }
  }

  private loadFromStorage(): void {
    this.activeStorageKey = this.getStorageKey();
    try {
      const stored = localStorage.getItem(this.activeStorageKey);
      if (stored) {
        this.tasks = deserializeTaskMap(stored);
        this.initialized = true;
        this.cleanExpiredTasks();
      } else {
        this.tasks = new Map();
        this.initialized = true;
      }
    } catch (error) {
      logWarn('[TaskStore] Failed to load from storage; using empty queue', {
        storageKey: this.activeStorageKey,
        error,
        fallback: 'task-store-load-failed',
      });
      this.tasks = new Map();
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    this.ensureWorkspaceScope();
    try {
      localStorage.setItem(this.activeStorageKey, serializeTaskMap(this.tasks));
    } catch (error) {
      logWarn('[TaskStore] Failed to save to storage; keeping in-memory queue', {
        storageKey: this.activeStorageKey,
        error,
        fallback: 'task-store-save-failed',
      });
    }
  }

  private cleanExpiredTasks(): void {
    const result = pruneExpiredTasks(this.tasks, TASK_TTL);
    this.tasks = result.tasks;

    if (result.cleaned > 0) {
      logInfo('[TaskStore] Cleaned expired tasks', {
        cleaned: result.cleaned,
        storageKey: this.activeStorageKey,
        fallback: 'task-store-cleaned-expired-tasks',
      });
      this.saveToStorage();
    }
  }

  addTask(task: AITask): void {
    this.ensureWorkspaceScope();
    this.tasks.set(task.id, task);
    this.tasks = trimTaskMap(this.tasks, MAX_STORED_TASKS);

    this.saveToStorage();
    emitQueueEvent('ai-task-enqueued', {
      taskId: task.id,
      taskType: task.type,
      status: task.status,
      priority: task.priority,
      userId: task.userId,
    });
  }

  getTask(id: string): AITask | undefined {
    this.ensureWorkspaceScope();
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<AITask>): void {
    this.ensureWorkspaceScope();
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
      this.tasks.set(id, task);
      this.saveToStorage();
    }
  }

  updateTaskStatus(id: string, status: AITaskStatus, error?: string): void {
    this.ensureWorkspaceScope();
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;

      if (status === AITaskStatus.PROCESSING) {
        task.startedAt = Date.now();
      } else if (status === AITaskStatus.COMPLETED || status === AITaskStatus.FAILED) {
        task.completedAt = Date.now();
      }

      if (error && status === AITaskStatus.FAILED) {
        task.error = {
          message: error,
          timestamp: Date.now(),
        };
      }

      this.tasks.set(id, task);
      this.saveToStorage();
      emitQueueEvent(QUEUE_EVENT_NAMES.UPDATED, {
        taskId: id,
        status,
        userId: task.userId,
      });
    }
  }

  getNextTask(userId?: string): AITask | null {
    this.ensureWorkspaceScope();
    const pendingTasks = sortTasksByPriority(
      filterTasksByStatus(Array.from(this.tasks.values()), AITaskStatus.PENDING).filter((task) => !userId || task.userId === userId),
    );

    return pendingTasks.length > 0 ? pendingTasks[0] : null;
  }

  getUserTaskSnapshot(userId: string): {
    pending: AITask[];
    processing: AITask[];
    completed: AITask[];
    failed: AITask[];
  } {
    this.ensureWorkspaceScope();
    const userTasks = this.getTasksByUser(userId);
    return {
      pending: filterTasksByStatus(userTasks, AITaskStatus.PENDING),
      processing: filterTasksByStatus(userTasks, AITaskStatus.PROCESSING),
      completed: filterTasksByStatus(userTasks, AITaskStatus.COMPLETED),
      failed: filterTasksByStatus(userTasks, AITaskStatus.FAILED),
    };
  }

  getTasksByStatus(status: AITaskStatus): AITask[] {
    this.ensureWorkspaceScope();
    return sortTasksByCreatedAtDesc(filterTasksByStatus(Array.from(this.tasks.values()), status));
  }

  getTasksByUser(userId: string): AITask[] {
    this.ensureWorkspaceScope();
    return sortTasksByCreatedAtDesc(filterTasksByUser(Array.from(this.tasks.values()), userId));
  }

  getPendingCount(): number {
    this.ensureWorkspaceScope();
    return countTasksByStatus(Array.from(this.tasks.values()), AITaskStatus.PENDING);
  }

  getProcessingCount(): number {
    this.ensureWorkspaceScope();
    return countTasksByStatus(Array.from(this.tasks.values()), AITaskStatus.PROCESSING);
  }

  clearCompletedTasks(userId?: string): void {
    this.ensureWorkspaceScope();
    for (const [id, task] of this.tasks) {
      if (task.status === AITaskStatus.COMPLETED || task.status === AITaskStatus.FAILED) {
        if (!userId || task.userId === userId) {
          this.tasks.delete(id);
        }
      }
    }

    this.saveToStorage();
    emitQueueEvent(QUEUE_EVENT_NAMES.CLEARED, {
      userId: userId ?? null,
      scope: userId ? 'user' : 'all',
    });
  }

  getAllTasks(): AITask[] {
    this.ensureWorkspaceScope();
    return sortTasksByCreatedAtDesc(Array.from(this.tasks.values()));
  }

  clear(): void {
    this.ensureWorkspaceScope();
    this.tasks.clear();
    this.saveToStorage();
    emitQueueEvent(QUEUE_EVENT_NAMES.CLEARED, {
      userId: null,
      scope: 'all',
    });
  }
}

export const taskStore = new TaskStore();

export function addTask(task: AITask): void {
  taskStore.addTask(task);
}

export function getNextTask(): AITask | null {
  return taskStore.getNextTask();
}

export function getNextTaskForUser(userId: string): AITask | null {
  return taskStore.getNextTask(userId);
}

export function updateTaskStatus(id: string, status: AITaskStatus): void {
  taskStore.updateTaskStatus(id, status);
}
