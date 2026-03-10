import { buildAIContext, AIContextInput } from './aiContextBuilder';
import { makeAIDecision } from './aiDecisionEngine';
import { eventBus } from '../../events/EventBus';
import { AI_TASK_COMPLETED } from '../../events/events/AITaskCompleted';

export async function runAIOrchestrator(input: AIContextInput): Promise<{
  context: ReturnType<typeof buildAIContext>;
  decision: ReturnType<typeof makeAIDecision>;
}> {
  const start = Date.now();

  const context = buildAIContext(input);
  const decision = makeAIDecision(context);

  eventBus.emit(AI_TASK_COMPLETED, {
    taskId: `ai_${Date.now()}`,
    engine: 'aiOrchestrator',
    durationMs: Date.now() - start,
    success: true,
  });

  return { context, decision };
}
