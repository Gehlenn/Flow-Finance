export const GOAL_CREATED = 'goal_created';

export interface GoalCreatedEvent {
  userId: string;
  goalId: string;
  title: string;
  targetAmount: number;
  createdAt: string;
}
