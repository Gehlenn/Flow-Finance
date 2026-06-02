import { AppError } from '../middleware/errorHandler';
import { getSafeBlockedResponse } from '../services/ai/PromptInjectionGuard';
import type { InterpretResponse, GenerateInsightsResponse } from '../types';

const MAX_CFO_CONTEXT_CHARS = 20000;
const ALLOWED_CFO_INTENTS = new Set([
  'spending_advice',
  'cash_position',
  'risk_question',
  'savings_question',
  'monthly_summary',
  'receivables_question',
]);

export function normalizeCFORequestInput(payload: {
  question?: unknown;
  context?: unknown;
  intent?: unknown;
}): { question: string; context: string; intent: string } {
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  if (!question) {
    throw new AppError(400, 'question is required');
  }

  const rawContext = typeof payload.context === 'string' ? payload.context : '';
  const context = rawContext.length > MAX_CFO_CONTEXT_CHARS
    ? rawContext.slice(0, MAX_CFO_CONTEXT_CHARS)
    : rawContext;

  const rawIntent = typeof payload.intent === 'string' ? payload.intent : '';
  const intent = ALLOWED_CFO_INTENTS.has(rawIntent) ? rawIntent : 'monthly_summary';

  return { question, context, intent };
}

export function buildInterpretFallbackResponse(): InterpretResponse {
  return {
    intent: 'transaction',
    data: [],
  };
}

export function buildInsightsFallbackResponse(type: 'daily' | 'strategic'): GenerateInsightsResponse {
  if (type === 'daily') {
    return { insights: [] };
  }

  return {
    report: {
      summary: 'Não foi possível gerar o relatório estratégico agora.',
      strengths: [],
      weaknesses: [],
      risks: [],
      opportunities: [],
      actions: [],
    },
  };
}

export function buildCfoSafetyPreamble(): string {
  return `
Você é o Assistente Financeiro do Flow Finance.

REGRAS OBRIGATÓRIAS:
1. Nunca faça garantias financeiras absolutas.
2. Responda como apoio consultivo prático de caixa de curto prazo, não como agente autônomo.
3. Seja direto, objetivo e em português brasileiro.
4. Responda em 2 a 4 blocos curtos, com foco operacional.
5. Quando houver risco, avise com clareza mas sem alarmismo.
6. Nunca invente dados - use APENAS o contexto fornecido.
7. Se não houver dados suficientes, diga isso de forma explícita e curta.
8. Diferencie claramente: caixa confirmado, previsto, pendente e vencido.
9. Recebível pendente NÃO é dinheiro disponível.
10. Não proponha automação externa, integrações novas nem ações automáticas fora do produto.
11. Não faça recomendação de investimento e não trate investimento como foco da resposta.
`.trim();
}

export function buildCfoIntentGuide(): Record<string, string> {
  return {
    spending_advice: 'O usuário quer saber se pode gastar agora. Traga impacto no caixa confirmado e risco de curto prazo.',
    cash_position: 'O usuário quer leitura de saldo e caixa disponível. Diferencie confirmado de previsto.',
    risk_question: 'O usuário quer risco de curto prazo. Destaque sinais de atenção sem exagero.',
    receivables_question: 'O usuário quer leitura de recebíveis, pendências e vencidos. Separe claramente o que está apenas previsto/pendente do que está confirmado.',
    savings_question: 'O usuário quer economia prática. Sugira cortes concretos e de curto prazo.',
    monthly_summary: 'O usuário quer resumo do mês com foco em decisão operacional.',
  };
}

export function buildCfoPrompt(params: {
  context: string;
  intent: string;
  question: string;
}): string {
  const guide = buildCfoIntentGuide();
  return `
${buildCfoSafetyPreamble()}

CONTEXTO FINANCEIRO:
${params.context}

TIPO DE PERGUNTA: ${guide[params.intent] || params.intent}

PERGUNTA DO USUÁRIO: "${params.question}"

Responda de forma consultiva, personalizada e baseada exclusivamente nos dados acima.
`;
}

export function summarizeConfidenceSummary(
  data: unknown,
): 'high' | 'medium' | 'low' | 'unknown' {
  if (Array.isArray(data)) {
    const numeric = (data as Array<{ confidence?: unknown }>)
      .map((item) => Number(item?.confidence))
      .filter((v) => !isNaN(v));
    if (numeric.length === 0) return 'unknown';
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    if (avg >= 0.75) return 'high';
    if (avg >= 0.5) return 'medium';
    return 'low';
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.fieldConfidences && typeof obj.fieldConfidences === 'object') {
      const values = Object.values(obj.fieldConfidences as Record<string, unknown>);
      let hasLow = false;
      let hasHigh = false;
      for (const v of values) {
        if (v === 'low' || (typeof v === 'number' && v < 0.5)) hasLow = true;
        if (v === 'high' || (typeof v === 'number' && v >= 0.75)) hasHigh = true;
      }
      if (hasLow) return 'low';
      if (hasHigh) return 'high';
      return 'medium';
    }
    if (obj.confidence !== undefined) {
      const v = Number(obj.confidence);
      if (!isNaN(v)) {
        if (v >= 0.75) return 'high';
        if (v >= 0.5) return 'medium';
        return 'low';
      }
    }
  }

  return 'unknown';
}

export { getSafeBlockedResponse };
