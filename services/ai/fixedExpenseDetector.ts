/**
 * FIXED EXPENSE DETECTOR — src/services/ai/fixedExpenseDetector.ts
 *
 * PART 5 — Detecta despesas fixas recorrentes:
 *   • Aluguel / moradia
 *   • Assinaturas de serviços
 *   • Contas de utilidades (luz, água, gás, internet)
 *   • Seguros
 *   • Mensalidades (escola, academia, etc.)
 *   • Financiamentos / crédito
 *
 * Complementa o subscriptionDetector.ts (que foca em serviços digitais)
 * com uma visão mais ampla de todas as despesas fixas do usuário.
 */

import { Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';


// ─── Models ───────────────────────────────────────────────────────────────────

export type FixedExpenseCategory =
  | 'housing'        // aluguel, condomínio, IPTU
  | 'utilities'      // luz, água, gás, internet, telefone
  | 'subscription'   // streaming, SaaS, serviços digitais
  | 'insurance'      // seguros (saúde, auto, vida, residencial)
  | 'education'      // escola, faculdade, curso
  | 'fitness'        // academia, pilates, esportes
  | 'transport'      // transporte fixo (combustível, estacionamento mensal)
  | 'financing'      // financiamento, crédito, consórcio
  | 'other_fixed'    // outros fixos identificados por padrão

export interface FixedExpense {
  id:            string;
  name:          string;
  category:      FixedExpenseCategory;
  amount:        number;          // Valor típico
  amount_min:    number;
  amount_max:    number;
  amount_trend:  'increasing' | 'stable' | 'decreasing';
  day_of_month:  number | null;   // Dia típico de vencimento
  occurrences:   number;
  last_date:     string;
  next_expected: string | null;
  confidence:    number;
  logo:          string;
  transactions:  Transaction[];
}

export interface FixedExpenseReport {
  expenses:          FixedExpense[];
  total_monthly:     number;         // Total fixo mensal estimado
  total_annual:      number;
  by_category:       Record<FixedExpenseCategory, number>; // mensal por categoria
  commitment_ratio?: number;         // % da renda comprometida (se renda conhecida)
  highest_expense:   FixedExpense | null;
  count:             number;
  has_housing:       boolean;        // Flag: tem aluguel/financiamento imóvel?
  has_insurance:     boolean;        // Flag: tem plano de saúde?
}

// ─── Fixed expense catalog ────────────────────────────────────────────────────

interface ExpensePattern {
  name:       string;
  keywords:   string[];
  category:   FixedExpenseCategory;
  logo:       string;
  min_amount?: number;   // filtro mínimo de valor (evitar falsos positivos)
}

const FIXED_PATTERNS: ExpensePattern[] = [
  // ── Moradia ──────────────────────────────────────────────────────────────
  { name: 'Aluguel',       keywords: ['aluguel', 'locação', 'locacao', 'arrendamento'], category: 'housing', logo: '🏠', min_amount: 200 },
  { name: 'Condomínio',    keywords: ['condomínio', 'condominio', 'taxa cond'], category: 'housing', logo: '🏢', min_amount: 50 },
  { name: 'IPTU',          keywords: ['iptu', 'imposto predial'], category: 'housing', logo: '🏛️', min_amount: 30 },
  { name: 'Financiamento Imóvel', keywords: ['financiamento imóvel', 'financiamento imovel', 'prestação imóvel', 'prestacao imovel', 'caixa habitação', 'habitacao', 'caixa hab'], category: 'housing', logo: '🔑', min_amount: 200 },

  // ── Utilidades ────────────────────────────────────────────────────────────
  { name: 'Energia Elétrica', keywords: ['cemig', 'copel', 'light', 'enel', 'elektro', 'coelba', 'celpe', 'ampla', 'energia', 'conta de luz', 'eletricidade'], category: 'utilities', logo: '⚡', min_amount: 30 },
  { name: 'Água / Saneamento', keywords: ['sabesp', 'saneamento', 'copasa', 'embasa', 'caesb', 'cagece', 'água', 'agua', 'sanepar'], category: 'utilities', logo: '💧', min_amount: 20 },
  { name: 'Gás',            keywords: ['comgás', 'comgas', 'copergás', 'copergas', 'gas natural', 'gas encanado', 'gás'], category: 'utilities', logo: '🔥', min_amount: 20 },
  { name: 'Internet',       keywords: ['claro net', 'vivo fibra', 'oi fibra', 'tim fibra', 'net virtua', 'internet', 'banda larga', 'wifi'], category: 'utilities', logo: '🌐', min_amount: 50 },
  { name: 'Telefone Fixo',  keywords: ['telefone fixo', 'conta telefone', 'oi telefone'], category: 'utilities', logo: '📞', min_amount: 20 },

  // ── Seguros ───────────────────────────────────────────────────────────────
  { name: 'Plano de Saúde', keywords: ['amil', 'unimed', 'hapvida', 'notre dame', 'sulamerica saude', 'bradesco saude', 'plano saúde', 'plano saude', 'plano de saúde'], category: 'insurance', logo: '🏥', min_amount: 80 },
  { name: 'Seguro Auto',    keywords: ['porto seguro', 'bradesco auto', 'itaú seguro', 'seguro veículo', 'seguro veiculo', 'seguro auto'], category: 'insurance', logo: '🚗', min_amount: 50 },
  { name: 'Seguro Vida',    keywords: ['seguro de vida', 'vida metlife', 'tokio marine vida'], category: 'insurance', logo: '🛡️', min_amount: 30 },
  { name: 'Seguro Residencial', keywords: ['seguro residencial', 'seguro lar', 'seguro casa'], category: 'insurance', logo: '🏡', min_amount: 20 },

  // ── Educação ─────────────────────────────────────────────────────────────
  { name: 'Escola / Colégio', keywords: ['mensalidade escolar', 'mensalidade colegio', 'colégio', 'colegio', 'escola'], category: 'education', logo: '🏫', min_amount: 100 },
  { name: 'Faculdade / Universidade', keywords: ['mensalidade faculdade', 'universidade', 'anhanguera', 'kroton', 'estácio', 'estacio', 'unopar', 'unip', 'usp', 'unicamp', 'ufrj'], category: 'education', logo: '🎓', min_amount: 100 },
  { name: 'Curso Online',   keywords: ['coursera', 'udemy', 'alura', 'hotmart', 'kiwify', 'edx'], category: 'education', logo: '💻', min_amount: 20 },

  // ── Fitness ───────────────────────────────────────────────────────────────
  { name: 'Academia',       keywords: ['smart fit', 'academia', 'bluefit', 'bodytech', 'crossfit', 'gympass', 'wellhub'], category: 'fitness', logo: '💪', min_amount: 40 },
  { name: 'Pilates / Yoga', keywords: ['pilates', 'yoga', 'estúdio'], category: 'fitness', logo: '🧘', min_amount: 80 },

  // ── Transporte fixo ───────────────────────────────────────────────────────
  { name: 'Estacionamento Mensal', keywords: ['estacionamento mensal', 'mensalista', 'vaga garagem'], category: 'transport', logo: '🅿️', min_amount: 80 },
  { name: 'Transporte Público', keywords: ['bilhete único', 'cartão transporte', 'vale transporte', 'metrô', 'metro', 'ônibus', 'onibus'], category: 'transport', logo: '🚌', min_amount: 50 },

  // ── Financiamentos ────────────────────────────────────────────────────────
  { name: 'Financiamento Veículo', keywords: ['financiamento veículo', 'financiamento veiculo', 'parcela carro', 'consórcio auto', 'consorcio auto'], category: 'financing', logo: '🚙', min_amount: 200 },
  { name: 'Crédito Pessoal', keywords: ['empréstimo', 'emprestimo', 'crédito pessoal', 'credito pessoal', 'parcela empréstimo'], category: 'financing', logo: '💳', min_amount: 100 },
  { name: 'Consórcio',      keywords: ['consórcio', 'consorcio'], category: 'financing', logo: '🤝', min_amount: 100 },

  // ── Streaming (complementar ao subscriptionDetector) ────────────────────
  { name: 'Netflix',        keywords: ['netflix'], category: 'subscription', logo: '🎬', min_amount: 15 },
  { name: 'Spotify',        keywords: ['spotify'], category: 'subscription', logo: '🎵', min_amount: 10 },
  { name: 'Disney+',        keywords: ['disney'], category: 'subscription', logo: '🏰', min_amount: 15 },
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

function matchesPattern(tx: Transaction, pattern: ExpensePattern): boolean {
  if (pattern.min_amount && tx.amount < pattern.min_amount) return false;
  const text = normalize(`${tx.description ?? ''} ${tx.merchant ?? ''}`);
  return pattern.keywords.some(kw => text.includes(normalize(kw)));
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
  return variance < 5 ? Math.round(avg) : null;
}

function nextExpectedDate(lastDate: string, dayOfMonth: number | null): string | null {
  const d = new Date(lastDate);
  if (isNaN(d.getTime())) return null;
  const next = new Date(d);
  next.setMonth(next.getMonth() + 1);
  if (dayOfMonth) next.setDate(Math.min(dayOfMonth, 28)); // clamp to 28 to avoid month overflow
  return next.toISOString();
}

function detectAmountTrend(amounts: number[]): FixedExpense['amount_trend'] {
  if (amounts.length < 3) return 'stable';
  // Compute slope via linear regression
  const n = amounts.length;
  const sumX = amounts.reduce((_, __, i) => _ + i, 0);
  const sumY = amounts.reduce((s, a) => s + a, 0);
  const sumXY = amounts.reduce((s, a, i) => s + i * a, 0);
  const sumX2 = amounts.reduce((s, _, i) => s + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const pctChange = slope / median(amounts);
  if (pctChange > 0.02)  return 'increasing';
  if (pctChange < -0.02) return 'decreasing';
  return 'stable';
}

// ─── PART 5 — detectFixedExpenses ────────────────────────────────────────────

/**
 * Detecta despesas fixas recorrentes nas transações.
 *
 * @param transactions - lista completa de transações do usuário
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

  // ── Strategy 1: Pattern catalog matching ──────────────────────────────────
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
      const sorted  = [...sg].sort((a, b) => b.date.localeCompare(a.date));
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

  // ── Strategy 2: Pattern-based — unmatched stable recurring expenses ───────
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
    const sorted = [...group].sort((a, b) => b.date.localeCompare(a.date));
    const dom    = avgDayOfMonth(dates);

    // Must have regular monthly-ish interval
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / 86400000);
    }
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
      logo:         '🔄',
      transactions: sorted,
    });
  }

  // ── Sort and aggregate ────────────────────────────────────────────────────
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

// ─── Utility exports ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<FixedExpenseCategory, string> = {
  housing:      'Moradia',
  utilities:    'Utilidades',
  subscription: 'Assinaturas',
  insurance:    'Seguros',
  education:    'Educação',
  fitness:      'Saúde / Fitness',
  transport:    'Transporte',
  financing:    'Financiamentos',
  other_fixed:  'Outros Fixos',
};

export function formatExpenseCategory(category: FixedExpenseCategory): string {
  return CATEGORY_LABELS[category] ?? 'Outros';
}

const CATEGORY_LOGOS: Record<FixedExpenseCategory, string> = {
  housing: '🏠', utilities: '⚡', subscription: '📱',
  insurance: '🛡️', education: '🎓', fitness: '💪',
  transport: '🚌', financing: '💳', other_fixed: '🔄',
};

export function getCategoryLogo(category: FixedExpenseCategory): string {
  return CATEGORY_LOGOS[category] ?? '📌';
}

/** Semaphore-style commitment assessment */
export function assessCommitmentRatio(ratio: number | undefined): {
  label: string;
  color: string;
  warning: boolean;
} {
  if (!ratio) return { label: 'Não calculado', color: 'text-slate-400', warning: false };
  const pct = Math.round(ratio * 100);
  if (pct <= 30) return { label: `${pct}% da renda — saudável`, color: 'text-emerald-500', warning: false };
  if (pct <= 50) return { label: `${pct}% da renda — atenção`,  color: 'text-amber-500',  warning: false };
  return           { label: `${pct}% da renda — crítico`,       color: 'text-rose-500',   warning: true  };
}
