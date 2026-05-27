import { type Account } from '../../models/Account';
import { Category, Transaction, TransactionType } from '../../types';
import { makeId, formatCurrency } from '../../utils/helpers';
import { detectSubscriptions } from './subscriptionDetector';
import type { CashflowPrediction, FinancialRiskAlert } from './riskAnalyzer';
import type { AIInsight } from './insightGenerator';
import {
  classifyRiskType,
  getMonthTransactions,
  getSeverityRank,
  nowIso,
  totalExpenses,
} from './signalEngineHelpers';

export type FinancialSignalKind =
  | 'cash_warning'
  | 'expense_pattern'
  | 'projected_gap'
  | 'fixed_expense_detected'
  | 'subscription_detected'
  | 'opportunity';

export type FinancialSignalSeverity = 'info' | 'attention' | 'urgent';

export interface FinancialSignal {
  id: string;
  kind: FinancialSignalKind;
  severity: FinancialSignalSeverity;
  title: string;
  description: string;
  suggestedAction?: string;
  evidence: Record<string, unknown>;
  computed_at: string;
}

interface ComputeFinancialSignalsInput {
  accounts?: Account[];
  transactions: Transaction[];
  prediction: CashflowPrediction;
  userId?: string;
}

export function computeFinancialSignals({
  accounts = [],
  transactions,
  prediction,
}: ComputeFinancialSignalsInput): FinancialSignal[] {
  const baseTransactions = transactions.filter((transaction) => !transaction.generated);
  const currentMonthTransactions = getMonthTransactions(baseTransactions, 0);
  const lastMonthTransactions = getMonthTransactions(baseTransactions, 1);
  const currentExpenses = totalExpenses(currentMonthTransactions);
  const lastExpenses = totalExpenses(lastMonthTransactions);
  const signals: FinancialSignal[] = [];

  if (prediction.balance_30_days < 0) {
    signals.push({
      id: makeId(),
      kind: 'projected_gap',
      severity: 'urgent',
      title: 'Risco de caixa no horizonte',
      description: `A projeção de 30 dias aponta saldo de ${formatCurrency(prediction.balance_30_days)}. Vale revisar saídas e antecipar entradas.`,
      suggestedAction: 'Revisar fluxo dos próximos 30 dias',
      evidence: {
        balance_30_days: prediction.balance_30_days,
        projected_income: prediction.projected_income,
        projected_expenses: prediction.projected_expenses,
      },
      computed_at: nowIso(),
    });
  }

  if (
    prediction.current_balance > 0 &&
    prediction.balance_7_days < prediction.current_balance * 0.2
  ) {
    signals.push({
      id: makeId(),
      kind: 'cash_warning',
      severity: 'attention',
      title: 'Queda rápida de caixa',
      description: `Em 7 dias o caixa pode cair para ${formatCurrency(prediction.balance_7_days)}, abaixo de 20% do saldo atual.`,
      suggestedAction: 'Acompanhar compromissos da próxima semana',
      evidence: {
        current_balance: prediction.current_balance,
        balance_7_days: prediction.balance_7_days,
      },
      computed_at: nowIso(),
    });
  }

  if (lastExpenses > 0 && currentExpenses > lastExpenses * 1.2) {
    const increasePercent = Math.round(((currentExpenses - lastExpenses) / lastExpenses) * 100);
    signals.push({
      id: makeId(),
      kind: 'expense_pattern',
      severity: increasePercent >= 40 ? 'urgent' : 'attention',
      title: 'Aceleração de despesas',
      description: `As despesas deste mês estão ${increasePercent}% acima do mês anterior.`,
      suggestedAction: 'Comparar categorias com o mês passado',
      evidence: {
        current_month_expenses: currentExpenses,
        last_month_expenses: lastExpenses,
        increase_percent: increasePercent,
      },
      computed_at: nowIso(),
    });
  }

  const subscriptionSummary = detectSubscriptions(baseTransactions);
  if (subscriptionSummary.count > 0) {
    const estimatedMonthly = subscriptionSummary.subscriptions.reduce(
      (sum, subscription) => sum + subscription.amount,
      0,
    );
    signals.push({
      id: makeId(),
      kind: 'subscription_detected',
      severity: 'info',
      title: 'Recorrências identificadas',
      description: `${subscriptionSummary.count} assinatura(s) ou recorrencia(s) relevante(s) somam cerca de ${formatCurrency(estimatedMonthly)} por ciclo.`,
      suggestedAction: 'Revisar recorrências ativas',
      evidence: {
        subscriptions: subscriptionSummary.subscriptions.map((subscription) => ({
          name: subscription.name,
          average_amount: subscription.amount,
          cycle: subscription.cycle,
        })),
      },
      computed_at: nowIso(),
    });
  }

  const fixedExpenseCandidates = currentMonthTransactions.filter(
    (transaction) =>
      transaction.type === TransactionType.DESPESA &&
      (transaction.recurring || subscriptionSummary.subscriptions.some((subscription) => subscription.name === transaction.merchant || subscription.name === transaction.description)),
  );
  if (fixedExpenseCandidates.length >= 2) {
    const fixedExpenseTotal = fixedExpenseCandidates.reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );
    signals.push({
      id: makeId(),
      kind: 'fixed_expense_detected',
      severity: 'info',
      title: 'Base fixa de despesas mapeada',
      description: `As despesas recorrentes do mês já comprometem ${formatCurrency(fixedExpenseTotal)} do caixa.`,
      suggestedAction: 'Separar despesas fixas das variáveis',
      evidence: {
        recurring_transactions: fixedExpenseCandidates.length,
        recurring_total: fixedExpenseTotal,
      },
      computed_at: nowIso(),
    });
  }

  const expenseByCategory = currentMonthTransactions
    .filter((transaction) => transaction.type === TransactionType.DESPESA)
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + transaction.amount;
      return accumulator;
    }, {});
  const topCategoryEntry = Object.entries(expenseByCategory).sort((left, right) => right[1] - left[1])[0];
  if (topCategoryEntry) {
    const [category, amount] = topCategoryEntry;
    const totalExpenseBase = Object.values(expenseByCategory).reduce((sum, value) => sum + value, 0);
    const ratio = totalExpenseBase > 0 ? amount / totalExpenseBase : 0;
    if (ratio >= 0.35) {
      signals.push({
        id: makeId(),
        kind: 'opportunity',
        severity: ratio >= 0.5 ? 'attention' : 'info',
        title: 'Categoria dominante com potencial de ajuste',
        description: `${category} concentra ${Math.round(ratio * 100)}% das despesas do mês.`,
        suggestedAction: 'Avaliar cortes ou teto específico para a categoria',
        evidence: {
          category,
          amount,
          ratio,
        },
        computed_at: nowIso(),
      });
    }
  }

  if (accounts.length === 0 && baseTransactions.length > 0) {
    signals.push({
      id: makeId(),
      kind: 'opportunity',
      severity: 'info',
      title: 'Leitura baseada só em transações',
      description: 'Sem contas conectadas, as recomendações usam apenas o histórico de transações já registrado.',
      suggestedAction: 'Revisar saldo manualmente antes de decidir',
      evidence: {
        transaction_count: baseTransactions.length,
        accounts_connected: accounts.length,
      },
      computed_at: nowIso(),
    });
  }

  return signals.sort((left, right) => getSeverityRank(left.severity) - getSeverityRank(right.severity));
}

