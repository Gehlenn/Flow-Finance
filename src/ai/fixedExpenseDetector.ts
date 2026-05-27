/**
 * FIXED EXPENSE DETECTOR â€” src/services/ai/fixedExpenseDetector.ts
 *
 * PART 5 â€” Detecta despesas fixas recorrentes:
 *   â€¢ Aluguel / moradia
 *   â€¢ Assinaturas de serviÃ§os
 *   â€¢ Contas de utilidades (luz, Ã¡gua, gÃ¡s, internet)
 *   â€¢ Seguros
 *   â€¢ Mensalidades (escola, academia, etc.)
 *   â€¢ Financiamentos / crÃ©dito
 *
 * Complementa o subscriptionDetector.ts (que foca em serviÃ§os digitais)
 * com uma visÃ£o mais ampla de todas as despesas fixas do usuÃ¡rio.
 */

import { Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';
import {
  avgDayOfMonth,
  detectAmountTrend,
  matchesPattern,
  median,
  nextExpectedDate,
  normalize,
  parseLocalDate,
} from './fixedExpenseDetectorHelpers';
import { FIXED_PATTERNS } from './fixedExpenseDetectorCatalog';
import { type ExpensePattern, type FixedExpense, type FixedExpenseCategory, type FixedExpenseReport } from './fixedExpenseDetectorTypes';

export type {
  ExpensePattern,
  FixedExpense,
  FixedExpenseCategory,
  FixedExpenseReport,
} from './fixedExpenseDetectorTypes';



// â”€â”€â”€ PART 5 â€” detectFixedExpenses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Detecta despesas fixas recorrentes nas transaÃ§Ãµes.
 *
 * @param transactions - lista completa de transaÃ§Ãµes do usuÃ¡rio
 * @param monthlyIncome - renda mensal (opcional, para calcular commitment_ratio)
 * @returns FixedExpenseReport
 */
export function detectFixedExpenses(
  transactions: Transaction[],
  monthlyIncome?: number
): FixedExpenseReport {
  const expenses = transactions.filter(
    t => t.type === TransactionType.DESPESA && !t.generated
  );

  const results: FixedExpense[] = [];
  const matchedIds = new Set<string>();

  // â”€â”€ Strategy 1: Pattern catalog matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for (const pattern of FIXED_PATTERNS) {
    const matching = expenses.filter(tx => !matchedIds.has(tx.id) && matchesPattern(tx, pattern));
    if (matching.length === 0) continue;

    // Group by similar amounts (within 15%)
    const subGroups: Transaction[][] = [];
    for (const tx of matching) {
      const existing = subGroups.find(g => {
        const avg = g.reduce((s, t) => s + t.amount, 0) / g.length;
        return Math.abs(tx.amount - avg) / avg < 0.15;
      });
      if (existing) existing.push(tx);
      else subGroups.push([tx]);
    }

    for (const sg of subGroups) {
      if (sg.length === 0) continue;
      const amounts = sg.map(t => t.amount);
      const sorted  = [...sg].sort((a, b) => {
        const left = parseLocalDate(a.date);
        const right = parseLocalDate(b.date);
        if (!left && !right) return b.date.localeCompare(a.date);
        if (!left) return 1;
        if (!right) return -1;
        return right.getTime() - left.getTime();
      });
      const dates   = sg.map(t => t.date).sort();
      const dom     = avgDayOfMonth(dates);

      // Confidence
      let confidence = 0.7;
      if (sg.length >= 2) confidence += 0.1;
      if (sg.length >= 3) confidence += 0.1;
      const amtVar = amounts.length > 1 ? (Math.max(...amounts) - Math.min(...amounts)) / median(amounts) : 0;
      if (amtVar < 0.03) confidence += 0.1; // exact same value

      results.push({
        id:           makeId(),
        name:         pattern.name,
        category:     pattern.category,
        amount:       median(amounts),
        amount_min:   Math.min(...amounts),
        amount_max:   Math.max(...amounts),
        amount_trend: detectAmountTrend(amounts),
        day_of_month: dom,
        occurrences:  sg.length,
        last_date:    sorted[0].date,
        next_expected: nextExpectedDate(sorted[0].date, dom),
        confidence:   Math.min(1, confidence),
        logo:         pattern.logo,
        transactions: sorted,
      });

      sg.forEach(tx => matchedIds.add(tx.id));
    }
  }

  // â”€â”€ Strategy 2: Pattern-based â€” unmatched stable recurring expenses â”€â”€â”€â”€â”€â”€â”€
  const unmatched = expenses.filter(t => !matchedIds.has(t.id));

  // Group by description fingerprint
  const groups: Record<string, Transaction[]> = {};
  for (const tx of unmatched) {
    const fingerprint = normalize(tx.description ?? '').slice(0, 14).replace(/\d/g, '#');
    if (!fingerprint || fingerprint.length < 3) continue;
    if (!groups[fingerprint]) groups[fingerprint] = [];
    groups[fingerprint].push(tx);
  }

  for (const [, group] of Object.entries(groups)) {
    if (group.length < 2) continue;

    const amounts = group.map(t => t.amount);
    const amtVar  = (Math.max(...amounts) - Math.min(...amounts)) / median(amounts);
    if (amtVar > 0.15) continue; // not stable enough

    const dates  = group.map(t => t.date).sort();
    const sorted = [...group].sort((a, b) => {
      const left = parseLocalDate(a.date);
      const right = parseLocalDate(b.date);
      if (!left && !right) return b.date.localeCompare(a.date);
      if (!left) return 1;
      if (!right) return -1;
      return right.getTime() - left.getTime();
    });
    const dom    = avgDayOfMonth(dates);

    // Must have regular monthly-ish interval
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const currentDate = parseLocalDate(dates[i]);
      const previousDate = parseLocalDate(dates[i - 1]);
      if (!currentDate || !previousDate) continue;
      gaps.push((currentDate.getTime() - previousDate.getTime()) / 86400000);
    }
    if (gaps.length === 0) continue;
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 20 || avgGap > 40) continue; // only monthly

    results.push({
      id:           makeId(),
      name:         sorted[0].merchant ?? sorted[0].description?.slice(0, 30) ?? 'Despesa Fixa',
      category:     'other_fixed',
      amount:       median(amounts),
      amount_min:   Math.min(...amounts),
      amount_max:   Math.max(...amounts),
      amount_trend: detectAmountTrend(amounts),
      day_of_month: dom,
      occurrences:  group.length,
      last_date:    sorted[0].date,
      next_expected: nextExpectedDate(sorted[0].date, dom),
      confidence:   0.55 + (group.length >= 3 ? 0.1 : 0),
      logo:         'ðŸ”„',
      transactions: sorted,
    });
  }

  // â”€â”€ Sort and aggregate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  results.sort((a, b) => b.amount - a.amount);

  const total_monthly = results.reduce((s, e) => s + e.amount, 0);
  const total_annual  = total_monthly * 12;

  const by_category: Record<FixedExpenseCategory, number> = {
    housing: 0, utilities: 0, subscription: 0, insurance: 0,
    education: 0, fitness: 0, transport: 0, financing: 0, other_fixed: 0,
  };
  for (const exp of results) {
    by_category[exp.category] = (by_category[exp.category] ?? 0) + exp.amount;
  }

  const commitment_ratio = monthlyIncome && monthlyIncome > 0
    ? total_monthly / monthlyIncome
    : undefined;

  return {
    expenses:          results,
    total_monthly:     Math.round(total_monthly * 100) / 100,
    total_annual:      Math.round(total_annual * 100) / 100,
    by_category,
    commitment_ratio,
    highest_expense:   results[0] ?? null,
    count:             results.length,
    has_housing:       (by_category.housing ?? 0) > 0,
    has_insurance:     (by_category.insurance ?? 0) > 0,
  };
}

