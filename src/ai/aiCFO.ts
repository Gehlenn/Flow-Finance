/**
 * Assistente Financeiro IA — Apoio consultivo do Flow Finance
 *
 * Pipeline:
 *   Pergunta do usuário
 *       ↓
 *   analyzeFinancialQuestion  → detecta intent
 *       ↓
 *   buildFinancialContext     → monta contexto dos dados do usuário
 *       ↓
 *   generateCFOResponse       → chama LLM com contexto + pergunta
 *       ↓
 *   AICFOResponse             → exibe para o usuário
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

// ─── PART 2 — Response Model ──────────────────────────────────────────────────

export interface AICFOResponse {
  question: string;
  answer: string;
  context_summary?: string;
  intent?: CFOIntent;
  timestamp: string;
}

// ─── PART 4 — Intent Types ────────────────────────────────────────────────────

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
    keywords: ['saldo', 'disponível', 'caixa hoje', 'quanto tenho', 'quanto sobra', 'caixa confirmado'],
  },
  {
    intent: 'risk_question',
    keywords: ['risco', 'perigo', 'dívida', 'negativo', 'prejudicar', 'alerta', 'problema', 'curto prazo', 'próximos dias'],
  },
  {
    intent: 'receivables_question',
    keywords: ['previsão', 'previsao', 'prever', 'próximos 7 dias', 'proximos 7 dias', 'próximos 30 dias', 'proximos 30 dias', 'entrada prevista', 'saida prevista', 'saída prevista', 'projeção', 'projecao', 'pendência', 'pendencias', 'pendências', 'vencido', 'vencidos', 'recebível', 'recebiveis'],
  },
  {
    intent: 'savings_question',
    keywords: ['economizar', 'poupar', 'guardar', 'reserva', 'poupança', 'reduzir gastos', 'cortar gastos', 'economia'],
  },
  {
    intent: 'monthly_summary',
    keywords: ['resumo do mês', 'fechamento do mês', 'resumo mensal', 'como foi o mês'],
  },
];

export function analyzeFinancialQuestion(question: string): CFOIntent {
  const lower = question.toLowerCase();
  for (const { intent, keywords } of INTENT_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return intent;
  }
  return 'monthly_summary';
}

// ─── PART 3 — Financial Context Builder ──────────────────────────────────────

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

  // Receita e despesa do mês atual
  const now = new Date();
  const currentMonthTxs = baseTxs.filter(t => {
    const d = new Date(t.date);
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
    : '  - Nenhum insight disponível';

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

  // PART 5 — Graph context
  let graphContext = '';
  try {
    const graph = buildFinancialGraph('local', accounts, transactions);
    graphContext = '\n\n' + graphToAIContext(graph, 6);
  } catch (_) { /* graph unavailable */ }

  // AI MEMORY SYSTEM 2.0 — Behavioral context
  let behaviorContext = '';
  try {
    const spendingPatterns = getSpendingPatterns(userId);
    const behaviors = getUserBehaviors(userId);
    const profile = getFinancialProfile(userId);
    const merchants = getMerchantCategories(userId);

    if (spendingPatterns.length > 0 || behaviors.length > 0 || profile) {
      behaviorContext += '\n\n=== PADRÕES COMPORTAMENTAIS APRENDIDOS ===\n';
      
      if (profile) {
        behaviorContext += `\nPERFIL FINANCEIRO: ${profile.profile.toUpperCase()}\n`;
        behaviorContext += `  - Taxa de poupança: ${profile.savingsRate.toFixed(1)}%\n`;
        behaviorContext += `  - Renda média mensal: ${fmt(profile.averageMonthlyIncome)}\n`;
        behaviorContext += `  - Despesas média mensal: ${fmt(profile.averageMonthlyExpenses)}\n`;
      }

      if (spendingPatterns.length > 0) {
        behaviorContext += '\nPADRÕES DE GASTOS:\n';
        spendingPatterns.slice(0, 3).forEach(pattern => {
          behaviorContext += `  - ${pattern.description}\n`;
        });
      }

      if (behaviors.length > 0) {
        behaviorContext += '\nCOMPORTAMENTOS DETECTADOS:\n';
        behaviors.slice(0, 3).forEach(behavior => {
          const behaviorLabels: Record<string, string> = {
            impulsive_spending: 'Gastos impulsivos',
            budget_conscious: 'Consciente do orçamento',
            weekend_spender: 'Gasta mais aos finais de semana',
            online_shopper: 'Comprador online',
          };
          const label = behaviorLabels[behavior.behavior] || behavior.behavior;
          behaviorContext += `  - ${label} (${behavior.score.toFixed(0)}% de confiança)\n`;
        });
      }

      if (merchants.length > 0) {
        behaviorContext += '\nCOMERCIANTES FREQUENTES:\n';
        merchants.slice(0, 3).forEach(merchant => {
          behaviorContext += `  - ${merchant.merchantName}: ${merchant.frequency.toFixed(1)} visitas/mês, ${fmt(merchant.avgAmount)} média\n`;
        });
      }
    }
  } catch (err) {
    console.error('[buildFinancialContext] Erro ao carregar memórias:', err);
  }

  return `
=== DADOS FINANCEIROS DO USUÁRIO ===

CONTAS:
${accountLines}

SALDO CALCULADO: ${fmt(prediction.current_balance)}
SALDO DAS CONTAS: ${fmt(totalAccountBalance)}

MÊS ATUAL:
  - Receitas: ${fmt(monthIncome)}
  - Despesas: ${fmt(monthExpenses)}
  - Resultado: ${fmt(monthIncome - monthExpenses)}

PROJEÇÕES:
  - Em 7 dias: ${fmt(advancedForecast?.in7Days ?? prediction.balance_7_days)}
  - Em 30 dias: ${fmt(advancedForecast?.in30Days ?? prediction.balance_30_days)}
  - Em 90 dias: ${fmt(advancedForecast?.in90Days ?? prediction.balance_30_days)}
  - Receita projetada/mês: ${fmt(prediction.projected_income)}
  - Despesa projetada/mês: ${fmt(prediction.projected_expenses)}

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

TOTAL DE TRANSAÇÕES REGISTRADAS: ${baseTxs.length}${advancedLines ? `\n\n${advancedLines}` : ''}${graphContext}
`.trim();
}

