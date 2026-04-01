import { UserContext } from '../../context/UserContext';
import { Transaction, TransactionType } from '../../../types';

export interface BudgetInput {
  income: number;
  expenses: number;
}

export interface BudgetAnalysis {
  savingsRate: number;
  isHealthy: boolean;
  recommendation: string;
}

export function analyzeBudget(input: BudgetInput, _userContext?: UserContext): BudgetAnalysis {
  if (input.income <= 0) {
    return {
      savingsRate: 0,
      isHealthy: false,
      recommendation: 'Registre receitas para calcular a saude orcamentaria.',
    };
  }

  const net = input.income - input.expenses;
  const savingsRate = (net / input.income) * 100;

  if (savingsRate >= 20) {
    return { savingsRate, isHealthy: true, recommendation: 'Otimo ritmo de poupanca. Mantenha a consistencia.' };
  }

  if (savingsRate >= 10) {
    return { savingsRate, isHealthy: true, recommendation: 'Boa saude financeira. Busque reduzir gastos variaveis.' };
  }

  return { savingsRate, isHealthy: false, recommendation: 'Alerta: despesas elevadas. Reavalie categorias com maior impacto.' };
}

// ─── A1: Smart Budget por categoria ─────────────────────────────────────────

/** Peso de redução sugerida por perfil financeiro (0..1 = nenhum corte..corte máximo). */
const PROFILE_REDUCTION_FACTOR: Record<string, number> = {
  Saver: 0.05,
  Balanced: 0.1,
  'Risk Taker': 0.2,
  Spender: 0.25,
  Undefined: 0.1,
};

export interface CategoryBudgetLine {
  category: string;
  actualSpend: number;
  suggestedLimit: number;
  deviation: number;          // actualSpend - suggestedLimit (positivo = acima do limite)
  deviationPct: number;       // deviation / suggestedLimit * 100
  action: 'ok' | 'reduzir' | 'alertar';
}

export interface SmartBudgetResult {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  targetSavingsRate: number;
  lines: CategoryBudgetLine[];
  surplusForSavings: number;  // income - sum(suggestedLimits)
}

/**
 * Gera orçamento inteligente por categoria baseado em perfil financeiro e histórico.
 * - Distribui o orçamento de despesas proporcional ao histórico, mas aplica corte
 *   pelo fator do perfil para direcionar poupança ao target.
 * - Target de poupança: Saver ≥ 20%, Balanced ≥ 15%, Risk Taker/Spender ≥ 10%.
 */
export function generateSmartBudget(
  transactions: Transaction[],
  profile: string = 'Undefined',
): SmartBudgetResult {
  const income = transactions
    .filter((t) => t.type === TransactionType.RECEITA)
    .reduce((s, t) => s + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === TransactionType.DESPESA)
    .reduce((s, t) => s + t.amount, 0);

  const savingsRate = income > 0 ? (income - expenses) / income : 0;

  const targetSavingsRates: Record<string, number> = {
    Saver: 0.2,
    Balanced: 0.15,
    'Risk Taker': 0.1,
    Spender: 0.1,
    Undefined: 0.15,
  };
  const targetSavingsRate = targetSavingsRates[profile] ?? 0.15;

  // Orçamento total disponível para despesas, respeitando target de poupança
  const budgetForExpenses = income > 0 ? income * (1 - targetSavingsRate) : expenses;
  const reductionFactor = PROFILE_REDUCTION_FACTOR[profile] ?? 0.1;

  // Agrupar despesas por categoria
  const categoryMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== TransactionType.DESPESA) continue;
    categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + tx.amount);
  }

  const lines: CategoryBudgetLine[] = [];
  let totalSuggested = 0;

  for (const [category, actual] of categoryMap.entries()) {
    // Proporção dessa categoria no total de despesas
    const share = expenses > 0 ? actual / expenses : 0;
    // Limite proporcional ao budget disponível, com corte pelo fator do perfil
    const rawLimit = budgetForExpenses * share;
    const suggestedLimit = Number((rawLimit * (1 - reductionFactor)).toFixed(2));
    const deviation = Number((actual - suggestedLimit).toFixed(2));
    const deviationPct = suggestedLimit > 0 ? Number(((deviation / suggestedLimit) * 100).toFixed(1)) : 0;
    const action: CategoryBudgetLine['action'] =
      deviationPct > 20 ? 'reduzir' : deviationPct > 5 ? 'alertar' : 'ok';

    lines.push({ category, actualSpend: Number(actual.toFixed(2)), suggestedLimit, deviation, deviationPct, action });
    totalSuggested += suggestedLimit;
  }

  lines.sort((a, b) => b.deviation - a.deviation);

  return {
    totalIncome: Number(income.toFixed(2)),
    totalExpenses: Number(expenses.toFixed(2)),
    savingsRate: Number(savingsRate.toFixed(4)),
    targetSavingsRate,
    lines,
    surplusForSavings: Number((income - totalSuggested).toFixed(2)),
  };
}
