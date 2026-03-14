import { buildAIContext, AIContextInput } from './aiContextBuilder';
import { makeAIDecision } from './aiDecisionEngine';
import { eventBus } from '../../events/EventBus';
import { AI_TASK_COMPLETED } from '../../events/events/AITaskCompleted';
import { financialPatternDetector } from '../finance/patternDetector/financialPatternDetector';
import { aiMemoryEngine } from '../../ai/memory/AIMemoryEngine';
import { moneyMapEngine } from '../finance/moneyMap/moneyMapEngine';
import { cashflowPredictionEngine } from '../finance/cashflowPrediction/cashflowPredictionEngine';
import { detectSubscriptions } from '../finance/subscriptionDetector';
import { calculateFinancialHealth } from '../finance/financialHealth/financialHealthEngine';
import { buildSmartGoalPlan } from '../finance/smartGoals';
import { buildFinancialTimeline as buildTimelineAI } from '../finance/timeline';

export interface AIOrchestratorInsight {
  timestamp: string;
  userId: string;
  decision: ReturnType<typeof makeAIDecision>;
  profile: ReturnType<typeof buildAIContext>['financialProfile'];
  timelineTotals: ReturnType<typeof buildAIContext>['timeline']['totals'];
  moneyMap: ReturnType<typeof moneyMapEngine.generate>;
  cashflowForecast: ReturnType<typeof cashflowPredictionEngine.predict>;
  subscriptions: ReturnType<typeof detectSubscriptions>;
  financialHealth: ReturnType<typeof calculateFinancialHealth>;
  timelineAI: ReturnType<typeof buildTimelineAI>;
}

const lastInsights: AIOrchestratorInsight[] = [];

export async function runAIOrchestrator(input: AIContextInput): Promise<{
  context: ReturnType<typeof buildAIContext>;
  decision: ReturnType<typeof makeAIDecision>;
}> {
  const start = Date.now();

  const patterns = financialPatternDetector.detectPatterns(input.transactions);
  const moneyMap = moneyMapEngine.generate(input.transactions);

  const context = buildAIContext(input);
  const cashflowForecast = cashflowPredictionEngine.predict({
    balance: context.balance,
    transactions: input.transactions,
    patterns,
  });

  const subscriptions = detectSubscriptions(
    input.transactions.map((tx) => ({
      amount: tx.amount,
      date: tx.date,
      merchant: tx.merchant,
      description: tx.description,
    })),
  );

  const dominantCategoryShare = (moneyMap[0]?.percentage ?? 0) / 100;
  const expenseRatio = context.monthlyIncome > 0
    ? context.monthlySpending / context.monthlyIncome
    : 1;
  const savingsRate = context.monthlyIncome > 0
    ? (context.monthlyIncome - context.monthlySpending) / context.monthlyIncome
    : 0;

  const financialHealth = calculateFinancialHealth({
    expenseRatio,
    savingsRate,
    forecast: { in30Days: cashflowForecast.in30Days },
    subscriptionCount: subscriptions.length,
    dominantCategoryShare,
  });

  const smartGoalsPreview = buildSmartGoalPlan({
    goalAmount: context.monthlyIncome * 6,
    currentAmount: Math.max(0, context.balance),
    monthsToGoal: 12,
    monthlyIncome: context.monthlyIncome,
    monthlyExpenses: context.monthlySpending,
  });

  const timelineAI = buildTimelineAI(
    input.transactions.map((tx) => ({
      date: tx.date,
      amount: tx.type === 'Receita' ? tx.amount : -Math.abs(tx.amount),
      category: String(tx.category),
      merchant: tx.merchant,
    })),
  );

  aiMemoryEngine.updateMemory(patterns, input.userContext.userId, { moneyMap });
  const decision = makeAIDecision(context);

  const enrichedMemory = {
    ...(input.memory || {}),
    financialProfile: context.financialProfile,
    timelineTotals: context.timeline.totals,
    moneyMap,
    cashflowForecast,
    subscriptions,
    financialHealth,
    smartGoalsPreview,
    timelineAI,
  };

  eventBus.emit(AI_TASK_COMPLETED, {
    taskId: `ai_${Date.now()}`,
    engine: 'aiOrchestrator',
    userId: context.userId,
    durationMs: Date.now() - start,
    success: true,
  });

  lastInsights.unshift({
    timestamp: new Date().toISOString(),
    userId: context.userId,
    decision,
    profile: context.financialProfile,
    timelineTotals: context.timeline.totals,
    moneyMap,
    cashflowForecast,
    subscriptions,
    financialHealth,
    timelineAI,
  });

  if (lastInsights.length > 50) {
    lastInsights.splice(50);
  }

  return {
    context: {
      ...context,
      memory: enrichedMemory,
    },
    decision,
  };
}

export function getLastInsights(): AIOrchestratorInsight[] {
  return [...lastInsights];
}
