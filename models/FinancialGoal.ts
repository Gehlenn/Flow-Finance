export type GoalStatus = 'on_track' | 'at_risk' | 'completed' | 'overdue';

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  category?: string;
  color?: string;      // hex para personalização visual
  icon?: string;       // emoji
  created_at: string;
}

export interface GoalProgress {
  progress_percentage: number;
  remaining_amount: number;
  days_remaining: number | null;
  daily_savings_needed: number | null;
  status: GoalStatus;
}
