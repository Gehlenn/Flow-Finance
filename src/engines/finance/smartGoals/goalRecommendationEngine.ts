export interface GoalRecommendationForecast {
  in30Days?: number;
}

export interface GoalRecommendationHealth {
  score: number;
}

export function recommendGoalAdjustment(
  goalPlan: { recommendedMonthlySavings: number | null },
  forecast: GoalRecommendationForecast,
  health: GoalRecommendationHealth,
): string {
  if (health.score < 60) {
    return 'Antes de acelerar metas, estabilize sua saúde financeira.';
  }

  if ((forecast.in30Days ?? 0) < 0) {
    return 'Seu fluxo projetado está apertado. Ajuste o valor da meta ou o prazo.';
  }

  if (goalPlan.recommendedMonthlySavings === null) {
    return 'Defina uma data-alvo para obter recomendação mensal mais precisa.';
  }

  return 'Sua meta está alinhada com sua capacidade financeira atual.';
}
