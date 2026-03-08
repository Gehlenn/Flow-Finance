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
 *   Memory → adjustCashflowWithPatterns (predição adaptativa)
 *       ↓
 *   Memory → generateAdaptiveInsights (insights personalizados)
 */

import { Transaction, TransactionType } from '../../types';
import { learnMemory, getAIMemory, AIMemory } from './aiMemory';
import { CashflowPrediction } from './riskAnalyzer';
import { AIInsight } from './insightGenerator';
import { makeId, formatCurrency } from '../../utils/helpers';

// ─── PART 2 — FinancialPattern model ─────────────────────────────────────────

export interface FinancialPattern {
  id: string;
  type:
    | 'weekend_spending'
    | 'frequent_merchant'
    | 'salary_day'
    | 'delivery_pattern'
    | 'category_preference';
  value: string;
  confidence: number;
  updated_at: string;
}

// ─── Engine state (learning metrics) ─────────────────────────────────────────

export interface AdaptiveLearningState {
  patterns_detected: number;
  memories_stored: number;
  prediction_adjusted: boolean;
  insights_enhanced: number;
  last_run: string;
  top_patterns: FinancialPattern[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRecentTxs(txs: Transaction[], days: number): Transaction[] {
  const cutoff = new Date(Date.now() - days * 86400000);
  return txs.filter(t => new Date(t.date) >= cutoff && !t.generated);
}

// ─── PART 3 — Pattern Detection ──────────────────────────────────────────────

export function detectFinancialPatterns(transactions: Transaction[]): FinancialPattern[] {
  const patterns: FinancialPattern[] = [];
  const base = transactions.filter(t => !t.generated);
  if (base.length < 3) return patterns;

  const expenses = base.filter(t => t.type === TransactionType.DESPESA);

  // ── 1. Weekend Spending ─────────────────────────────────────────────────────
  const weekendExp = expenses.filter(t => {
    const day = new Date(t.date).getDay();
    return day === 0 || day === 6;
  });
  const weekdayExp = expenses.filter(t => {
    const day = new Date(t.date).getDay();
    return day >= 1 && day <= 5;
  });

  if (weekdayExp.length > 0 && weekendExp.length > 0) {
    const avgWeekend = weekendExp.reduce((s, t) => s + t.amount, 0) / weekendExp.length;
    const avgWeekday = weekdayExp.reduce((s, t) => s + t.amount, 0) / weekdayExp.length;
    const ratio = avgWeekend / avgWeekday;

    if (ratio > 1.3) {
      patterns.push({
        id: makeId(), type: 'weekend_spending',
        value: ratio > 2 ? 'very_high' : 'high',
        confidence: Math.min(0.95, 0.5 + weekendExp.length * 0.03),
        updated_at: new Date().toISOString(),
      });
    } else if (ratio < 0.7) {
      patterns.push({
        id: makeId(), type: 'weekend_spending',
        value: 'low',
        confidence: Math.min(0.9, 0.5 + weekendExp.length * 0.03),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // ── 2. Frequent Merchants ───────────────────────────────────────────────────
  const merchantFreq: Record<string, { count: number; total: number; category: string }> = {};
  for (const t of base) {
    const key = (t.merchant || t.description).toLowerCase().replace(/\s+/g, '_').slice(0, 30);
    if (!merchantFreq[key]) merchantFreq[key] = { count: 0, total: 0, category: t.category };
    merchantFreq[key].count++;
    merchantFreq[key].total += t.amount;
  }
  const topMerchants = Object.entries(merchantFreq)
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  for (const [name, data] of topMerchants) {
    patterns.push({
      id: makeId(), type: 'frequent_merchant',
      value: name,
      confidence: Math.min(0.95, 0.5 + data.count * 0.05),
      updated_at: new Date().toISOString(),
    });
  }

  // ── 3. Salary Day ───────────────────────────────────────────────────────────
  const incomes = base
    .filter(t => t.type === TransactionType.RECEITA)
    .map(t => new Date(t.date).getDate())
    .sort((a, b) => a - b);

  if (incomes.length >= 2) {
    const dayFreq: Record<number, number> = {};
    for (const d of incomes) dayFreq[d] = (dayFreq[d] ?? 0) + 1;
    const topDay = Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0];
    if (topDay && parseInt(topDay[1] as any) >= 2) {
      patterns.push({
        id: makeId(), type: 'salary_day',
        value: topDay[0],
        confidence: Math.min(0.95, 0.5 + parseInt(topDay[1] as any) * 0.1),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // ── 4. Delivery Pattern ────────────────────────────────────────────────────
  const DELIVERY_KW = ['ifood', 'rappi', 'uber eats', 'delivery', 'james', '99food', 'entrega', 'pedido'];
  const deliveryTxs = getRecentTxs(base, 90).filter(t =>
    t.type === TransactionType.DESPESA &&
    DELIVERY_KW.some(kw => (t.description + (t.merchant ?? '')).toLowerCase().includes(kw))
  );

  if (deliveryTxs.length >= 3) {
    const monthlyEst = deliveryTxs.reduce((s, t) => s + t.amount, 0) / 3;
    patterns.push({
      id: makeId(), type: 'delivery_pattern',
      value: monthlyEst > 200 ? 'heavy' : monthlyEst > 80 ? 'moderate' : 'light',
      confidence: Math.min(0.95, 0.5 + deliveryTxs.length * 0.05),
      updated_at: new Date().toISOString(),
    });
  }

  // ── 5. Category Preference ─────────────────────────────────────────────────
  const catTotals: Record<string, number> = {};
  for (const t of expenses) catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
  const totalExp = Object.values(catTotals).reduce((s, v) => s + v, 0);

  if (totalExp > 0) {
    const dominantCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    if (dominantCat && dominantCat[1] / totalExp > 0.35) {
      patterns.push({
        id: makeId(), type: 'category_preference',
        value: dominantCat[0],
        confidence: Math.min(0.9, dominantCat[1] / totalExp),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return patterns;
}

// ─── PART 4 — Memory Integration ──────────────────────────────────────────────

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

// ─── PART 5 — Adaptive Cashflow Prediction ────────────────────────────────────

export function adjustCashflowWithPatterns(
  base: CashflowPrediction,
  memories: AIMemory[]
): CashflowPrediction {
  let { projected_expenses } = base;
  let multiplier = 1.0;

  const get = (key: string) => memories.find(m => m.key === key);

  // Weekend spending pattern → ajustar projeção de gastos
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

  // Salary day → ajustar projeção de receita se dia está próximo
  const salaryMem = get('salary_day');
  let projected_income = base.projected_income;
  if (salaryMem) {
    const salaryDay = parseInt(salaryMem.value);
    const today = new Date().getDate();
    const daysUntilSalary = salaryDay > today ? salaryDay - today : (30 - today + salaryDay);
    if (daysUntilSalary <= 7) {
      // Receita esperada em breve → boosta confiança da projeção
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

// ─── PART 6 — Category Learning (merchant → category mapping) ─────────────────

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

// ─── PART 7 — Adaptive Insights ───────────────────────────────────────────────

export function generateAdaptiveInsights(
  transactions: Transaction[],
  memories: AIMemory[],
  userId: string
): AIInsight[] {
  const insights: AIInsight[] = [];
  const get = (key: string) => memories.find(m => m.key === key);

  const makeInsight = (
    type: AIInsight['type'],
    message: string,
    severity: AIInsight['severity']
  ): AIInsight => ({
    id: makeId(), user_id: userId, type, message, severity,
    created_at: new Date().toISOString(),
  });

  // ── Weekend spending ─────────────────────────────────────────────────────────
  const weekendMem = get('weekend_spending');
  if (weekendMem?.value === 'high' || weekendMem?.value === 'very_high') {
    const weekendTxs = transactions.filter(t => {
      const d = new Date(t.date).getDay();
      return !t.generated && t.type === TransactionType.DESPESA && (d === 0 || d === 6);
    });
    const total = weekendTxs.reduce((s, t) => s + t.amount, 0);
    if (total > 0) {
      insights.push(makeInsight(
        'warning',
        `Você costuma gastar mais nos fins de semana. Nos últimos registros, ${formatCurrency(total)} foram gastos em fins de semana.`,
        weekendMem.value === 'very_high' ? 'medium' : 'low'
      ));
    }
  }

  // ── Delivery pattern ──────────────────────────────────────────────────────────
  const deliveryMem = get('delivery_pattern');
  if (deliveryMem?.value === 'heavy' || deliveryMem?.value === 'moderate') {
    insights.push(makeInsight(
      'warning',
      `Você tem um padrão ${deliveryMem.value === 'heavy' ? 'intenso' : 'regular'} de gastos com delivery. Preparar refeições em casa pode gerar economia significativa.`,
      deliveryMem.value === 'heavy' ? 'medium' : 'low'
    ));
  }

  // ── Salary day awareness ───────────────────────────────────────────────────────
  const salaryMem = get('salary_day');
  if (salaryMem) {
    const salaryDay = parseInt(salaryMem.value);
    const today = new Date().getDate();
    const daysUntil = salaryDay > today ? salaryDay - today : (30 - today + salaryDay);
    if (daysUntil <= 5) {
      insights.push(makeInsight(
        'saving',
        `Com base no seu histórico, sua receita costuma entrar por volta do dia ${salaryDay}. Faltam aproximadamente ${daysUntil} dia(s).`,
        'low'
      ));
    }
  }

  // ── Dominant category ──────────────────────────────────────────────────────────
  const domCatMem = get('dominant_category');
  if (domCatMem) {
    const catTxs = transactions.filter(t =>
      !t.generated && t.type === TransactionType.DESPESA && t.category === domCatMem.value
    );
    const catTotal = catTxs.reduce((s, t) => s + t.amount, 0);
    if (catTotal > 0) {
      insights.push(makeInsight(
        'spending',
        `"${domCatMem.value}" é sua categoria dominante com ${formatCurrency(catTotal)} no histórico. Você tem preferência consistente por esta área.`,
        'low'
      ));
    }
  }

  // ── Merchant loyalty ───────────────────────────────────────────────────────────
  const merchantMemories = memories.filter(m => m.key.startsWith('merchant_') && m.value === 'frequent');
  if (merchantMemories.length >= 3) {
    insights.push(makeInsight(
      'spending',
      `Você tem ${merchantMemories.length} estabelecimento(s) favorito(s) recorrentes. Fidelidade a poucos lugares pode facilitar o controle de gastos.`,
      'low'
    ));
  }

  return insights;
}

// ─── PART 8 — Run Adaptive Learning (função principal) ───────────────────────

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
    const all: AIMemory[] = JSON.parse(localStorage.getItem('flow_ai_memory') || '[]');
    const userMem = all.filter(m => m.user_id === userId);
    const last_run = userMem.find(m => m.key === 'last_learning_run')?.value ?? null;
    const pattern_count = parseInt(userMem.find(m => m.key === 'patterns_detected_count')?.value ?? '0');
    return {
      is_learning: userMem.length > 0,
      pattern_count,
      memory_count: userMem.length,
      last_run,
    };
  } catch {
    return { is_learning: false, pattern_count: 0, memory_count: 0, last_run: null };
  }
}