// â”€â”€â”€ Utility exports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORY_LABELS: Record<FixedExpenseCategory, string> = {
  housing:      'Moradia',
  utilities:    'Utilidades',
  subscription: 'Assinaturas',
  insurance:    'Seguros',
  education:    'EducaÃ§Ã£o',
  fitness:      'SaÃºde / Fitness',
  transport:    'Transporte',
  financing:    'Financiamentos',
  other_fixed:  'Outros Fixos',
};

export function formatExpenseCategory(category: FixedExpenseCategory): string {
  return CATEGORY_LABELS[category] ?? 'Outros';
}

const CATEGORY_LOGOS: Record<FixedExpenseCategory, string> = {
  housing: 'ðŸ ', utilities: 'âš¡', subscription: 'ðŸ“±',
  insurance: 'ðŸ›¡ï¸', education: 'ðŸŽ“', fitness: 'ðŸ’ª',
  transport: 'ðŸšŒ', financing: 'ðŸ’³', other_fixed: 'ðŸ”„',
};

export function getCategoryLogo(category: FixedExpenseCategory): string {
  return CATEGORY_LOGOS[category] ?? 'ðŸ“Œ';
}

/** Semaphore-style commitment assessment */
export function assessCommitmentRatio(ratio: number | undefined): {
  label: string;
  color: string;
  warning: boolean;
} {
  if (!ratio) return { label: 'NÃ£o calculado', color: 'text-slate-400', warning: false };
  const pct = Math.round(ratio * 100);
  if (pct <= 30) return { label: `${pct}% da renda â€” saudÃ¡vel`, color: 'text-emerald-500', warning: false };
  if (pct <= 50) return { label: `${pct}% da renda â€” atenÃ§Ã£o`,  color: 'text-amber-500',  warning: false };
  return           { label: `${pct}% da renda â€” crÃ­tico`,       color: 'text-rose-500',   warning: true  };
}

