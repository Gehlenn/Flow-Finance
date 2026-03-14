export interface SmartGoal {
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
}

export interface GoalPlan {
  remaining: number;
  recommendedMonthlySavings: number | null;
}

export function calculateGoalPlan(goal: SmartGoal): GoalPlan {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  if (!goal.targetDate) {
    return {
      remaining,
      recommendedMonthlySavings: null,
    };
  }

  const today = new Date();
  const target = new Date(goal.targetDate);

  const months = Math.max(
    1,
    (target.getFullYear() - today.getFullYear()) * 12 +
      (target.getMonth() - today.getMonth()),
  );

  return {
    remaining,
    recommendedMonthlySavings: Number((remaining / months).toFixed(2)),
  };
}
