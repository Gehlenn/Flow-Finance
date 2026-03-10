import { buildAIContext, AIContextInput } from './aiContextBuilder';
import { makeAIDecision } from './aiDecisionEngine';
import { eventBus } from '../../events/EventBus';
import { AI_TASK_COMPLETED } from '../../events/events/AITaskCompleted';
import { financialPatternDetector } from '../finance/patternDetector/financialPatternDetector';
import { aiMemoryEngine } from '../../ai/memory/AIMemoryEngine';

export async function runAIOrchestrator(input: AIContextInput): Promise<{
  context: ReturnType<typeof buildAIContext>;
  decision: ReturnType<typeof makeAIDecision>;
}> {
  const start = Date.now();

  const patterns = financialPatternDetector.detectPatterns(input.transactions);
  aiMemoryEngine.updateMemory(patterns, input.userContext.userId);

  const context = buildAIContext(input);
  const decision = makeAIDecision(context);

  const enrichedMemory = {
    ...(input.memory || {}),
    financialProfile: context.financialProfile,
    timelineTotals: context.timeline.totals,
  };

  eventBus.emit(AI_TASK_COMPLETED, {
    taskId: `ai_${Date.now()}`,
    engine: 'aiOrchestrator',
    userId: context.userId,
    durationMs: Date.now() - start,
    success: true,
  });

  return {
    context: {
      ...context,
      memory: enrichedMemory,
    },
    decision,
  };
}
