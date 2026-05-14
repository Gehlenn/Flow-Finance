/**
 * Assistente Financeiro IA ��� Apoio consultivo do Flow Finance
 *
 * Pipeline:
 *   Pergunta do usu+�rio
 *       ���
 *   analyzeFinancialQuestion  ��� detecta intent
 *       ���
 *   buildFinancialContext     ��� monta contexto dos dados do usu+�rio
 *       ���
 *   generateCFOResponse       ��� chama LLM com contexto + pergunta
 *       ���
 *   AICFOResponse             ��� exibe para o usu+�rio
 */

import { Transaction, TransactionType } from '../../types';
import { GeminiService } from '../../services/geminiService';

import { Account } from '../../models/Account';
import { AIInsight } from './insightGenerator';
import { CashflowPrediction } from './riskAnalyzer';
import { learnMemory } from './aiMemory';
import { buildFinancialGraph, graphToAIContext, getTopMerchants, getCategorySpending } from './financialGraph';
import { getSpendingPatterns, getUserBehaviors, getFinancialProfile, getMerchantCategories } from './memory';
import { ProductFinancialIntelligence } from '../app/productFinancialIntelligence';
import { logAIDebug } from './aiDebugService';
import { logWarn } from '../utils/logger';

function parseCfoDate(value: string): Date | null {
  const dateOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const localDate = new Date(year, month, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ��������� PART 2 ��� Response Model ������������������������������������������������������������������������������������������������������������������������������������������������������

export type AICFOConfidenceBand = 'low' | 'medium' | 'high';

export interface AICFOExplainability {
  reasons_used: string[];
  evidence: {
    confirmed_cash?: string;
    forecast_30d?: string;
    month_result?: string;
    data_quality_note?: string;
    base_sufficiency: 'strong' | 'limited';
  };
  confidence_band: AICFOConfidenceBand;
}

export interface AICFOResponse {
  explainability: AICFOExplainability;
  question: string;
  answer: string;
  context_summary?: string;
  intent?: CFOIntent;
  timestamp: string;
  diagnostic?: {
    kind: 'ai_unavailable';
    message: string;
    suggestion?: string;
  };
}

// ��������� PART 4 ��� Intent Types ������������������������������������������������������������������������������������������������������������������������������������������������������������

export type CFOIntent =
  | 'spending_advice'
  | 'cash_position'
  | 'risk_question'
  | 'savings_question'
  | 'monthly_summary'
  | 'receivables_question';

interface IntentPattern {
  intent: CFOIntent;
  keywords: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'spending_advice',
    keywords: ['posso gastar', 'consigo comprar', 'vale a pena', 'devo comprar', 'tenho como pagar', 'posso comprar'],
  },
  {
    intent: 'cash_position',
    keywords: ['saldo', 'dispon+�vel', 'caixa hoje', 'quanto tenho', 'quanto sobra', 'caixa confirmado'],
  },
  {
    intent: 'risk_question',
    keywords: ['risco', 'perigo', 'd+�vida', 'negativo', 'prejudicar', 'alerta', 'problema', 'curto prazo', 'pr+�ximos dias'],
  },
  {
    intent: 'receivables_question',
    keywords: ['previs+�o', 'previsao', 'prever', 'pr+�ximos 7 dias', 'proximos 7 dias', 'pr+�ximos 30 dias', 'proximos 30 dias', 'entrada prevista', 'saida prevista', 'sa+�da prevista', 'proje+�+�o', 'projecao', 'pend+�ncia', 'pendencias', 'pend+�ncias', 'vencido', 'vencidos', 'receb+�vel', 'recebiveis'],
  },
  {
    intent: 'savings_question',
    keywords: ['economizar', 'poupar', 'guardar', 'reserva', 'poupan+�a', 'reduzir gastos', 'cortar gastos', 'economia'],
  },
  {
    intent: 'monthly_summary',
    keywords: ['resumo do m+�s', 'fechamento do m+�s', 'resumo mensal', 'como foi o m+�s'],
  },
];

export function analyzeFinancialQuestion(question: string): CFOIntent {
  const lower = question.toLowerCase();
  for (const { intent, keywords } of INTENT_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return intent;
  }
  return 'monthly_summary';
}

// ��������� PART 3 ��� Financial Context Builder ������������������������������������������������������������������������������������������������������������������

export function buildFinancialContext(
  accounts: Account[],
  transactions: Transaction[],
  prediction: CashflowPrediction,
  insights: AIInsight[],
  userId: string = 'local',
  intelligence?: ProductFinancialIntelligence,
): string {
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const baseTxs = transactions.filter(t => !t.generated);

  // Saldo total das contas
  const totalAccountBalance = accounts.reduce((s, a) => s + a.balance, 0);

  // Categoria dominante
  const catMap: Record<string, number> = {};
  for (const t of baseTxs.filter(t => t.type === TransactionType.DESPESA)) {
    catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
  }
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  // Receita e despesa do m+�s atual
  const now = new Date();
  const currentMonthTxs = baseTxs.filter(t => {
    const d = parseCfoDate(t.date);
    if (!d) return false;
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthIncome = currentMonthTxs
    .filter(t => t.type === TransactionType.RECEITA)
    .reduce((s, t) => s + t.amount, 0);
  const monthExpenses = currentMonthTxs
    .filter(t => t.type === TransactionType.DESPESA)
    .reduce((s, t) => s + t.amount, 0);

  // Contas listadas
  const accountLines = accounts.length > 0
    ? accounts.map(a => `  - ${a.name} (${a.type}): ${fmt(a.balance)}`).join('\n')
    : '  - Nenhuma conta cadastrada';

  // Insights resumidos
  const insightLines = insights.length > 0
    ? insights.slice(0, 3).map(i => `  - [${i.type}] ${i.message}`).join('\n')
    : '  - Nenhum insight dispon+�vel';

  const advancedForecast = intelligence?.context.cashflowForecast;
  const advancedProfile = intelligence?.context.base.financialProfile;
  const forecast30Days = advancedForecast?.in30Days ?? prediction.balance_30_days;
  const pendingAndOverdueAvailable = false;
  const advancedLines = intelligence
    ? [
        '=== CONTEXTO AVANCADO DE IA ===',
        `CONFIANCA GERAL: ${(intelligence.context.confidence.overall * 100).toFixed(0)}%`,
        `PADROES RECORRENTES: ${intelligence.recurringCount}`,
        `QUALIDADE DOS DADOS (merchant coverage): ${intelligence.merchantCoveragePercent}%`,
        `TENDENCIA DO SALDO: ${intelligence.balanceTrend}`,
        `ANOMALIAS NA TIMELINE: ${intelligence.timelineAnomalies.length}`,
        `CATEGORIA DOMINANTE: ${intelligence.dominantCategoryLabel || 'Sem dominancia clara'}`,
        advancedProfile
          ? `PERFIL FINANCEIRO ENGINE: ${advancedProfile.profile} (${(advancedProfile.confidence * 100).toFixed(0)}% de confianca)`
          : 'PERFIL FINANCEIRO ENGINE: indisponivel',
      ].join('\n')
    : '';

  // PART 5 ��� Graph context
  let graphContext = '';
  try {
    const graph = buildFinancialGraph('local', accounts, transactions);
    graphContext = '\n\n' + graphToAIContext(graph, 6);
  } catch (err) {
    logWarn('[buildFinancialContext] Graph context unavailable; continuing without graph enrichment', {
      userId,
      error: err,
    });
  }

  // AI MEMORY SYSTEM 2.0 ��� Behavioral context
  let behaviorContext = '';
  try {
    const spendingPatterns = getSpendingPatterns(userId);
    const behaviors = getUserBehaviors(userId);
    const profile = getFinancialProfile(userId);
    const merchants = getMerchantCategories(userId);

    if (spendingPatterns.length > 0 || behaviors.length > 0 || profile) {
      behaviorContext += '\n\n=== PADR+�ES COMPORTAMENTAIS APRENDIDOS ===\n';
      
      if (profile) {
        behaviorContext += `\nPERFIL FINANCEIRO: ${profile.profile.toUpperCase()}\n`;
        behaviorContext += `  - Taxa de poupan+�a: ${profile.savingsRate.toFixed(1)}%\n`;
        behaviorContext += `  - Renda m+�dia mensal: ${fmt(profile.averageMonthlyIncome)}\n`;
        behaviorContext += `  - Despesas m+�dia mensal: ${fmt(profile.averageMonthlyExpenses)}\n`;
      }

      if (spendingPatterns.length > 0) {
        behaviorContext += '\nPADR+�ES DE GASTOS:\n';
        spendingPatterns.slice(0, 3).forEach(pattern => {
          behaviorContext += `  - ${pattern.description}\n`;
        });
      }

      if (behaviors.length > 0) {
        behaviorContext += '\nCOMPORTAMENTOS DETECTADOS:\n';
        behaviors.slice(0, 3).forEach(behavior => {
          const behaviorLabels: Record<string, string> = {
            impulsive_spending: 'Gastos impulsivos',
            budget_conscious: 'Consciente do or+�amento',
            weekend_spender: 'Gasta mais aos finais de semana',
            online_shopper: 'Comprador online',
          };
          const label = behaviorLabels[behavior.behavior] || behavior.behavior;
          behaviorContext += `  - ${label} (${behavior.score.toFixed(0)}% de confian+�a)\n`;
        });
      }

      if (merchants.length > 0) {
        behaviorContext += '\nCOMERCIANTES FREQUENTES:\n';
        merchants.slice(0, 3).forEach(merchant => {
          behaviorContext += `  - ${merchant.merchantName}: ${merchant.frequency.toFixed(1)} visitas/m+�s, ${fmt(merchant.avgAmount)} m+�dia\n`;
        });
      }
    }
  } catch (err) {
    logWarn('[buildFinancialContext] Failed to load AI memories; continuing without behavioral context', {
      userId,
      error: err,
    });
  }

  return `
=== DADOS FINANCEIROS DO USU+�RIO ===

CONTAS:
${accountLines}

CAIXA OPERACIONAL CALCULADO: ${fmt(prediction.current_balance)}
SALDO DAS CONTAS: ${fmt(totalAccountBalance)}

M+�S ATUAL:
  - Receitas: ${fmt(monthIncome)}
  - Despesas: ${fmt(monthExpenses)}
  - Resultado: ${fmt(monthIncome - monthExpenses)}

PROJE+�+�ES:
  - Em 7 dias: ${fmt(advancedForecast?.in7Days ?? prediction.balance_7_days)}
  - Em 30 dias: ${fmt(advancedForecast?.in30Days ?? prediction.balance_30_days)}
  - Em 90 dias: ${fmt(advancedForecast?.in90Days ?? prediction.balance_30_days)}
  - Receita projetada/m+�s: ${fmt(prediction.projected_income)}
  - Despesa projetada/m+�s: ${fmt(prediction.projected_expenses)}

MAIOR CATEGORIA DE GASTOS:
  - ${topCat ? `${topCat[0]}: ${fmt(topCat[1])}` : 'Sem dados'}

INSIGHTS RECENTES:
${insightLines}

CLASSIFICACAO DE CAIXA:
  - Confirmado (disponivel hoje): ${fmt(totalAccountBalance)}
  - Previsto (30 dias): ${fmt(forecast30Days)}
  - Pendente (a confirmar): ${pendingAndOverdueAvailable ? 'Disponivel no contexto' : 'Sem base suficiente no contexto atual'}
  - Vencido (atrasado): ${pendingAndOverdueAvailable ? 'Disponivel no contexto' : 'Sem base suficiente no contexto atual'}

REGRA OPERACIONAL:
  - Nunca considerar pendente como dinheiro disponivel.

TOTAL DE TRANSA+�+�ES REGISTRADAS: ${baseTxs.length}${advancedLines ? `\n\n${advancedLines}` : ''}${graphContext}
`.trim();
}

// ��������� PART 5 ��� Response Generation ������������������������������������������������������������������������������������������������������������������������������������

const SAFETY_PREAMBLE = `
Voc+� +� o Assistente Financeiro do Flow Finance.

REGRAS OBRIGAT+�RIAS:
1. Nunca fa+�a garantias financeiras absolutas.
2. Responda como apoio consultivo pr+�tico de caixa de curto prazo, n+�o como agente aut+�nomo.
3. Seja direto, objetivo e em portugu+�s brasileiro.
4. Responda em 2 a 4 blocos curtos, com foco operacional.
5. Quando houver risco, avise com clareza mas sem alarmismo.
6. Nunca invente dados ��� use APENAS o contexto fornecido.
7. Se n+�o houver dados suficientes, diga isso de forma expl+�cita e curta.
8. Diferencie claramente: caixa confirmado, previsto, pendente e vencido.
9. Receb+�vel pendente N+�O +� dinheiro dispon+�vel.
10. N+�o proponha automa+�+�o externa, integra+�+�es novas nem a+�+�es autom+�ticas fora do produto.
11. N+�o fa+�a recomenda+�+�o de investimento e n+�o trate investimento como foco da resposta.
`.trim();
function extractContextValue(context: string, label: string): string | undefined {
  const matchedLine = context.split('\n').find((line) => line.trim().startsWith(`${label}:`));
  if (!matchedLine) return undefined;
  return matchedLine.split(':').slice(1).join(':').trim();
}

export function buildCFOExplainability(
  context: string,
  intent: CFOIntent,
  options?: { forceLowConfidence?: boolean }
): AICFOExplainability {
  const confirmedCash = extractContextValue(context, 'Confirmado (disponivel hoje)');
  const forecast30Days = extractContextValue(context, 'Em 30 dias');
  const monthResult = extractContextValue(context, '- Resultado');
  const dataQuality = extractContextValue(context, 'QUALIDADE DOS DADOS (merchant coverage)');
  const totalTransactions = Number((context.match(/TOTAL DE TRANSA\S+ REGISTRADAS:\s*(\d+)/i) || [])[1] || 0);

  const reasonsUsed = [
    'Classificacao de caixa confirmado vs previsto.',
    'Projecao de 30 dias para risco de curto prazo.',
    intent === 'risk_question' || intent === 'spending_advice'
      ? 'Leitura conservadora para evitar usar recebivel pendente como caixa disponivel.'
      : 'Leitura operacional com base em contexto financeiro real do workspace.',
  ];

  const evidence: AICFOExplainability['evidence'] = {
    confirmed_cash: confirmedCash,
    forecast_30d: forecast30Days,
    month_result: monthResult,
    data_quality_note: dataQuality,
    base_sufficiency: totalTransactions >= 5 ? 'strong' : 'limited',
  };

  if (options?.forceLowConfidence) {
    return {
      reasons_used: reasonsUsed,
      evidence,
      confidence_band: 'low',
    };
  }

  let score = 0;
  if (confirmedCash) score += 1;
  if (forecast30Days) score += 1;
  if (monthResult) score += 1;
  if (dataQuality) score += 1;
  if (evidence.base_sufficiency === 'strong') score += 1;

  const confidenceBand: AICFOConfidenceBand = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';

  return {
    reasons_used: reasonsUsed,
    evidence,
    confidence_band: confidenceBand,
  };
}
export async function generateCFOResponse(
  question: string,
  context: string,
  intent: CFOIntent
): Promise<AICFOResponse> {
  // note: environment variables / model selection are handled server-side
  const intentGuide: Record<CFOIntent, string> = {
    spending_advice:  'O usu+�rio quer saber se pode gastar agora. Traga impacto no caixa confirmado e risco de curto prazo.',
    cash_position: 'O usu+�rio quer leitura de saldo e caixa dispon+�vel. Diferencie confirmado de previsto.',
    risk_question:    'O usu+�rio quer risco de curto prazo. Destaque sinais de aten+�+�o sem exagero.',
    savings_question: 'O usu+�rio quer economia pr+�tica. Sugira cortes concretos e de curto prazo.',
    monthly_summary:  'O usu+�rio quer resumo do m+�s com foco em decis+�o operacional.',
    receivables_question:'O usu+�rio quer leitura de receb+�veis, pend+�ncias e vencidos. Separe claramente o que est+� apenas previsto/pendente do que est+� confirmado.',
  };

  const prompt = `
${SAFETY_PREAMBLE}

CONTEXTO FINANCEIRO:
${context}

TIPO DE PERGUNTA: ${intentGuide[intent]}

PERGUNTA DO USU+�RIO: "${question}"

Responda de forma consultiva, curta e baseada exclusivamente nos dados acima.
`;

  try {
    // proxy the request to backend, which will call GPT���4 or Gemini as configured
    const gemini = new GeminiService();
    const result = await gemini.generateCFO(question, context, intent);
    const answer = result.answer?.trim();
    const fallbackDiagnostic = {
      kind: 'ai_unavailable' as const,
      message: 'Nao foi possivel gerar uma resposta no momento.',
      suggestion: 'Tente novamente em alguns instantes ou verifique a sessao do workspace.',
    };
    const explainability = buildCFOExplainability(context, intent);
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
      context_summary: 'Resposta ancorada em dados reais do workspace quando dispon+�veis.',
      intent,
      timestamp: new Date().toISOString(),
      diagnostic: answer && answer.length > 0 ? undefined : fallbackDiagnostic,
      explainability:
        answer && answer.length > 0
          ? explainability
          : buildCFOExplainability(context, intent, { forceLowConfidence: true }),
    };
  } catch (err: any) {
    logWarn('[AI CFO] Failed to generate CFO response; returning fallback diagnostic', {
      intent,
      error: err,
      fallback: 'ai-cfo-response-failed',
    });
    logAIDebug({
      input: question,
      intent,
      error: String(err?.message || err || 'CFO response failed'),
    });
    return {
      question,
      answer: 'Com base nos seus dados, nao consegui processar a consulta agora. Verifique sua conexao e tente novamente.',
      intent,
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

// ─── PART 8 — Memory Learning from conversation ─────────────────────────────── ��� Memory Learning from conversation ���������������������������������������������������������������������������������������������

export async function learnFromConversation(
  userId: string,
  question: string,
  intent: CFOIntent
): Promise<void> {
  const lower = question.toLowerCase();

  if (intent === 'savings_question') {
    await learnMemory(userId, 'user_budget_goal', 'save_money', 0.7);
  }
  if (lower.includes('sal+�rio') || lower.includes('salario')) {
    const match = lower.match(/(\d+)/);
    if (match) await learnMemory(userId, 'mentioned_salary', match[1], 0.6);
  }
  if (lower.includes('mercado') || lower.includes('supermercado')) {
    await learnMemory(userId, 'frequent_merchant', 'mercado', 0.65);
  }
  if (intent === 'spending_advice') {
    await learnMemory(userId, 'asks_before_spending', 'true', 0.8);
  }
}






