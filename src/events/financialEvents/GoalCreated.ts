export const GOAL_CREATED_EVENT = 'goal_created';

export interface GoalCreatedEvent {
  userId: string;
  goalId: string;
  targetAmount: number;
}
