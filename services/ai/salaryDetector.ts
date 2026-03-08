/**
 * SALARY DETECTOR — src/services/ai/salaryDetector.ts
 *
 * PART 4 — Detecta renda recorrente (salário, freelance mensal, pró-labore, etc.)
 * nas transações do usuário.
 *
 * Estratégias:
 *   1. Keyword matching — "salário", "salario", "folha", "pagamento", etc.
 *   2. Pattern detection — valor similar, intervalo ~30 dias
 *   3. Amount fingerprinting — mesmo valor exato todo mês = alta confiança
 */

import { Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';

// ─── Models ───────────────────────────────────────────────────────────────────

export type IncomeType =
  | 'salary'          // salário CLT
  | 'freelance'       // renda freelance/autônomo
  | 'pro_labore'      // pró-labore / sócio
  | 'pension'         // aposentadoria / pensão
  | 'rent_income'     // aluguel recebido
  | 'investment'      // rendimento de investimentos
  | 'other_recurring' // outra renda recorrente

export interface RecurringIncome {
  id:              string;
  type:            IncomeType;
  label:           string;             // Nome descritivo (ex: "Salário – Empresa S.A.")
  amount:          number;             // Valor típico
  amount_min:      number;             // Menor valor observado
  amount_max:      number;             // Maior valor observado
  day_of_month:    number | null;      // Dia do mês típico (null se irregular)
  occurrences:     number;             // Quantas vezes detectado
  last_date:       string;             // ISO date da última ocorrência
  next_expected:   string | null;      // Estimativa da próxima
  confidence:      number;             // 0–1
  transactions:    Transaction[];      // Transações relacionadas
  employer?:       string;             // Empregador/fonte se identificável
}

export interface SalaryDetectionResult {
  detected:         boolean;
  primary_income:   RecurringIncome | null;   // Maior renda recorrente
  all_incomes:      RecurringIncome[];
  total_monthly:    number;                   // Soma de todas as rendas mensais
  income_stability: 'stable' | 'variable' | 'irregular';
  has_multiple_sources: boolean;
}

// ─── Salary keyword catalog ───────────────────────────────────────────────────

const SALARY_KEYWORDS: Array<{ keywords: string[]; type: IncomeType; weight: number }> = [
  // CLT / formal
  { keywords: ['salário', 'salario', 'folha pagamento', 'folha de pagamento', 'holerite', 'remuneração', 'remuneracao', 'vencimento'], type: 'salary', weight: 1.0 },
  // Pró-labore / autônomo
  { keywords: ['pro labore', 'pró labore', 'pro-labore', 'pró-labore', 'honorários', 'honorarios', 'prolabore'], type: 'pro_labore', weight: 0.9 },
  // Freelance / autônomo
  { keywords: ['freelance', 'free lance', 'autônomo', 'autonomo', 'pagamento serviços', 'pagamento de serviços', 'prestação serviços'], type: 'freelance', weight: 0.85 },
  // Pensão / aposentadoria
  { keywords: ['aposentadoria', 'pensão', 'pensao', 'benefício inss', 'beneficio inss', 'inss', 'previdência', 'previdencia'], type: 'pension', weight: 0.95 },
  // Aluguel recebido
  { keywords: ['aluguel recebido', 'locação recebida', 'locacao recebida', 'aluguel', 'renda aluguel'], type: 'rent_income', weight: 0.8 },
  // Investimentos
  { keywords: ['rendimento', 'dividendo', 'jcp', 'juros sobre capital', 'renda fixa', 'cdb', 'lci', 'lca', 'tesouro', 'resgat'], type: 'investment', weight: 0.7 },
  // Genérico
  { keywords: ['pagamento recebido', 'pix recebido', 'transferência recebida', 'ted recebida', 'doc recebido', 'crédito em conta'], type: 'other_recurring', weight: 0.5 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────


function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeywords(tx: Transaction, keywords: string[]): boolean {
  const text = normalize(`${tx.description ?? ''} ${tx.merchant ?? ''}`);
  return keywords.some(kw => text.includes(normalize(kw)));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avgDayOfMonth(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const days = dates.map(d => new Date(d).getDate());
  const avg = days.reduce((s, d) => s + d, 0) / days.length;
  const variance = days.reduce((s, d) => s + Math.abs(d - avg), 0) / days.length;
  // Only report a stable day if variance < 5 days
  return variance < 5 ? Math.round(avg) : null;
}

function nextExpectedDate(lastDate: string, dayOfMonth: number | null): string | null {
  const d = new Date(lastDate);
  if (isNaN(d.getTime())) return null;
  const next = new Date(d);
  next.setMonth(next.getMonth() + 1);
  if (dayOfMonth) next.setDate(dayOfMonth);
  return next.toISOString();
}

function detectIncomeType(txs: Transaction[]): { type: IncomeType; employer?: string; weight: number } {
  for (const { keywords, type, weight } of SALARY_KEYWORDS) {
    if (txs.some(tx => matchesKeywords(tx, keywords))) {
      // Try to extract employer from description
      const desc = txs[0].description ?? '';
      const parts = desc.split(/\s[-–—]\s/);
      const employer = parts.length > 1 ? parts[1].slice(0, 40).trim() : undefined;
      return { type, employer, weight };
    }
  }
  return { type: 'other_recurring', weight: 0.5 };
}

function isRegularInterval(dates: string[], targetDays: number, toleranceDays: number): boolean {
  if (dates.length < 2) return false;
  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i-1]).getTime()) / 86400000;
    gaps.push(diff);
  }
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return Math.abs(avg - targetDays) <= toleranceDays;
}

