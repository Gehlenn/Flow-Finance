export interface FinancialHealthContext {
  expenseRatio: number;      // despesas / receita
  savingsRate: number;       // poupanca / receita
  debtRatio?: number;        // dividas / receita
  balanceStability?: number; // 0..1
  forecast?: { in30Days?: number };
  subscriptionCount?: number;
  dominantCategoryShare?: number; // 0..1
}

export interface FinancialHealthResult {
  score: number;
  status: 'critico' | 'atencao' | 'saudavel';
  alerts: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Camada 6: score de saúde financeira.
 */
export function calculateFinancialHealth(context: FinancialHealthContext): FinancialHealthResult {
  let score = 100;
  const alerts: string[] = [];

  if (context.expenseRatio > 0.8) {
    score -= 20;
    alerts.push('Suas despesas estão altas em relação à renda.');
  }

  if (context.expenseRatio > 1) {
    score -= 20;
    alerts.push('Suas despesas estão maiores que sua renda.');
  }

  if (context.savingsRate < 0.1) {
    score -= 15;
    alerts.push('Sua taxa de poupança está baixa.');
  }

  if ((context.debtRatio ?? 0) > 0.35) {
    score -= 10;
    alerts.push('Seu nível de dívida está elevado.');
  }

  if ((context.balanceStability ?? 1) < 0.5) {
    score -= 10;
    alerts.push('Seu saldo está instável nos últimos ciclos.');
  }

  if ((context.forecast?.in30Days ?? 0) < 0) {
    score -= 25;
    alerts.push('Seu saldo projetado para 30 dias está negativo.');
  }

  if ((context.subscriptionCount ?? 0) > 5) {
    score -= 10;
    alerts.push('Você possui muitas assinaturas recorrentes.');
  }

  if ((context.dominantCategoryShare ?? 0) > 0.45) {
    score -= 10;
    alerts.push('Há concentração excessiva de gastos em uma única categoria.');
  }

  score = clamp(score, 0, 100);

  const status = score >= 80
    ? 'saudavel'
    : score >= 60
      ? 'atencao'
      : 'critico';

  return { score, status, alerts };
}