// ─── PART 5 — Response Generation ────────────────────────────────────────────

const SAFETY_PREAMBLE = `
Você é o Assistente Financeiro do Flow Finance.

REGRAS OBRIGATÓRIAS:
1. Nunca faça garantias financeiras absolutas.
2. Responda como apoio consultivo prático de caixa de curto prazo, não como agente autônomo.
3. Seja direto, objetivo e em português brasileiro.
4. Responda em 2 a 4 blocos curtos, com foco operacional.
5. Quando houver risco, avise com clareza mas sem alarmismo.
6. Nunca invente dados — use APENAS o contexto fornecido.
7. Se não houver dados suficientes, diga isso de forma explícita e curta.
8. Diferencie claramente: caixa confirmado, previsto, pendente e vencido.
9. Recebível pendente NÃO é dinheiro disponível.
10. Não proponha automação externa, integrações novas nem ações automáticas fora do produto.
11. Não faça recomendação de investimento e não trate investimento como foco da resposta.
`.trim();

export async function generateCFOResponse(
  question: string,
  context: string,
  intent: CFOIntent
): Promise<AICFOResponse> {
  // note: environment variables / model selection are handled server-side
  const intentGuide: Record<CFOIntent, string> = {
    spending_advice:  'O usuário quer saber se pode gastar agora. Traga impacto no caixa confirmado e risco de curto prazo.',
    cash_position: 'O usuário quer leitura de saldo e caixa disponível. Diferencie confirmado de previsto.',
    risk_question:    'O usuário quer risco de curto prazo. Destaque sinais de atenção sem exagero.',
    savings_question: 'O usuário quer economia prática. Sugira cortes concretos e de curto prazo.',
    monthly_summary:  'O usuário quer resumo do mês com foco em decisão operacional.',
    receivables_question:'O usuário quer leitura de recebíveis, pendências e vencidos. Separe claramente o que está apenas previsto/pendente do que está confirmado.',
  };

  const prompt = `
${SAFETY_PREAMBLE}

CONTEXTO FINANCEIRO:
${context}

TIPO DE PERGUNTA: ${intentGuide[intent]}

PERGUNTA DO USUÁRIO: "${question}"

Responda de forma consultiva, curta e baseada exclusivamente nos dados acima.
`;

  try {
    // proxy the request to backend, which will call GPT‑4 or Gemini as configured
    const gemini = new GeminiService();
    const result = await gemini.generateCFO(question, context, intent);
    return {
      question,
      answer: result.answer || 'Não foi possível gerar uma resposta no momento.',
      context_summary: 'Resposta ancorada em dados reais do workspace quando disponíveis.',
      intent,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      question,
      answer: 'Com base nos seus dados, não consegui processar a consulta agora. Verifique sua conexão e tente novamente.',
      intent,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── PART 8 — Memory Learning from conversation ───────────────────────────────

export async function learnFromConversation(
  userId: string,
  question: string,
  intent: CFOIntent
): Promise<void> {
  const lower = question.toLowerCase();

  if (intent === 'savings_question') {
    await learnMemory(userId, 'user_budget_goal', 'save_money', 0.7);
  }
  if (lower.includes('salário') || lower.includes('salario')) {
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
