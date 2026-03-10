/**
 * AI Task Store
 * Manages task persistence and retrieval
 */

import { AITask, AITaskStatus, AITaskPriority } from './taskTypes';

const STORAGE_KEY = 'flow_ai_task_queue';
const MAX_STORED_TASKS = 100;
const TASK_TTL = 24 * 60 * 60 * 1000; // 24 hours

class TaskStore {
  private tasks: Map<string, AITask> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.tasks = new Map(Object.entries(parsed));
        this.cleanExpiredTasks();
      }
      this.initialized = true;
    } catch (error) {
      console.error('[TaskStore] Failed to load from storage:', error);
      this.tasks = new Map();
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    try {
      const obj = Object.fromEntries(this.tasks);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error('[TaskStore] Failed to save to storage:', error);
    }
  }

  private cleanExpiredTasks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, task] of this.tasks) {
      // Remove completed/failed tasks older than TTL
      if (
        (task.status === AITaskStatus.COMPLETED || task.status === AITaskStatus.FAILED) &&
        now - task.createdAt > TASK_TTL
      ) {
        this.tasks.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TaskStore] Cleaned ${cleaned} expired tasks`);
      this.saveToStorage();
    }
  }

  addTask(task: AITask): void {
    this.tasks.set(task.id, task);
    
    // Enforce max tasks limit (keep most recent)
    if (this.tasks.size > MAX_STORED_TASKS) {
      const sorted = Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
      const toKeep = sorted.slice(0, MAX_STORED_TASKS);
      this.tasks = new Map(toKeep.map((t) => [t.id, t]));
    }

    this.saveToStorage();
  }

  getTask(id: string): AITask | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<AITask>): void {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
      this.tasks.set(id, task);
      this.saveToStorage();
    }
  }

  updateTaskStatus(id: string, status: AITaskStatus, error?: string): void {
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
    }
  }

  getNextTask(userId?: string): AITask | null {
    // Get pending tasks sorted by priority (high to low) then creation time (old to new)
    const pendingTasks = Array.from(this.tasks.values())
      .filter((task) => task.status === AITaskStatus.PENDING)
      .filter((task) => !userId || task.userId === userId)
      .sort((a, b) => {
        // First by priority (higher priority first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by creation time (older first)
        return a.createdAt - b.createdAt;
      });

    return pendingTasks.length > 0 ? pendingTasks[0] : null;
  }

  getUserTaskSnapshot(userId: string): {
    pending: AITask[];
    processing: AITask[];
    completed: AITask[];
    failed: AITask[];
  } {
    const userTasks = this.getTasksByUser(userId);
    return {
      pending: userTasks.filter((t) => t.status === AITaskStatus.PENDING),
      processing: userTasks.filter((t) => t.status === AITaskStatus.PROCESSING),
      completed: userTasks.filter((t) => t.status === AITaskStatus.COMPLETED),
      failed: userTasks.filter((t) => t.status === AITaskStatus.FAILED),
    };
  }

  getTasksByStatus(status: AITaskStatus): AITask[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.status === status)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getTasksByUser(userId: string): AITask[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getPendingCount(): number {
    return Array.from(this.tasks.values()).filter((t) => t.status === AITaskStatus.PENDING).length;
  }

  getProcessingCount(): number {
    return Array.from(this.tasks.values()).filter((t) => t.status === AITaskStatus.PROCESSING).length;
  }

  clearCompletedTasks(userId?: string): void {
    for (const [id, task] of this.tasks) {
      if (task.status === AITaskStatus.COMPLETED || task.status === AITaskStatus.FAILED) {
        if (!userId || task.userId === userId) {
          this.tasks.delete(id);
        }
      }
    }
    this.saveToStorage();
  }

  getAllTasks(): AITask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  clear(): void {
    this.tasks.clear();
    this.saveToStorage();
  }
}

// Singleton instance
export const taskStore = new TaskStore();

// Sprint 3 simple function API wrappers.
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