export function signalsToInsights(signals: FinancialSignal[], userId = 'local'): AIInsight[] {
  return signals.map((signal) => ({
    id: signal.id,
    user_id: userId,
    type: signal.kind === 'opportunity' ? 'saving' : signal.severity === 'urgent' ? 'warning' : 'spending',
    message: signal.description,
    severity:
      signal.severity === 'urgent'
        ? 'high'
        : signal.severity === 'attention'
          ? 'medium'
          : 'low',
    created_at: signal.computed_at,
  }));
}

export function signalsToRisks(signals: FinancialSignal[]): FinancialRiskAlert[] {
  return signals
    .filter((signal) => signal.severity !== 'info')
    .map((signal) => ({
      id: signal.id,
      type: classifyRiskType(signal.kind),
      message: signal.description,
      severity: signal.severity === 'urgent' ? 'high' : 'medium',
    }));
}

export interface ConsultantProfile {
  emoji: string;
  label: string;
  profile: string;
  description: string;
  score: {
    disciplina: number;
    previsibilidade: number;
  };
}

export function buildConsultantProfile(
  transactions: Transaction[],
  prediction: CashflowPrediction,
  signals: FinancialSignal[],
): ConsultantProfile {
  const expenseTransactions = transactions.filter(
    (transaction) => !transaction.generated && transaction.type === TransactionType.DESPESA,
  );
  const recurringExpenseCount = expenseTransactions.filter((transaction) => transaction.recurring).length;
  const urgentSignals = signals.filter((signal) => signal.severity === 'urgent').length;
  const attentionSignals = signals.filter((signal) => signal.severity === 'attention').length;

  const disciplineScore = Math.max(0, Math.min(10, 8 - urgentSignals * 2 - attentionSignals));
  const predictabilityScore = Math.max(
    0,
    Math.min(10, recurringExpenseCount >= 2 ? 8 : 5 + Math.min(recurringExpenseCount, 3)),
  );

  if (prediction.balance_30_days < 0) {
    return {
      emoji: '⚠️',
      label: 'Fluxo pressionado',
      profile: 'pressionado',
      description: 'A operação pede revisão rápida de caixa antes de assumir novas saídas.',
      score: {
        disciplina: disciplineScore,
        previsibilidade: predictabilityScore,
      },
    };
  }

  if (signals.some((signal) => signal.kind === 'subscription_detected' || signal.kind === 'fixed_expense_detected')) {
    return {
      emoji: '📌',
      label: 'Fluxo recorrente',
      profile: 'recorrente',
      description: 'Já existe base previsível para orientar decisões consultivas com mais contexto.',
      score: {
        disciplina: disciplineScore,
        previsibilidade: predictabilityScore,
      },
    };
  }

  return {
    emoji: '📊',
    label: 'Fluxo em observação',
    profile: 'observacao',
    description: 'O histórico atual sustenta sinais consultivos, mas ainda pede acompanhamento próximo.',
    score: {
      disciplina: disciplineScore,
      previsibilidade: predictabilityScore,
    },
  };
}

