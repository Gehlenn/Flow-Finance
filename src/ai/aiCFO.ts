/**
 * AI CFO — Consultor Financeiro Virtual do Flow Finance
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
  | 'budget_question'
  | 'risk_question'
  | 'savings_question'
  | 'investment_question'
  | 'general_finance';

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
    intent: 'budget_question',
    keywords: ['orçamento', 'limite', 'quanto tenho', 'quanto sobra', 'budget', 'saldo', 'disponível'],
  },
  {
    intent: 'risk_question',
    keywords: ['risco', 'perigo', 'dívida', 'negativo', 'prejudicar', 'alerta', 'problema'],
  },
  {
    intent: 'savings_question',
    keywords: ['economizar', 'poupar', 'guardar', 'reserva', 'poupança', 'meta', 'objetivo'],
  },
  {
    intent: 'investment_question',
    keywords: ['investir', 'aplicar', 'rendimento', 'cdb', 'ações', 'tesouro', 'retorno'],
  },
];

export function analyzeFinancialQuestion(question: string): CFOIntent {
  const lower = question.toLowerCase();
  for (const { intent, keywords } of INTENT_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return intent;
  }
  return 'general_finance';
}

// ─── PART 3 — Financial Context Builder ──────────────────────────────────────

export function buildFinancialContext(
  accounts: Account[],
  transactions: Transaction[],
  prediction: CashflowPrediction,
  insights: AIInsight[]
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

  // PART 5 — Graph context
  let graphContext = '';
  try {
    const graph = buildFinancialGraph('local', accounts, transactions);
    graphContext = '\n\n' + graphToAIContext(graph, 6);
  } catch (_) { /* graph unavailable */ }

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
  - Em 7 dias: ${fmt(prediction.balance_7_days)}
  - Em 30 dias: ${fmt(prediction.balance_30_days)}
  - Receita projetada/mês: ${fmt(prediction.projected_income)}
  - Despesa projetada/mês: ${fmt(prediction.projected_expenses)}

MAIOR CATEGORIA DE GASTOS:
  - ${topCat ? `${topCat[0]}: ${fmt(topCat[1])}` : 'Sem dados'}

INSIGHTS RECENTES:
${insightLines}

TOTAL DE TRANSAÇÕES REGISTRADAS: ${baseTxs.length}${graphContext}
`.trim();
}

// ─── PART 5 — Response Generation ────────────────────────────────────────────

const SAFETY_PREAMBLE = `
Você é o CFO Virtual do Flow Finance, um assistente financeiro pessoal.

REGRAS OBRIGATÓRIAS:
1. Nunca faça garantias financeiras absolutas.
2. Use sempre linguagem consultiva: "Com base nos seus dados...", "A análise sugere...", "Considerando seu histórico..."
3. Seja direto, objetivo e em português brasileiro.
4. Respostas com no máximo 4 parágrafos curtos.
5. Quando houver risco, avise com clareza mas sem alarmismo.
6. Nunca invente dados — use APENAS o contexto fornecido.
7. Se não houver dados suficientes, diga isso claramente.
`.trim();

export async function generateCFOResponse(
  question: string,
  context: string,
  intent: CFOIntent
): Promise<AICFOResponse> {
  // note: environment variables / model selection are handled server-side
  const intentGuide: Record<CFOIntent, string> = {
    spending_advice:     'O usuário quer saber se pode gastar. Analise o impacto no saldo projetado.',
    budget_question:     'O usuário quer entender seu orçamento. Foque nos números do mês atual e projeções.',
    risk_question:       'O usuário está preocupado com riscos. Destaque alertas e pontos de atenção.',
    savings_question:    'O usuário quer economizar. Sugira cortes com base nas categorias dominantes.',
    investment_question: 'O usuário quer investir. Avalie o saldo disponível antes de fazer sugestões.',
    general_finance:     'Responda a pergunta financeira com base nos dados disponíveis.',
  };

  const prompt = `
${SAFETY_PREAMBLE}

CONTEXTO FINANCEIRO:
${context}

TIPO DE PERGUNTA: ${intentGuide[intent]}

PERGUNTA DO USUÁRIO: "${question}"

Responda de forma consultiva, personalizada e baseada exclusivamente nos dados acima.
`;

  try {
    // proxy the request to backend, which will call GPT‑4 or Gemini as configured
    const gemini = new GeminiService();
    const result = await gemini.generateCFO(question, context, intent);
    return {
      question,
      answer: result.answer || 'Não foi possível gerar uma resposta no momento.',
      context_summary: `Saldo projetado usado como base.`,
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
  if (intent === 'investment_question') {
    await learnMemory(userId, 'user_budget_goal', 'invest_money', 0.7);
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
