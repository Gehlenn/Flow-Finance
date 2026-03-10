export const AI_TASK_COMPLETED = 'ai.task.completed';

export interface AITaskCompletedEvent {
  taskId: string;
  userId?: string;
  engine: string;
  durationMs: number;
  success: boolean;
}
