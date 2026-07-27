/**
 * ADAPTIVE AI ENGINE — Inteligência Financeira Adaptativa
 *
 * Aprende padrões do histórico do usuário para melhorar:
 *   - Predições de fluxo de caixa
 *   - Geração de insights personalizados
 *   - Categorização automática
 *   - Alertas contextualizados
 *
 * REGRA: Nunca modifica transações existentes. Apenas aprende e melhora previsões.
 *
 * Fluxo:
 *   Transactions → detectFinancialPatterns
 *       ↓
 *   Patterns → learnMemory (AI Memory)
 *       ↓
 *   Memory -> adjustCashflowWithPatterns (predição adaptativa)
 *       ↓
 *   Memory → generateAdaptiveInsights (insights personalizados)
 */

import { Transaction, TransactionType } from '../../types';
import { learnMemory, getAIMemory, getAIMemorySnapshot, AIMemory } from './aiMemory';
import { CashflowPrediction } from './riskAnalyzer';
import { logWarn } from '../utils/logger';
import { getDaysUntilSalaryDay } from './adaptiveAIEngineHelpers';
import { generateAdaptiveInsights } from './adaptiveAIEngineInsightHelpers';
import {
  detectCategoryPreferencePattern,
  detectDeliveryPattern,
  detectFrequentMerchantPatterns,
  detectSalaryPattern,
  detectWeekendSpendingPattern,
} from './adaptiveAIEnginePatternHelpers';
import type { FinancialPattern } from './adaptiveAIEngineTypes';

export { getDaysUntilSalaryDay } from './adaptiveAIEngineHelpers';
export { generateAdaptiveInsights } from './adaptiveAIEngineInsightHelpers';
export type { FinancialPattern } from './adaptiveAIEngineTypes';


// ─── Engine state (learning metrics) ─────────────────────────────────────────

export interface AdaptiveLearningState {
  patterns_detected: number;
  memories_stored: number;
  prediction_adjusted: boolean;
  insights_enhanced: number;
  last_run: string;
  top_patterns: FinancialPattern[];
}


// Pattern detection

export function detectFinancialPatterns(transactions: Transaction[]): FinancialPattern[] {
  const base = transactions.filter((transaction) => !transaction.generated);
  if (base.length < 3) {
    return [];
  }

  const expenses = base.filter((transaction) => transaction.type === TransactionType.DESPESA);
  return [
    ...detectWeekendSpendingPattern(expenses),
    ...detectFrequentMerchantPatterns(base),
    ...detectSalaryPattern(base),
    ...detectDeliveryPattern(base),
    ...detectCategoryPreferencePattern(expenses),
  ];
}
// Memory integration

export async function storePatternMemories(
  userId: string,
  patterns: FinancialPattern[]
): Promise<void> {
  for (const p of patterns) {
    switch (p.type) {
      case 'weekend_spending':
        await learnMemory(userId, 'weekend_spending', p.value, p.confidence);
        break;
      case 'frequent_merchant':
        await learnMemory(userId, `merchant_${p.value.slice(0, 20)}`, 'frequent', p.confidence);
        break;
      case 'salary_day':
        await learnMemory(userId, 'salary_day', p.value, p.confidence);
        break;
      case 'delivery_pattern':
        await learnMemory(userId, 'delivery_pattern', p.value, p.confidence);
        break;
      case 'category_preference':
        await learnMemory(userId, 'dominant_category', p.value, p.confidence);
        break;
    }
  }
}

// Adaptive cash-flow prediction

export function adjustCashflowWithPatterns(
  base: CashflowPrediction,
  memories: AIMemory[]
): CashflowPrediction {
  let { projected_expenses } = base;
  let multiplier = 1.0;

  const get = (key: string) => memories.find(m => m.key === key);

  // Weekend spending pattern -> ajustar projeção de gastos
  const weekendMem = get('weekend_spending');
  if (weekendMem) {
    if (weekendMem.value === 'very_high') multiplier += 0.12 * weekendMem.confidence;
    else if (weekendMem.value === 'high') multiplier += 0.07 * weekendMem.confidence;
    else if (weekendMem.value === 'low') multiplier -= 0.05 * weekendMem.confidence;
  }

  // Delivery pattern → adicionar custo extra
  const deliveryMem = get('delivery_pattern');
  if (deliveryMem) {
    if (deliveryMem.value === 'heavy') multiplier += 0.08 * deliveryMem.confidence;
    else if (deliveryMem.value === 'moderate') multiplier += 0.04 * deliveryMem.confidence;
  }

  // Salary day -> ajustar projeção de receita se dia está próximo
  const salaryMem = get('salary_day');
  let projected_income = base.projected_income;
  if (salaryMem) {
    const salaryDay = Number.parseInt(salaryMem.value, 10);
    const daysUntilSalary = getDaysUntilSalaryDay(salaryDay);
    if (daysUntilSalary !== null && daysUntilSalary <= 7) {
      // Receita esperada em breve -> aumenta a confiança da projeção
      projected_income *= (1 + 0.02 * salaryMem.confidence);
    }
  }

  const adjusted_expenses = projected_expenses * multiplier;
  const dailyNet = (projected_income - adjusted_expenses) / 30;

  return {
    ...base,
    projected_expenses: adjusted_expenses,
    projected_income,
    balance_7_days:  base.current_balance + dailyNet * 7,
    balance_30_days: base.current_balance + dailyNet * 30,
  };
}