// ─── PART 4 — detectSalary ────────────────────────────────────────────────────

/**
 * Detecta rendas recorrentes nas transações.
 *
 * @param transactions - lista completa de transações
 * @returns SalaryDetectionResult
 */
export function detectSalary(transactions: Transaction[]): SalaryDetectionResult {
  const incomes = transactions.filter(
    t => t.type === TransactionType.RECEITA && !t.generated
  );

  if (incomes.length === 0) {
    return {
      detected: false,
      primary_income: null,
      all_incomes: [],
      total_monthly: 0,
      income_stability: 'irregular',
      has_multiple_sources: false,
    };
  }

  const results: RecurringIncome[] = [];
  const matched = new Set<string>();

  // ── Strategy 1: keyword-based grouping ───────────────────────────────────
  for (const { keywords, type, weight } of SALARY_KEYWORDS) {
    const group = incomes.filter(tx => !matched.has(tx.id) && matchesKeywords(tx, keywords));
    if (group.length === 0) continue;

    // Sub-group by similar amounts (within 20% of each other)
    const subGroups: Transaction[][] = [];
    for (const tx of group) {
      const existing = subGroups.find(g => {
        const avg = g.reduce((s, t) => s + t.amount, 0) / g.length;
        return Math.abs(tx.amount - avg) / avg < 0.2;
      });
      if (existing) existing.push(tx);
      else subGroups.push([tx]);
    }

    for (const sg of subGroups) {
      if (sg.length < 1) continue;
      const amounts = sg.map(t => t.amount);
      const dates   = sg.map(t => t.date).sort();
      const { employer } = detectIncomeType(sg);
      const domMode = avgDayOfMonth(dates);

      const isMonthly = sg.length < 2 || isRegularInterval(dates, 30, 10);
      const amountVar = amounts.length > 1
        ? Math.max(...amounts) / Math.min(...amounts) - 1
        : 0;

      // Confidence scoring
      let confidence = weight;
      if (sg.length >= 2) confidence = Math.min(1, confidence + 0.1);
      if (sg.length >= 3) confidence = Math.min(1, confidence + 0.1);
      if (amountVar < 0.05) confidence = Math.min(1, confidence + 0.1); // stable value

      const sorted = [...sg].sort((a, b) => b.date.localeCompare(a.date));

      results.push({
        id:           makeId(),
        type,
        label:        employer ? `${typeLabel(type)} – ${employer}` : typeLabel(type),
        amount:       median(amounts),
        amount_min:   Math.min(...amounts),
        amount_max:   Math.max(...amounts),
        day_of_month: domMode,
        occurrences:  sg.length,
        last_date:    sorted[0].date,
        next_expected: isMonthly ? nextExpectedDate(sorted[0].date, domMode) : null,
        confidence,
        transactions: sorted,
        employer,
      });

      sg.forEach(tx => matched.add(tx.id));
    }
  }

  // ── Strategy 2: pattern detection — unmatched recurring income ────────────
  const unmatched = incomes.filter(t => !matched.has(t.id));

  // Group by amount fingerprint (within 10%)
  const amountGroups: Record<string, Transaction[]> = {};
  for (const tx of unmatched) {
    const bucket = Math.round(tx.amount / 50) * 50; // bucket by nearest R$50
    const key = String(bucket);
    if (!amountGroups[key]) amountGroups[key] = [];
    amountGroups[key].push(tx);
  }

  for (const [, group] of Object.entries(amountGroups)) {
    if (group.length < 2) continue;
    const dates = group.map(t => t.date).sort();
    if (!isRegularInterval(dates, 30, 12)) continue; // must be ~monthly

    const amounts = group.map(t => t.amount);
    const sorted = [...group].sort((a, b) => b.date.localeCompare(a.date));
    const domMode = avgDayOfMonth(dates);

    results.push({
      id:           makeId(),
      type:         'other_recurring',
      label:        `Renda Recorrente (${sorted[0].description?.slice(0, 30) ?? 'Sem descrição'})`,
      amount:       median(amounts),
      amount_min:   Math.min(...amounts),
      amount_max:   Math.max(...amounts),
      day_of_month: domMode,
      occurrences:  group.length,
      last_date:    sorted[0].date,
      next_expected: nextExpectedDate(sorted[0].date, domMode),
      confidence:   0.55 + (group.length >= 3 ? 0.1 : 0),
      transactions: sorted,
    });
  }

  // ── Sort by amount desc, deduplicate ──────────────────────────────────────
  results.sort((a, b) => b.amount - a.amount);

  const toMonthly = (ri: RecurringIncome): number => ri.amount;
  const total_monthly = results.reduce((s, r) => s + toMonthly(r), 0);

  // Stability analysis
  const primaryAmounts = results[0]?.transactions.map(t => t.amount) ?? [];
  const stabilityRatio = primaryAmounts.length > 1
    ? Math.min(...primaryAmounts) / Math.max(...primaryAmounts)
    : 1;

  const income_stability: SalaryDetectionResult['income_stability'] =
    stabilityRatio > 0.95 ? 'stable' :
    stabilityRatio > 0.75 ? 'variable' :
    'irregular';

  return {
    detected:             results.length > 0,
    primary_income:       results[0] ?? null,
    all_incomes:          results,
    total_monthly,
    income_stability,
    has_multiple_sources: results.length > 1,
  };
}

// ─── Utility exports ──────────────────────────────────────────────────────────

function typeLabel(type: IncomeType): string {
  const labels: Record<IncomeType, string> = {
    salary:          'Salário',
    freelance:       'Freelance',
    pro_labore:      'Pró-labore',
    pension:         'Aposentadoria / Pensão',
    rent_income:     'Renda de Aluguel',
    investment:      'Rendimentos',
    other_recurring: 'Renda Recorrente',
  };
  return labels[type];
}

export { typeLabel as formatIncomeType };

/** Human-readable stability label */
export function formatIncomeStability(stability: SalaryDetectionResult['income_stability']): string {
  return {
    stable:    'Estável',
    variable:  'Variável',
    irregular: 'Irregular',
  }[stability];
}

/** Format next expected date */
export function formatNextPayday(iso: string | null): string {
  if (!iso) return 'Indeterminado';
  const d = new Date(iso);
  const diffDays = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diffDays < 0)    return 'Atrasado';
  if (diffDays === 0)  return 'Hoje';
  if (diffDays === 1)  return 'Amanhã';
  if (diffDays <= 7)   return `Em ${diffDays} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
