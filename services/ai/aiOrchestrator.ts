/**
 * AI ORCHESTRATOR — Pipeline Central do Flow Finance
 *
 * Conecta todas as camadas de IA em sequência:
 *
 *   User Input
 *       ↓
 *   [1] AI Interpreter     ← texto / voz / imagem + memória
 *       ↓
 *   [2] AI Memory          ← contexto persistido do usuário
 *       ↓
 *   [3] Financial Engine   ← transações + recorrências + projeções
 *       ↓
 *   [4] Behavior Engine    ← perfil financeiro + hábitos
 *       ↓
 *   [5] Risk Engine        ← alertas de saldo e aceleração
 *       ↓
 *   [6] Insight Engine     ← mensagens explicativas
 *       ↓
 *   AIAnalysisResult       → UI
 */

import { Transaction, Account } from '../../types';

import { getAIMemory, learnMemory, detectAndLearnPatterns, AIMemory } from './aiMemory';
import { runFinancialEngine, FinancialState } from './financialEngine';
import { detectFinancialProfile, FinancialProfileResult } from './behaviorAnalyzer';
import { detectFinancialRisks, FinancialRiskAlert } from './riskAnalyzer';
import { generateFinancialInsights, AIInsight } from './insightGenerator';
import {
  adjustCashflowWithPatterns,
  generateAdaptiveInsights,
  getAdaptiveLearningStats,
} from './adaptiveAIEngine';
import { runFinancialAutopilot, AutopilotAction } from './financialAutopilot';
import { learnCategoryFromTransactions } from './categoryLearning';
import { detectFinancialLeaks, FinancialLeak } from './leakDetector';

// ─── Pipeline Output ──────────────────────────────────────────────────────────

export interface AIAnalysisResult {
  // Metadados do pipeline
  pipeline_version: string;
  user_id: string;
  computed_at: string;
  processing_ms: number;

  // Camada 3 — Financial Engine
  financial_state: FinancialState;

  // Camada 4 — Behavior Engine
  profile: FinancialProfileResult;

  // Camada 5 — Risk Engine
  risks: FinancialRiskAlert[];

  // Camada 6 — Insight Engine (base + adaptativos combinados)
  insights: AIInsight[];

  // Camada 2 — Memory (snapshot do estado atual)
  memory_snapshot: { key: string; value: string; confidence: number }[];

  // Adaptive Learning stats
  adaptive_learning: {
    is_learning: boolean;
    pattern_count: number;
    memory_count: number;
    last_run: string | null;
  };

  // Diagnóstico geral
  health_score: number; // 0-100
  health_label: 'crítico' | 'atenção' | 'estável' | 'saudável' | 'excelente';
}

// ─── Health Score Calculator ──────────────────────────────────────────────────

