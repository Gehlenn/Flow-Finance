/**
 * SUBSCRIPTION DETECTOR — src/ai/subscriptionDetector.ts
 *
 * Detecta assinaturas e pagamentos recorrentes nas transações.
 *
 * Estratégias de detecção:
 *   1. Matching por catálogo de serviços conhecidos (Netflix, Spotify, etc.)
 *   2. Detecção de padrões temporais — mesmo valor, intervalo regular (~30d/7d)
 *   3. Heurística de "small recurring" — pagamentos pequenos mensais sem variação
 */

import { Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';
import {
  normalizeSubscriptionText,
  roundSubscriptionAmount,
  type SubscriptionBillingCycle,
} from './subscriptionDetectionCore';
import {
  detectCycle,
  estimateNextCharge,
  groupTransactionsByAmount,
  parseSubscriptionDate,
  txMatchesService,
} from './subscriptionDetectorHelpers';
import { KNOWN_SERVICES } from './subscriptionDetectorCatalog';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface DetectedSubscription {
  id:            string;
  name:          string;           // Nome normalizado (ex: "Netflix")
  merchant:      string;           // Nome como aparece nas transações
  amount:        number;           // Valor típico da cobrança
  cycle:         SubscriptionBillingCycle;
  last_charge:   string;           // ISO date da cobrança mais recente
  next_expected: string | null;    // Estimativa da próxima cobrança
  occurrences:   number;          // Quantas vezes foi detectado
  total_spent:   number;          // Total gasto até hoje
  category:      string;          // Categoria sugerida
  logo:          string;          // emoji logo
  confidence:    number;          // 0–1
  transactions:  Transaction[];   // Transações relacionadas
}

export interface SubscriptionSummary {
  subscriptions:    DetectedSubscription[];
  total_monthly:    number;   // Custo mensal estimado
  total_annual:     number;   // Projeção anual
  count:            number;
  highest_cost:     DetectedSubscription | null;
  categories:       Record<string, number>;  // categoria → total mensal
}


/**
 * Detecta assinaturas e pagamentos recorrentes nas transações.
 *
 * @param transactions - lista completa de transações do usuário
 * @returns SubscriptionSummary com lista detalhada de assinaturas encontradas
 */
export function detectSubscriptions(transactions: Transaction[]): SubscriptionSummary {
  const expenses = transactions.filter(
    t => t.type === TransactionType.DESPESA && !t.generated
  );

  const results: DetectedSubscription[] = [];
  const matchedTxIds = new Set<string>();

  // ── Strategy 1: Known service catalog ─────────────────────────────────────
  for (const service of KNOWN_SERVICES) {
    const matching = expenses.filter(tx => txMatchesService(tx, service));
    if (matching.length === 0) continue;

    for (const amountGroup of groupTransactionsByAmount(matching)) {
      const sorted = [...amountGroup].sort((a, b) => {
        const left = parseSubscriptionDate(a.date);
        const right = parseSubscriptionDate(b.date);
        if (!left && !right) return b.date.localeCompare(a.date);
        if (!left) return 1;
        if (!right) return -1;
        return right.getTime() - left.getTime();
      });
      const amounts = amountGroup.map(t => t.amount);
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const cycle = detectCycle(amountGroup);

      let confidence = 0.7;
      if (amountGroup.length >= 2) confidence += 0.15;
      if (amountGroup.length >= 3) confidence += 0.10;
      if (cycle !== 'unknown') confidence += 0.05;
      confidence = Math.min(1, confidence);

      amountGroup.forEach(t => matchedTxIds.add(t.id));

      results.push({
        id:            makeId(),
        name:          service.name,
        merchant:      sorted[0].merchant ?? sorted[0].description,
        amount:        roundSubscriptionAmount(avgAmount),
        cycle,
        last_charge:   sorted[0].date,
        next_expected: estimateNextCharge(sorted[0].date, cycle),
        occurrences:   amountGroup.length,
        total_spent:   amounts.reduce((s, a) => s + a, 0),
        category:      service.category,
        logo:          service.logo,
        confidence,
        transactions:  sorted,
      });
    }
  }

  // ── Strategy 2: Pattern-based detection (unknown recurring payments) ───────
  // Group unmatched expenses by normalised description similarity
  const unmatched = expenses.filter(t => !matchedTxIds.has(t.id));
  const groups: Record<string, Transaction[]> = {};

  for (const tx of unmatched) {
    // Usar o 'merchant' normalizado como chave principal, que é mais estável.
    // Usar o 'fingerprint' da descrição como fallback.
    const key = normalizeSubscriptionText(tx.merchant || '') || normalizeSubscriptionText(tx.description ?? '')
      .replace(/\d+/g, '#')
      .slice(0, 20)
      .trim();
      
    if (!key || key.length < 3) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue; // need at least 2 occurrences

    const amounts = txs.map(t => t.amount);
    const avgAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map(a => Math.abs(a - avgAmt)));

    // Only flag as subscription if values are stable (< 15% deviation)
    if (maxDeviation / avgAmt > 0.15) continue;

    const cycle = detectCycle(txs);
    if (cycle === 'unknown') continue; // must have a recognisable pattern

    const sorted = [...txs].sort((a, b) => {
      const left = parseSubscriptionDate(a.date);
      const right = parseSubscriptionDate(b.date);
      if (!left && !right) return b.date.localeCompare(a.date);
      if (!left) return 1;
      if (!right) return -1;
      return right.getTime() - left.getTime();
    });
    const name = (sorted[0].merchant ?? sorted[0].description).slice(0, 40);

    let confidence = 0.5;
    if (txs.length >= 3) confidence += 0.15;
    if (maxDeviation === 0) confidence += 0.15; // exact same value every time
    // cycle is guaranteed not to be 'unknown' here due to guard above; skip redundant check


    results.push({
      id:            makeId(),
      name,
      merchant:      name,
      amount:        roundSubscriptionAmount(avgAmt),
      cycle,
      last_charge:   sorted[0].date,
      next_expected: estimateNextCharge(sorted[0].date, cycle),
      occurrences:   txs.length,
      total_spent:   amounts.reduce((s, a) => s + a, 0),
      category:      'Assinatura',
      logo:          '🔄',
      confidence,
      transactions:  sorted,
    });
  }

  // ── Sort by amount desc ────────────────────────────────────────────────────
  results.sort((a, b) => b.amount - a.amount);

  // ── Summary ───────────────────────────────────────────────────────────────
  const toMonthly = (sub: DetectedSubscription): number => {
    if (sub.cycle === 'monthly')  return sub.amount;
    if (sub.cycle === 'weekly')   return sub.amount * 4.33;
    if (sub.cycle === 'annual')   return sub.amount / 12;
    return sub.amount; // assume monthly if unknown
  };

  const total_monthly = results.reduce((s, sub) => s + toMonthly(sub), 0);
  const total_annual  = total_monthly * 12;

  const categories: Record<string, number> = {};
  for (const sub of results) {
    categories[sub.category] = (categories[sub.category] ?? 0) + toMonthly(sub);
  }

  return {
    subscriptions: results,
    total_monthly:  Math.round(total_monthly * 100) / 100,
    total_annual:   Math.round(total_annual * 100) / 100,
    count:          results.length,
    highest_cost:   results[0] ?? null,
    categories,
  };
}

// ─── Utility exports ──────────────────────────────────────────────────────────

/** Format next charge date in a human-readable way */
export function formatNextCharge(iso: string | null): string {
  if (!iso) return 'Indeterminado';
  const d = parseSubscriptionDate(iso);
  if (!d) return 'Indeterminado';
  const diffDays = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diffDays < 0)  return 'Atrasado';
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays < 7)   return `Em ${diffDays} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Cycle label in Portuguese */
export function formatCycle(cycle: SubscriptionBillingCycle): string {
  const labels: Record<SubscriptionBillingCycle, string> = {
    monthly: 'Mensal',
    weekly:  'Semanal',
    annual:  'Anual',
    unknown: 'Recorrente',
  };
  return labels[cycle];
}

