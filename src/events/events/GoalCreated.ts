export const GOAL_CREATED = 'goal.created';

export interface GoalCreatedEvent {
  goalId: string;
  title: string;
  targetAmount: number;
  createdAt: string;
}