function calcHealthScore(
  financial: FinancialState,
  risks: FinancialRiskAlert[],
  insights: AIInsight[]
): { score: number; label: AIAnalysisResult['health_label'] } {
  let score = 70; // base neutra

  // Saldo positivo → sobe
  const { balance } = financial.summary_all_time;
  if (balance > 0) score += 10;
  else score -= 20;

  // Taxa de poupança
  const { income, expenses } = financial.summary_all_time;
  if (income > 0) {
    const savingRate = (income - expenses) / income;
    if (savingRate > 0.3) score += 15;
    else if (savingRate > 0.1) score += 5;
    else if (savingRate < 0) score -= 20;
  }

  // Riscos altos
  const highRisks = risks.filter(r => r.severity === 'high').length;
  score -= highRisks * 15;
  const medRisks = risks.filter(r => r.severity === 'medium').length;
  score -= medRisks * 7;

  // Insights de warning
  const warnings = insights.filter(i => i.type === 'warning' && i.severity === 'high').length;
  score -= warnings * 10;

  // Savings insights → bônus
  const savings = insights.filter(i => i.type === 'saving').length;
  score += savings * 5;

  // Clamp 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: AIAnalysisResult['health_label'];
  if (score >= 85) label = 'excelente';
  else if (score >= 65) label = 'saudável';
  else if (score >= 45) label = 'estável';
  else if (score >= 25) label = 'atenção';
  else label = 'crítico';

  return { score, label };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runAIPipeline(
  transactions: Transaction[],
  userId: string
): Promise<AIAnalysisResult> {
  const start = Date.now();

  // Camada 2 — Memory (leitura)
  const memories = await getAIMemory(userId);

  // Camada 3 — Financial Engine
  const financial_state = runFinancialEngine(transactions);

  // PART 5 — Adaptive: ajustar predição de caixa com padrões aprendidos
  const adjustedPrediction = adjustCashflowWithPatterns(
    financial_state.cashflow_prediction,
    memories
  );
  financial_state.cashflow_prediction = adjustedPrediction;

  // Camada 4 — Behavior Engine
  const profile = detectFinancialProfile(transactions);

  // Camada 5 — Risk Engine (usa predição ajustada)
  const risks = detectFinancialRisks(adjustedPrediction);

  // Camada 6 — Insight Engine (base + adaptativos)
  const baseInsights = generateFinancialInsights(transactions, userId);
  const adaptiveInsights = generateAdaptiveInsights(transactions, memories, userId);
  // Combinar e deduplificar por mensagem
  const seenMessages = new Set<string>();
  const insights = [...baseInsights, ...adaptiveInsights].filter(i => {
    if (seenMessages.has(i.message)) return false;
    seenMessages.add(i.message);
    return true;
  });

  // Saúde geral
  const { score, label } = calcHealthScore(financial_state, risks, insights);

  // Camada 2 — Memory (escrita: aprender padrões e salvar insights em background)
  // Usamos Promise.all para garantir que o pipeline espere por essas escritas,
  // mas com um .catch individual para que uma falha não pare as outras.
  try {
    const learningPromises = [
      detectAndLearnPatterns(userId, transactions).catch(e => console.error('Erro em detectAndLearnPatterns:', e)),
      learnMemory(userId, 'financial_profile', profile.profile, 0.8).catch(e => console.error('Erro ao salvar profile memory:', e)),
      learnMemory(userId, 'balance_trend', financial_state.summary_current_month.balance >= 0 ? 'positivo' : 'negativo', 0.7).catch(e => console.error('Erro ao salvar balance trend memory:', e))
    ];
    await Promise.all(learningPromises);
  } catch (error) {
    console.error("Uma ou mais promessas de aprendizado falharam:", error);
  }

  const processing_ms = Date.now() - start;

  return {
    pipeline_version: '0.4',
    user_id: userId,
    computed_at: new Date().toISOString(),
    processing_ms,
    financial_state,
    profile,
    risks,
    insights,
    memory_snapshot: memories.map(m => ({ key: m.key, value: m.value, confidence: m.confidence })),
    adaptive_learning: getAdaptiveLearningStats(userId),
    health_score: score,
    health_label: label,
  };
}

// ─── Lightweight sync version (sem async/memória — para uso em renders) ───────

export function runAIPipelineSync(
  transactions: Transaction[],
  userId: string = 'local'
): Omit<AIAnalysisResult, 'memory_snapshot' | 'pipeline_version' | 'user_id'> {
  const start = Date.now();

  // Ler memória de forma síncrona
  let memories: AIMemory[] = [];
  try {
    const all = JSON.parse(localStorage.getItem('flow_ai_memory') || '[]') as AIMemory[];
    memories = all.filter((m: AIMemory) => m.user_id === userId);
  } catch { /* silencioso */ }

  const financial_state = runFinancialEngine(transactions);

  // PART 5 — Ajustar predição com padrões aprendidos
  financial_state.cashflow_prediction = adjustCashflowWithPatterns(
    financial_state.cashflow_prediction,
    memories
  );

  const profile = detectFinancialProfile(transactions);
  const risks = detectFinancialRisks(financial_state.cashflow_prediction);

  // PART 7 — Insights base + adaptativos
  const baseInsights = generateFinancialInsights(transactions, userId);
  const adaptiveInsights = generateAdaptiveInsights(transactions, memories, userId);
  const seenMessages = new Set<string>();
  const insights = [...baseInsights, ...adaptiveInsights].filter(i => {
    if (seenMessages.has(i.message)) return false;
    seenMessages.add(i.message);
    return true;
  });

  const { score, label } = calcHealthScore(financial_state, risks, insights);
  const adaptiveStats = getAdaptiveLearningStats(userId);

  return {
    computed_at: new Date().toISOString(),
    processing_ms: Date.now() - start,
    financial_state,
    profile,
    risks,
    insights,
    adaptive_learning: adaptiveStats,
    health_score: score,
    health_label: label,
  };
}

// ─── AI ORCHESTRATOR ENGINE ───────────────────────────────────────────────────

export interface AIOrchestratorResult {
  profile: FinancialProfileResult;
  risks: FinancialRiskAlert[];
  insights: AIInsight[];
  autopilot_actions: AutopilotAction[];
  leaks: FinancialLeak[];
}

/**
 * Executa o AI Orchestrator completo.
 */
export async function runAIOrchestrator(
  userId: string,
  accounts: Account[],
  transactions: Transaction[]
): Promise<AIOrchestratorResult> {
  // 1. Detectar perfil financeiro
  const profile = detectFinancialProfile(transactions);

  // 2. Executar risk detection
  const financialState = runFinancialEngine(transactions);
  const risks = detectFinancialRisks(financialState.cashflow_prediction);

  // 3. Gerar insights
  const insights = generateFinancialInsights(transactions, userId);

  // 4. Executar financial autopilot
  const autopilot_actions = runFinancialAutopilot(accounts, transactions);

  // 5. Executar category learning
  await learnCategoryFromTransactions(userId, transactions);

  // 6. Executar leak detection
  const leaks = detectFinancialLeaks(transactions);

  // 7. Atualizar adaptive AI (já feito no financial engine)

  return {
    profile,
    risks,
    insights,
    autopilot_actions,
    leaks,
  };
}
