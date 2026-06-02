import { type Account } from '../../models/Account';
import { type Transaction } from '../../types';
import { getAIMemory, getAIMemorySnapshot } from './aiMemory';
import { runFinancialEngine, type FinancialState } from './financialEngine';
import {
  buildConsultantProfile,
  computeFinancialSignals,
  signalsToInsights,
  signalsToRisks,
  toLegacyAutopilotActions,
  type ConsultantProfile,
  type LegacyAutopilotAction,
} from './signalEngine';

export interface AIAnalysisResult {
  pipeline_version: string;
  user_id: string;
  computed_at: string;
  processing_ms: number;
  financial_state: FinancialState;
  profile: ConsultantProfile;
  risks: ReturnType<typeof signalsToRisks>;
  insights: ReturnType<typeof signalsToInsights>;
  memory_snapshot: { key: string; value: string; confidence: number }[];
  adaptive_learning: {
    is_learning: boolean;
    pattern_count: number;
    memory_count: number;
    last_run: string | null;
  };
  health_score: number;
  health_label: 'critico' | 'atencao' | 'estavel' | 'saudavel' | 'excelente';
}

export interface AIOrchestratorResult {
  profile: ConsultantProfile;
  risks: ReturnType<typeof signalsToRisks>;
  insights: ReturnType<typeof signalsToInsights>;
  autopilot_actions: LegacyAutopilotAction[];
  leaks: [];
}

function scoreHealth(signals: ReturnType<typeof computeFinancialSignals>): {
  score: number;
  label: AIAnalysisResult['health_label'];
} {
  let score = 78;
  score -= signals.filter((signal) => signal.severity === 'urgent').length * 25;
  score -= signals.filter((signal) => signal.severity === 'attention').length * 10;
  score += signals.filter((signal) => signal.kind === 'opportunity').length * 4;
  score = Math.max(0, Math.min(100, score));

  if (score >= 85) return { score, label: 'excelente' };
  if (score >= 65) return { score, label: 'saudavel' };
  if (score >= 45) return { score, label: 'estavel' };
  if (score >= 25) return { score, label: 'atencao' };
  return { score, label: 'critico' };
}

function buildAnalysis(
  transactions: Transaction[],
  userId: string,
  accounts: Account[] = [],
) {
  const financial_state = runFinancialEngine(transactions);
  const signals = computeFinancialSignals({
    accounts,
    transactions,
    prediction: financial_state.cashflow_prediction,
    userId,
  });
  const insights = signalsToInsights(signals, userId);
  const risks = signalsToRisks(signals);
  const profile = buildConsultantProfile(transactions, financial_state.cashflow_prediction, signals);
  const { score, label } = scoreHealth(signals);

  return {
    financial_state,
    profile,
    risks,
    insights,
    signals,
    health_score: score,
    health_label: label,
  };
}

export async function runAIPipeline(
  transactions: Transaction[],
  userId: string,
): Promise<AIAnalysisResult> {
  const startedAt = Date.now();
  const analysis = buildAnalysis(transactions, userId);
  const memories = await getAIMemory(userId);

  return {
    pipeline_version: '0.5',
    user_id: userId,
    computed_at: new Date().toISOString(),
    processing_ms: Date.now() - startedAt,
    financial_state: analysis.financial_state,
    profile: analysis.profile,
    risks: analysis.risks,
    insights: analysis.insights,
    memory_snapshot: memories.map((memory) => ({
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence,
    })),
    adaptive_learning: {
      is_learning: false,
      pattern_count: 0,
      memory_count: memories.length,
      last_run: null,
    },
    health_score: analysis.health_score,
    health_label: analysis.health_label,
  };
}

export function runAIPipelineSync(
  transactions: Transaction[],
  userId = 'local',
) {
  const startedAt = Date.now();
  const analysis = buildAnalysis(transactions, userId);
  const memorySnapshot = getAIMemorySnapshot(userId);

  return {
    computed_at: new Date().toISOString(),
    processing_ms: Date.now() - startedAt,
    financial_state: analysis.financial_state,
    profile: analysis.profile,
    risks: analysis.risks,
    insights: analysis.insights,
    adaptive_learning: {
      is_learning: false,
      pattern_count: 0,
      memory_count: memorySnapshot.length,
      last_run: null,
    },
    health_score: analysis.health_score,
    health_label: analysis.health_label,
  };
}

export async function runLegacyAIOrchestrator(
  userId: string,
  accounts: Account[],
  transactions: Transaction[],
): Promise<AIOrchestratorResult> {
  const analysis = buildAnalysis(transactions, userId, accounts);

  return {
    profile: analysis.profile,
    risks: analysis.risks,
    insights: analysis.insights,
    autopilot_actions: toLegacyAutopilotActions(analysis.signals),
    leaks: [],
  };
}

export const runAIOrchestrator = runLegacyAIOrchestrator;
