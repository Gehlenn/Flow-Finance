import { type Account } from '../../models/Account';
import { type Transaction, TransactionType } from '../../types';
import { type AIInsight } from './insightGenerator';
import { type CashflowPrediction } from './riskAnalyzer';
import { buildFinancialGraph, graphToAIContext } from './financialGraph';
import { getFinancialProfile, getMerchantCategories, getSpendingPatterns, getUserBehaviors } from './memory';
import { logWarn } from '../utils/logger';
import { type ProductFinancialIntelligence } from '../app/productFinancialIntelligence';
import { type AICFOConfidenceBand, type AICFOExplainability, type CFOIntent } from './aiCFOTypes';

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
    keywords: ['saldo', 'disponivel', 'caixa hoje', 'quanto tenho', 'quanto sobra', 'caixa confirmado'],
  },
  {
    intent: 'risk_question',
    keywords: ['risco', 'perigo', 'divida', 'negativo', 'prejudicar', 'alerta', 'problema', 'curto prazo', 'proximos dias'],
  },
  {
    intent: 'receivables_question',
    keywords: ['previsao', 'prever', 'proximos 7 dias', 'proximos 30 dias', 'entrada prevista', 'saida prevista', 'saida prevista', 'projecao', 'projecao', 'pendencia', 'pendencias', 'pendencias', 'vencido', 'vencidos', 'recebivel', 'recebiveis'],
  },
  {
    intent: 'savings_question',
    keywords: ['economizar', 'poupar', 'guardar', 'reserva', 'poupanca', 'reduzir gastos', 'cortar gastos', 'economia'],
  },
  {
    intent: 'monthly_summary',
    keywords: ['resumo do mes', 'fechamento do mes', 'resumo mensal', 'como foi o mes'],
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function analyzeFinancialQuestion(question: string): CFOIntent {
  const lower = question.toLowerCase();
  for (const { intent, keywords } of INTENT_PATTERNS) {
    if (keywords.some(keyword => lower.includes(keyword))) return intent;
  }
  return 'monthly_summary';
}

export function buildFinancialContext(
  accounts: Account[],
  transactions: Transaction[],
  prediction: CashflowPrediction,
  insights: AIInsight[],
  userId: string = 'local',
  intelligence?: ProductFinancialIntelligence,
): string {
  const fmt = formatCurrency;
  const baseTxs = transactions.filter(transaction => !transaction.generated);
  const totalAccountBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  const categoryTotals: Record<string, number> = {};
  for (const transaction of baseTxs.filter(item => item.type === TransactionType.DESPESA)) {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] ?? 0) + transaction.amount;
  }
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  const now = new Date();
  const currentMonthTxs = baseTxs.filter(transaction => {
    const date = parseCfoDate(transaction.date);
    if (!date) return false;
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const monthIncome = currentMonthTxs
    .filter(transaction => transaction.type === TransactionType.RECEITA)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthExpenses = currentMonthTxs
    .filter(transaction => transaction.type === TransactionType.DESPESA)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const accountLines = accounts.length > 0
    ? accounts.map(account => `  - ${account.name} (${account.type}): ${fmt(account.balance)}`).join('\n')
    : '  - Nenhuma conta cadastrada';

  const insightLines = insights.length > 0
    ? insights.slice(0, 3).map(insight => `  - [${insight.type}] ${insight.message}`).join('\n')
    : '  - Nenhum insight disponivel';

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

  let graphContext = '';
  try {
    const graph = buildFinancialGraph('local', accounts, transactions);
    graphContext = '\n\n' + graphToAIContext(graph, 6);
  } catch (error) {
    logWarn('[buildFinancialContext] Graph context unavailable; continuing without graph enrichment', {
      userId,
      error,
    });
  }

  let behaviorContext = '';
  try {
    const spendingPatterns = getSpendingPatterns(userId);
    const behaviors = getUserBehaviors(userId);
    const profile = getFinancialProfile(userId);
    const merchants = getMerchantCategories(userId);

    if (spendingPatterns.length > 0 || behaviors.length > 0 || profile) {
      behaviorContext += '\n\n=== PADROES COMPORTAMENTAIS APRENDIDOS ===\n';

      if (profile) {
        behaviorContext += `\nPERFIL FINANCEIRO: ${profile.profile.toUpperCase()}\n`;
        behaviorContext += `  - Taxa de poupanca: ${profile.savingsRate.toFixed(1)}%\n`;
        behaviorContext += `  - Renda media mensal: ${fmt(profile.averageMonthlyIncome)}\n`;
        behaviorContext += `  - Despesas media mensal: ${fmt(profile.averageMonthlyExpenses)}\n`;
      }

      if (spendingPatterns.length > 0) {
        behaviorContext += '\nPADROES DE GASTOS:\n';
        spendingPatterns.slice(0, 3).forEach(pattern => {
          behaviorContext += `  - ${pattern.description}\n`;
        });
      }

      if (behaviors.length > 0) {
        behaviorContext += '\nCOMPORTAMENTOS DETECTADOS:\n';
        behaviors.slice(0, 3).forEach(behavior => {
          const behaviorLabels: Record<string, string> = {
            impulsive_spending: 'Gastos impulsivos',
            budget_conscious: 'Consciente do orcamento',
            weekend_spender: 'Gasta mais aos finais de semana',
            online_shopper: 'Comprador online',
          };
          const label = behaviorLabels[behavior.behavior] || behavior.behavior;
          behaviorContext += `  - ${label} (${behavior.score.toFixed(0)}% de confianca)\n`;
        });
      }

      if (merchants.length > 0) {
        behaviorContext += '\nCOMERCIANTES FREQUENTES:\n';
        merchants.slice(0, 3).forEach(merchant => {
          behaviorContext += `  - ${merchant.merchantName}: ${merchant.frequency.toFixed(1)} visitas/mes, ${fmt(merchant.avgAmount)} media\n`;
        });
      }
    }
  } catch (error) {
    logWarn('[buildFinancialContext] Failed to load AI memories; continuing without behavioral context', {
      userId,
      error,
    });
  }

  return `
=== DADOS FINANCEIROS DO USUARIO ===

CONTAS:
${accountLines}

CAIXA OPERACIONAL CALCULADO: ${fmt(prediction.current_balance)}
SALDO DAS CONTAS: ${fmt(totalAccountBalance)}

MES ATUAL:
  - Receitas: ${fmt(monthIncome)}
  - Despesas: ${fmt(monthExpenses)}
  - Resultado: ${fmt(monthIncome - monthExpenses)}

PROJECOES:
  - Em 7 dias: ${fmt(advancedForecast?.in7Days ?? prediction.balance_7_days)}
  - Em 30 dias: ${fmt(advancedForecast?.in30Days ?? prediction.balance_30_days)}
  - Em 90 dias: ${fmt(advancedForecast?.in90Days ?? prediction.balance_30_days)}
  - Receita projetada/mes: ${fmt(prediction.projected_income)}
  - Despesa projetada/mes: ${fmt(prediction.projected_expenses)}

MAIOR CATEGORIA DE GASTOS:
  - ${topCategory ? `${topCategory[0]}: ${fmt(topCategory[1])}` : 'Sem dados'}

INSIGHTS RECENTES:
${insightLines}

CLASSIFICACAO DE CAIXA:
  - Confirmado (disponivel hoje): ${fmt(totalAccountBalance)}
  - Previsto (30 dias): ${fmt(forecast30Days)}
  - Pendente (a confirmar): ${pendingAndOverdueAvailable ? 'Disponivel no contexto' : 'Sem base suficiente no contexto atual'}
  - Vencido (atrasado): ${pendingAndOverdueAvailable ? 'Disponivel no contexto' : 'Sem base suficiente no contexto atual'}

REGRA OPERACIONAL:
  - Nunca considerar pendente como dinheiro disponivel.

TOTAL DE TRANSACOES REGISTRADAS: ${baseTxs.length}${advancedLines ? `\n\n${advancedLines}` : ''}${graphContext}${behaviorContext}
`.trim();
}

function extractContextValue(context: string, label: string): string | undefined {
  const matchedLine = context.split('\n').find(line => line.trim().startsWith(`${label}:`));
  if (!matchedLine) return undefined;
  return matchedLine.split(':').slice(1).join(':').trim();
}

export function buildCFOResponseDepth(explainability: AICFOExplainability): 'standard' | 'reduced' {
  return explainability.evidence.base_sufficiency === 'strong' && explainability.confidence_band !== 'low'
    ? 'standard'
    : 'reduced';
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
  const totalTransactions = Number((context.match(/TOTAL DE TRANSACOES REGISTRADAS:\s*(\d+)/i) || [])[1] || 0);

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
