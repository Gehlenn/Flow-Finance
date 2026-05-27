import { GeminiService } from '../../services/geminiService';
import { learnMemory } from './aiMemory';
import { logAIDebug } from './aiDebugService';
import { logWarn } from '../utils/logger';
import { buildCFOExplainability, buildCFOResponseDepth } from './aiCFOHelpers';
import type { AICFOResponse, CFOIntent } from './aiCFOTypes';

export { analyzeFinancialQuestion, buildFinancialContext } from './aiCFOHelpers';
export { buildCFOExplainability, buildCFOResponseDepth } from './aiCFOHelpers';
export type { AICFOConfidenceBand, AICFOExplainability, AICFOResponse, CFOIntent } from './aiCFOTypes';

export async function generateCFOResponse(
  question: string,
  context: string,
  intent: CFOIntent,
): Promise<AICFOResponse> {
  try {
    const gemini = new GeminiService();
    const result = await gemini.generateCFO(question, context, intent);
    const answer = result.answer?.trim();
    const fallbackDiagnostic = {
      kind: 'ai_unavailable' as const,
      message: 'Nao foi possivel gerar uma resposta no momento.',
      suggestion: 'Tente novamente em alguns instantes ou verifique a sessao do workspace.',
    };
    const explainability = buildCFOExplainability(context, intent);
    const responseDepth = buildCFOResponseDepth(explainability);
    logAIDebug({
      input: question,
      intent,
      raw_response: result.answer || '',
      error: 'CFO response empty fallback',
    });
    if (!answer || answer.length === 0) {
      logWarn('[AI CFO] Empty CFO response; returning fallback diagnostic', {
        intent,
        fallback: 'ai-cfo-empty-response',
      });
    }
    return {
      question,
      answer: answer && answer.length > 0 ? answer : fallbackDiagnostic.message,
      context_summary: 'Resposta ancorada em dados reais do workspace quando disponiveis.',
      intent,
      response_depth: responseDepth,
      timestamp: new Date().toISOString(),
      diagnostic: answer && answer.length > 0 ? undefined : fallbackDiagnostic,
      explainability:
        answer && answer.length > 0
          ? explainability
          : buildCFOExplainability(context, intent, { forceLowConfidence: true }),
    };
  } catch (error: unknown) {
    const fallbackError = error instanceof Error ? error : new Error(String(error ?? 'CFO response failed'));
    logWarn('[AI CFO] Failed to generate CFO response; returning fallback diagnostic', {
      intent,
      error: fallbackError,
      fallback: 'ai-cfo-response-failed',
    });
    logAIDebug({
      input: question,
      intent,
      error: fallbackError.message,
    });
    return {
      question,
      answer: 'Com base nos seus dados, nao consegui processar a consulta agora. Verifique sua conexao e tente novamente.',
      intent,
      response_depth: 'reduced',
      timestamp: new Date().toISOString(),
      diagnostic: {
        kind: 'ai_unavailable',
        message: 'Com base nos seus dados, nao consegui processar a consulta agora.',
        suggestion: 'Verifique sua conexao, recarregue a sessao do workspace e tente novamente.',
      },
      explainability: buildCFOExplainability(context, intent, { forceLowConfidence: true }),
    };
  }
}

export async function learnFromConversation(
  userId: string,
  question: string,
  intent: CFOIntent,
): Promise<void> {
  const lower = question.toLowerCase();

  if (intent === 'savings_question') {
    await learnMemory(userId, 'user_budget_goal', 'save_money', 0.7, { source: 'conversa' });
  }
  if (lower.includes('salario') || lower.includes('salário')) {
    const match = lower.match(/(\d+)/);
    if (match) await learnMemory(userId, 'mentioned_salary', match[1], 0.6, { source: 'conversa' });
  }
  if (lower.includes('mercado') || lower.includes('supermercado')) {
    await learnMemory(userId, 'frequent_merchant', 'mercado', 0.65, { source: 'conversa' });
  }
  if (intent === 'spending_advice') {
    await learnMemory(userId, 'asks_before_spending', 'true', 0.8, { source: 'conversa' });
  }
}