// Merchant-to-category learning

export async function learnMerchantCategories(
  userId: string,
  transactions: Transaction[]
): Promise<void> {
  const merchantCatMap: Record<string, Record<string, number>> = {};

  for (const t of transactions.filter(t => !t.generated)) {
    const merchant = (t.merchant || t.description).toLowerCase().replace(/\s+/g, '_').slice(0, 25);
    if (!merchantCatMap[merchant]) merchantCatMap[merchant] = {};
    merchantCatMap[merchant][t.category] = (merchantCatMap[merchant][t.category] ?? 0) + 1;
  }

  for (const [merchant, catCounts] of Object.entries(merchantCatMap)) {
    const total = Object.values(catCounts).reduce((s, v) => s + v, 0);
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] >= 3) {
      const conf = Math.min(0.95, topCat[1] / total);
      await learnMemory(userId, `merchant_${merchant}`, topCat[0], conf);
    }
  }
}


// Adaptive learning orchestration

export interface AdaptiveLearningResult {
  patterns: FinancialPattern[];
  state: AdaptiveLearningState;
}

export async function runAdaptiveLearning(
  userId: string,
  transactions: Transaction[]
): Promise<AdaptiveLearningResult> {
  const base = transactions.filter(t => !t.generated);
  if (base.length < 3) {
    return {
      patterns: [],
      state: {
        patterns_detected: 0,
        memories_stored: 0,
        prediction_adjusted: false,
        insights_enhanced: 0,
        last_run: new Date().toISOString(),
        top_patterns: [],
      },
    };
  }

  // 1. Detectar padrões
  const patterns = detectFinancialPatterns(base);

  // 2. Salvar padrões na memória
  await storePatternMemories(userId, patterns);

  // 3. Aprender categorias de merchants
  await learnMerchantCategories(userId, base);

  // 4. Ler memória atualizada para gerar insights adaptativos
  const memories = await getAIMemory(userId);
  const adaptiveInsights = generateAdaptiveInsights(base, memories, userId);

  // 5. Registrar métricas de aprendizado
  await learnMemory(userId, 'last_learning_run', new Date().toISOString(), 1.0);
  await learnMemory(userId, 'patterns_detected_count', String(patterns.length), 1.0);
  await learnMemory(userId, 'total_transactions_learned', String(base.length), 1.0);

  return {
    patterns,
    state: {
      patterns_detected: patterns.length,
      memories_stored: memories.length,
      prediction_adjusted: patterns.some(p => p.type === 'weekend_spending' || p.type === 'delivery_pattern'),
      insights_enhanced: adaptiveInsights.length,
      last_run: new Date().toISOString(),
      top_patterns: patterns.slice(0, 3),
    },
  };
}

// ─── Sync version (sem async — para uso em renders) ───────────────────────────

export function getAdaptiveLearningStats(userId: string): {
  is_learning: boolean;
  pattern_count: number;
  memory_count: number;
  last_run: string | null;
} {
  try {
    const userMem = getAIMemorySnapshot(userId);
    const last_run = userMem.find(m => m.key === 'last_learning_run')?.value ?? null;
    const pattern_count = parseInt(userMem.find(m => m.key === 'patterns_detected_count')?.value ?? '0');
    return {
      is_learning: userMem.length > 0,
      pattern_count,
      memory_count: userMem.length,
      last_run,
    };
  } catch (error) {
    logWarn('[AdaptiveAIEngine] Failed to read adaptive learning stats; returning empty snapshot', { userId, error });
    return { is_learning: false, pattern_count: 0, memory_count: 0, last_run: null };
  }
}
