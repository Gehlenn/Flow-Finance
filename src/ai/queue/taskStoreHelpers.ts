import { AITask, AITaskPriority, AITaskStatus } from './taskTypes';

export const QUEUE_EVENT_NAMES = {
  UPDATED: 'ai-task-updated',
  CLEARED: 'ai-task-queue-cleared',
} as const;

export function emitQueueEvent(eventName: string, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function deserializeTaskMap(serialized: string): Map<string, AITask> {
  const parsed = JSON.parse(serialized) as Record<string, AITask>;
  return new Map(Object.entries(parsed));
}

export function serializeTaskMap(tasks: Map<string, AITask>): string {
  return JSON.stringify(Object.fromEntries(tasks));
}

export function pruneExpiredTasks(
  tasks: Map<string, AITask>,
  ttlMs: number,
  now = Date.now(),
): { cleaned: number; tasks: Map<string, AITask> } {
  const nextTasks = new Map(tasks);
  let cleaned = 0;

  for (const [id, task] of nextTasks) {
    if (
      (task.status === AITaskStatus.COMPLETED || task.status === AITaskStatus.FAILED) &&
      now - task.createdAt > ttlMs
    ) {
      nextTasks.delete(id);
      cleaned++;
    }
  }

  return { cleaned, tasks: nextTasks };
}

export function trimTaskMap(tasks: Map<string, AITask>, maxStoredTasks: number): Map<string, AITask> {
  if (tasks.size <= maxStoredTasks) {
    return tasks;
  }

  const sorted = Array.from(tasks.values()).sort((left, right) => right.createdAt - left.createdAt);
  return new Map(sorted.slice(0, maxStoredTasks).map((task) => [task.id, task]));
}

export function sortTasksByPriority(tasks: AITask[]): AITask[] {
  return [...tasks].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }
    return left.createdAt - right.createdAt;
  });
}

export function sortTasksByCreatedAtDesc(tasks: AITask[]): AITask[] {
  return [...tasks].sort((left, right) => right.createdAt - left.createdAt);
}

export function filterTasksByStatus(tasks: AITask[], status: AITaskStatus): AITask[] {
  return tasks.filter((task) => task.status === status);
}

export function filterTasksByUser(tasks: AITask[], userId: string): AITask[] {
  return tasks.filter((task) => task.userId === userId);
}

export function countTasksByStatus(tasks: AITask[], status: AITaskStatus): number {
  return tasks.reduce((count, task) => count + (task.status === status ? 1 : 0), 0);
}

export function isTaskPriority(value: unknown): value is AITaskPriority {
  return value === AITaskPriority.LOW || value === AITaskPriority.NORMAL || value === AITaskPriority.HIGH || value === AITaskPriority.URGENT;
}
