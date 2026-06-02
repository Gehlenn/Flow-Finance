import { type Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';
import { type LegacyAutopilotAction } from './signalEngine';

export const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple',
  'youtube', 'deezer', 'globoplay', 'paramount', 'assinatura',
  'mensalidade', 'plano', 'subscription', 'prime',
];

export const DELIVERY_KEYWORDS = [
  'ifood', 'rappi', 'uber eats', 'delivery', '99food',
  'james', 'loggi', 'entrega', 'pedido',
];

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseAutopilotDate(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const parsed = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMonthTxs(txs: Transaction[], monthsAgo: number): Transaction[] {
  const reference = new Date();
  const from = new Date(reference.getFullYear(), reference.getMonth() - monthsAgo, 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() - monthsAgo + 1, 0, 23, 59, 59);

  return txs.filter((transaction) => {
    const parsed = parseAutopilotDate(transaction.date);
    return Boolean(parsed && parsed >= from && parsed <= to);
  });
}

export function totalExpenses(txs: Transaction[]): number {
  return txs
    .filter((transaction) => transaction.type === TransactionType.DESPESA && !transaction.generated)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export function pushDefaultAction(actions: LegacyAutopilotAction[]): void {
  if (actions.length === 0) {
    actions.push({
      id: makeId(),
      type: 'insight',
      severity: 'low',
      title: 'Saude financeira estavel',
      description: 'Nenhum padrao critico identificado no momento.',
      action_label: 'Ver painel',
      created_at: nowIso(),
    });
  }
}

export function sortAutopilotActions(actions: LegacyAutopilotAction[]): LegacyAutopilotAction[] {
  const severityOrder: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
  const typeOrder: Record<LegacyAutopilotAction['type'], number> = {
    warning: 0,
    suggestion: 1,
    optimization: 2,
    insight: 3,
  };

  return actions.sort((left, right) => {
    const typeDiff = typeOrder[left.type] - typeOrder[right.type];
    if (typeDiff !== 0) return typeDiff;
    return severityOrder[left.severity ?? 'low'] - severityOrder[right.severity ?? 'low'];
  });
}
