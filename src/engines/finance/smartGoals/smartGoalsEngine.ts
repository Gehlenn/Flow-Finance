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

// ─── A2: Avaliação de viabilidade e recomendação de meta ────────────────────

export type GoalFeasibility = 'viavel' | 'esticado' | 'inviavel';

export interface GoalFeasibilityResult {
  feasibility: GoalFeasibility;
  estimatedMonths: number | null;
  shortfallPerMonth: number;   // > 0 se capacidade < necessidade
  surplusPerMonth: number;     // > 0 se capacidade > necessidade (sobra)
  suggestion: string;
}

/**
 * Avalia a viabilidade de uma meta financeira dado a capacidade mensal real
 * derivada do histórico (income - expenses nos últimos meses).
 *
 * @param goal              Meta financeira
 * @param availableMonthly  Capacidade de poupança mensal atual (income - expenses)
 */
export function assessGoalFeasibility(
  goal: SmartGoal,
  availableMonthly: number,
): GoalFeasibilityResult {
  const plan = calculateGoalPlan(goal);
  const remaining = plan.remaining;

  if (remaining === 0) {
    return {
      feasibility: 'viavel',
      estimatedMonths: 0,
      shortfallPerMonth: 0,
      surplusPerMonth: availableMonthly,
      suggestion: 'Meta ja atingida!',
    };
  }

  const monthly = plan.recommendedMonthlySavings;

  // Sem data-alvo: estima meses com base na capacidade disponível
  if (monthly === null) {
    if (availableMonthly <= 0) {
      return {
        feasibility: 'inviavel',
        estimatedMonths: null,
        shortfallPerMonth: Math.abs(availableMonthly),
        surplusPerMonth: 0,
        suggestion: 'Sem capacidade de poupanca atual. Reduza despesas antes de definir a meta.',
      };
    }
    const estimated = Math.ceil(remaining / availableMonthly);
    return {
      feasibility: 'viavel',
      estimatedMonths: estimated,
      shortfallPerMonth: 0,
      surplusPerMonth: availableMonthly,
      suggestion: `Sem data definida: meta estimada em ${estimated} mes${estimated !== 1 ? 'es' : ''}.`,
    };
  }

  const diff = availableMonthly - monthly;
  const ratio = monthly > 0 ? availableMonthly / monthly : 0;

  let feasibility: GoalFeasibility;
  if (ratio >= 1) {
    feasibility = 'viavel';
  } else if (ratio >= 0.7) {
    feasibility = 'esticado';
  } else {
    feasibility = 'inviavel';
  }

  const estimatedMonths = availableMonthly > 0
    ? Math.ceil(remaining / availableMonthly)
    : null;

  let suggestion: string;
  if (feasibility === 'viavel') {
    suggestion = `Meta viavel com capacidade atual. Reserva mensal necessaria: R$ ${monthly.toFixed(2)}.`;
  } else if (feasibility === 'esticado') {
    suggestion = `Capacidade apertada (${(ratio * 100).toFixed(0)}% do necessario). Considere estender o prazo ou aumentar receita.`;
  } else {
    suggestion = `Capacidade insuficiente: faltam R$ ${Math.abs(diff).toFixed(2)}/mes. Revise a meta ou o prazo.`;
  }

  return {
    feasibility,
    estimatedMonths,
    shortfallPerMonth: diff < 0 ? Number(Math.abs(diff).toFixed(2)) : 0,
    surplusPerMonth: diff > 0 ? Number(diff.toFixed(2)) : 0,
    suggestion,
  };
}

export interface GoalRecommendation {
  goalType: 'reserva_emergencia' | 'quitar_divida' | 'investimento' | 'economizar';
  suggestedTarget: number;
  rationale: string;
  priorityScore: number;  // 0..100 (maior = mais urgente)
}

/**
 * Recomenda a próxima meta financeira ideal baseada em renda, despesas e perfil.
 */
export function recommendGoal(
  monthlyIncome: number,
  monthlyExpenses: number,
  profile: string,
  existingReserve: number = 0,
): GoalRecommendation {
  const savingsRate = monthlyIncome > 0
    ? (monthlyIncome - monthlyExpenses) / monthlyIncome
    : 0;

  // Reserva de emergência = 6 meses de despesas
  const emergencyTarget = monthlyExpenses * 6;
  const reserveCoverage = emergencyTarget > 0 ? existingReserve / emergencyTarget : 1;

  // Prioridade 1: reserva de emergência incompleta
  if (reserveCoverage < 1) {
    const required = Number((emergencyTarget - existingReserve).toFixed(2));
    const priority = Math.round(90 - reserveCoverage * 60);
    return {
      goalType: 'reserva_emergencia',
      suggestedTarget: required,
      rationale: `Reserva de emergencia cobre apenas ${(reserveCoverage * 100).toFixed(0)}% do ideal (6 meses de despesas = R$ ${emergencyTarget.toFixed(2)}).`,
      priorityScore: priority,
    };
  }

  // Prioridade 2: perfil Spender/Risk Taker sem poupança adequada → quitar dívidas
  if ((profile === 'Spender' || profile === 'Risk Taker') && savingsRate < 0.1) {
    const debtReduction = Number((monthlyExpenses * 0.2).toFixed(2));
    return {
      goalType: 'quitar_divida',
      suggestedTarget: debtReduction,
      rationale: `Perfil ${profile} com poupanca abaixo de 10%. Direcionar R$ ${debtReduction.toFixed(2)}/mes para quitar dividas melhora a saude financeira.`,
      priorityScore: 75,
    };
  }

  // Prioridade 3: perfil Balanced/Saver → investimento
  if ((profile === 'Balanced' || profile === 'Saver') && savingsRate >= 0.15) {
    const investTarget = Number((monthlyIncome * 0.1 * 12).toFixed(2));
    return {
      goalType: 'investimento',
      suggestedTarget: investTarget,
      rationale: `Perfil ${profile} com poupanca saudavel (${(savingsRate * 100).toFixed(0)}%). Recomendado alocar 10% da renda mensal em investimentos.`,
      priorityScore: 55,
    };
  }

  // Default: meta de economia geral
  const econTarget = Number((monthlyIncome * 0.15 * 12).toFixed(2));
  return {
    goalType: 'economizar',
    suggestedTarget: econTarget,
    rationale: `Meta de poupanca de 15% da renda anual (R$ ${econTarget.toFixed(2)}) para fortalecer a reserva.`,
    priorityScore: 40,
  };
}