export interface LegacyAutopilotAction {
  id: string;
  type: 'warning' | 'suggestion' | 'optimization' | 'insight';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
  category?: string;
  value?: number;
  action_label?: string;
  created_at: string;
}

export function toLegacyAutopilotActions(signals: FinancialSignal[]): LegacyAutopilotAction[] {
  return signals.map((signal) => ({
    id: signal.id,
    type:
      signal.kind === 'projected_gap' || signal.kind === 'cash_warning' || signal.kind === 'expense_pattern'
        ? 'warning'
        : signal.kind === 'opportunity'
          ? 'optimization'
          : 'insight',
    title: signal.title,
    description: signal.description,
    severity:
      signal.severity === 'urgent'
        ? 'high'
        : signal.severity === 'attention'
          ? 'medium'
          : 'low',
    category:
      typeof signal.evidence.category === 'string'
        ? signal.evidence.category
        : signal.kind === 'subscription_detected'
          ? 'Assinaturas'
          : signal.kind === 'fixed_expense_detected'
            ? Category.NEGOCIO
            : undefined,
    value: typeof signal.evidence.amount === 'number'
      ? signal.evidence.amount
      : typeof signal.evidence.recurring_total === 'number'
        ? signal.evidence.recurring_total
        : undefined,
    action_label: signal.suggestedAction,
    created_at: signal.computed_at,
  }));
}
