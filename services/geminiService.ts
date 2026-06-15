/**
 * AI SERVICE (SECURE PROXY)
 *
 * CRITICAL: This service no longer contains API keys.
 * All requests go through backend proxy for security.
 *
 * Flow:
 *   App → Backend Proxy → OpenAI / Gemini (keys are stored on server)
 */

import { InterpretResponse } from '../types';

import { Transaction, Reminder, TransactionData, TransactionType, Category } from "../types";
import { API_ENDPOINTS, apiRequest } from "../src/config/api.config";
import { logError, logWarn } from "../src/utils/logger";

type DailyInsightLike = {
  title: string;
  description: string;
  type: string;
};

type StrategicReportLike = {
  executiveSummary?: string;
  actionPlan?: string[];
  diagnostic?: {
    kind?: string;
    message?: string;
    suggestion?: string;
  };
  [key: string]: unknown;
};

type DailyInsightsApiResponse = { insights?: DailyInsightLike[] } | DailyInsightLike[];
type StrategicInsightsApiResponse = { report?: StrategicReportLike } | StrategicReportLike;

function isLocalDemoMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('demoData') === '1' || window.localStorage.getItem('flow_demo_data') === '1';
}

function summarizeTransactions(transactions: Transaction[]): { income: number; expenses: number; balance: number; count: number } {
  return transactions.reduce(
    (summary, transaction) => {
      const amount = Math.abs(Number(transaction.amount) || 0);
      if (transaction.type === TransactionType.RECEITA) {
        summary.income += amount;
      } else {
        summary.expenses += amount;
      }
      summary.balance = summary.income - summary.expenses;
      summary.count += 1;
      return summary;
    },
    { income: 0, expenses: 0, balance: 0, count: 0 },
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

type CfoContextSummary = {
  confirmedCash?: string;
  forecast30Days?: string;
  monthResult?: string;
  dataQuality?: string;
};

function extractContextValue(context: string, label: string): string | undefined {
  const matchedLine = context.split('\n').find(line => line.trim().startsWith(`${label}:`));
  if (!matchedLine) return undefined;
  return matchedLine.split(':').slice(1).join(':').trim();
}

function extractCfoContextSummary(context: string): CfoContextSummary {
  return {
    confirmedCash: extractContextValue(context, 'Confirmado (disponivel hoje)'),
    forecast30Days: extractContextValue(context, 'Em 30 dias'),
    monthResult: extractContextValue(context, '- Resultado'),
    dataQuality: extractContextValue(context, 'QUALIDADE DOS DADOS (merchant coverage)'),
  };
}

function buildCfoBaseSummary(summary: CfoContextSummary): string {
  const parts: string[] = [];

  if (summary.confirmedCash) {
    parts.push(`caixa confirmado ${summary.confirmedCash}`);
  }

  if (summary.forecast30Days) {
    parts.push(`previsao 30 dias ${summary.forecast30Days}`);
  }

  if (summary.monthResult) {
    parts.push(`resultado do mes ${summary.monthResult}`);
  }

  if (summary.dataQuality) {
    parts.push(`qualidade do dado ${summary.dataQuality}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'dados locais da demonstracao';
}

function buildLocalStrategicReport(transactions: Transaction[], reason = 'demo-local'): StrategicReportLike {
  const summary = summarizeTransactions(transactions);
  const runwaySignal = summary.balance >= 0
    ? `O recorte mostra saldo operacional positivo de ${formatBRL(summary.balance)}.`
    : `O recorte mostra pressao de caixa de ${formatBRL(Math.abs(summary.balance))}.`;
  const expenseRatio = summary.income > 0 ? summary.expenses / summary.income : 0;
  const attention = expenseRatio > 0.55
    ? 'As saidas ja consomem uma parte relevante das entradas; revise despesas recorrentes antes de assumir novos compromissos.'
    : 'As saidas estao sob controle neste recorte; priorize recebiveis pendentes e previsibilidade.';

  return {
    executiveSummary: `${runwaySignal} ${attention}`,
    actionPlan: [
      'Confirmar recebiveis pendentes antes de tratar previsao como caixa disponivel.',
      'Revisar despesas recorrentes e separar o que e operacao essencial do que pode esperar.',
      'Manter uma proxima acao por cliente/recebivel para reduzir atraso e incerteza.',
    ],
    diagnostic: {
      kind: reason,
      message: 'Diagnostico local gerado sem depender do backend de IA.',
      suggestion: 'Use esta leitura para demonstracao; em producao, valide com o endpoint de IA autenticado.',
    },
  };
}

export function buildLocalCFOAnswer(question: string, context: string, intent: string): string {
  const normalizedQuestion = normalizeInput(question);
  const asksRisk = intent === 'risk_question' || /risco|perigo|atras/.test(normalizedQuestion);
  const asksCash = intent === 'cash_position' || /caixa|saldo|posicao/.test(normalizedQuestion);
  const asksReceivables = intent === 'receivables_question' || /receber|recebivel|pendente|vencido/.test(normalizedQuestion);
  const summary = extractCfoContextSummary(context);
  const baseSummary = buildCfoBaseSummary(summary);

  if (asksReceivables) {
    return [
      `Leitura demo: pendencias ainda nao contam como ${summary.confirmedCash ? `caixa confirmado de ${summary.confirmedCash}` : 'caixa confirmado'}.`,
      'Risco: confundir previsao com dinheiro disponivel pode apertar o caixa.',
      'Proxima acao: cobre o vencido primeiro e valide a data do proximo recebimento.',
      `Base resumida: ${baseSummary}.`,
    ].join('\n\n');
  }

  if (asksRisk) {
    return [
      `Leitura demo: o risco esta na distancia entre ${summary.confirmedCash ? `caixa confirmado de ${summary.confirmedCash}` : 'caixa confirmado'} e ${summary.forecast30Days ? `previsao de ${summary.forecast30Days} em 30 dias` : 'previsao de 30 dias'}.`,
      'Risco: se a entrada atrasar, segure gastos nao essenciais.',
      'Proxima acao: confirme os recebiveis antes de liberar nova despesa.',
      `Base resumida: ${baseSummary}.`,
    ].join('\n\n');
  }

  if (asksCash) {
    return [
      `Leitura demo: caixa confirmado de ${summary.confirmedCash ?? 'indisponivel'} e previsao de ${summary.forecast30Days ?? 'indisponivel'} em 30 dias.`,
      'Risco: a previsao ajuda, mas nao substitui o caixa confirmado.',
      'Proxima acao: confirme entradas e segure compromissos novos ate o caixa ficar claro.',
      `Base resumida: ${baseSummary}.`,
    ].join('\n\n');
  }

  return [
    `Leitura demo: caixa confirmado de ${summary.confirmedCash ?? 'indisponivel'} e previsao de ${summary.forecast30Days ?? 'indisponivel'} em 30 dias.`,
    'Risco: a previsao so ajuda quando os recebiveis de curto prazo estiverem claros.',
    'Proxima acao: confirme entradas, corte saidas dispensaveis e avance com prudencia.',
    `Base resumida: ${baseSummary}.`,
  ].join('\n\n');
}

function normalizeInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseCurrencyAmount(raw: string): number | null {
  const directCurrency = raw.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/i);
  if (!directCurrency?.[1]) {
    return null;
  }

  const normalized = directCurrency[1]
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferCategory(normalizedText: string): Category {
  if (/(salario|salario|cliente|consulta|freela|trabalho)/.test(normalizedText)) {
    return Category.CONSULTORIO;
  }
  if (/(marketing|empresa|negocio|negocio|fornecedor)/.test(normalizedText)) {
    return Category.NEGOCIO;
  }
  if (/(cdb|acoes|acao|invest|aporte)/.test(normalizedText)) {
    return Category.INVESTIMENTO;
  }
  return Category.PESSOAL;
}

function buildReminderFallback(rawText: string): InterpretResponse {
  const amount = parseCurrencyAmount(rawText) ?? undefined;
  const dateMatch = rawText.match(/\bdia\s+(\d{1,2})\b/i);
  let reminderDate: string | undefined;

  if (dateMatch?.[1]) {
    const day = Number.parseInt(dateMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0, 0);
      if (next.getTime() < now.getTime()) {
        next.setMonth(next.getMonth() + 1);
      }
      reminderDate = next.toISOString();
    }
  }

  return {
    intent: 'reminder',
    data: [{
      title: rawText.trim(),
      date: reminderDate,
      type: 'pessoal',
      amount,
      priority: 'média',
    }],
  };
}

export function buildSmartInputFallback(text: string): InterpretResponse {
  const trimmed = text.trim();
  if (!trimmed) {
    return { intent: 'transaction', data: [] };
  }

  const normalizedText = normalizeInput(trimmed);
  const looksLikeReminder = /(lembrar|lembrete|venc|vencer|pagar|boleto|conta)/.test(normalizedText)
    && !/(recebi|ganhei|gastei|comprei|vendi)/.test(normalizedText);

  if (looksLikeReminder) {
    return buildReminderFallback(trimmed);
  }

  const amount = parseCurrencyAmount(trimmed);
  if (amount === null) {
    return { intent: 'transaction', data: [] };
  }

  const isIncome = /(recebi|ganhei|entrou|vendi|faturei|deposito|salario)/.test(normalizedText);

  const transaction: TransactionData = {
    amount,
    description: trimmed,
    category: inferCategory(normalizedText),
    type: isIncome ? TransactionType.RECEITA : TransactionType.DESPESA,
  };

  return {
    intent: 'transaction',
    data: [transaction],
  };
}

export class GeminiService {
  /**
   * Process smart input text to extract transactions or reminders
   * Backend handles schema validation and Gemini API call
   */
  async processSmartInput(text: string): Promise<InterpretResponse> {
    try {
      return await apiRequest(
        API_ENDPOINTS.AI.INTERPRET,
        {
          method: 'POST',
          retries: 0,
          silent: true,
          body: JSON.stringify({
            text,
            // Include memory context if available
            memoryContext: this.extractMemoryContext(text),
          }),
        }
      );
    } catch (error) {
      logWarn('[AIService] processSmartInput unavailable, using deterministic fallback', error, {
        fallback: 'ai-process-smart-input-fallback',
      });
      return buildSmartInputFallback(text);
    }
  }

  /**
   * Parse financial document images (receipts, invoices, etc.)
   * Backend handles image analysis via Gemini
   */
  async parseFinancialImage(base64: string, mimeType: string, text?: string): Promise<TransactionData[]> {
    try {
      const response = await apiRequest<Record<string, unknown> | TransactionData[]>(
        API_ENDPOINTS.AI.SCAN_RECEIPT,
        {
          method: 'POST',
          body: JSON.stringify({
            imageBase64: base64,
            imageMimeType: mimeType,
            context: text,
          }),
        }
      );

      if (Array.isArray(response)) {
        return response;
      }

      const normalized: TransactionData = {
        amount: typeof response.amount === 'number' ? response.amount : 0,
        description: typeof response.description === 'string' ? response.description : 'Recibo escaneado',
        category: Object.values(Category).includes(response.category as Category)
          ? (response.category as Category)
          : Category.PESSOAL,
        type: response.type === TransactionType.RECEITA
          ? TransactionType.RECEITA
          : TransactionType.DESPESA,
      };

      return [normalized];
    } catch (error) {
      logError('[AIService] parseFinancialImage failed', error, {
        fallback: 'ai-parse-financial-image-failed',
      });
      return [];
    }
  }

  /**
   * Generate daily insights about transactions
   * Backend handles LLM call and analysis
   */
  async generateDailyInsights(transactions: Transaction[]): Promise<DailyInsightLike[]> {
    try {
      const response = await apiRequest<DailyInsightsApiResponse>(
        API_ENDPOINTS.AI.GENERATE_INSIGHTS,
        {
          method: 'POST',
          retries: 0,
          silent: true,
          body: JSON.stringify({
            transactions,
            type: 'daily',
          }),
        }
      );

      return Array.isArray(response) ? response : (response.insights || []);
    } catch (error) {
      logWarn('[AIService] generateDailyInsights unavailable, using empty fallback', error, {
        fallback: 'ai-generate-daily-insights-fallback',
      });
      return [];
    }
  }

  /**
   * Classify transactions into categories using AI
   * Backend handles classification logic
   */
  async classifyTransactions(transactions: Partial<Transaction>[]): Promise<Transaction[]> {
    try {
      return await apiRequest(
        API_ENDPOINTS.AI.CLASSIFY_TRANSACTIONS,
        {
          method: 'POST',
          body: JSON.stringify({ transactions }),
        }
      );
    } catch (error) {
      logError('[AIService] classifyTransactions failed', error, {
        fallback: 'ai-classify-transactions-failed',
      });
      return [];
    }
  }

  /**
   * Generate strategic financial report
   * Backend handles detailed analysis
   */
  async generateStrategicReport(transactions: Transaction[]): Promise<StrategicReportLike | null> {
    if (isLocalDemoMode()) {
      return buildLocalStrategicReport(transactions);
    }

    try {
      const response = await apiRequest<StrategicInsightsApiResponse>(
        API_ENDPOINTS.AI.GENERATE_INSIGHTS,
        {
          method: 'POST',
          retries: 0,
          silent: true,
          body: JSON.stringify({
            transactions,
            type: 'strategic',
          }),
        }
      );

      if (Array.isArray(response)) {
        return (response[0] as StrategicReportLike | undefined) ?? buildLocalStrategicReport(transactions, 'strategic-empty');
      }

      if ('report' in response) {
        return (response.report as StrategicReportLike | undefined) ?? buildLocalStrategicReport(transactions, 'strategic-empty');
      }

      return response as StrategicReportLike;
    } catch (error) {
      logWarn('[AIService] generateStrategicReport unavailable, using null fallback', error, {
        fallback: 'ai-generate-strategic-report-fallback',
      });
      return buildLocalStrategicReport(transactions, 'ai_unavailable');
    }
  }

  /**
   * Count tokens for a given text to estimate API costs
   * Backend handles token counting
   */
  async countTokens(text: string): Promise<number> {
    try {
      const result = await apiRequest<{ tokenCount: number }>(
        API_ENDPOINTS.AI.CREDIT_TOKEN_COUNT,
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        }
      );
      return result.tokenCount;
    } catch (error) {
      logError('[AIService] countTokens failed', error, {
        fallback: 'ai-count-tokens-failed',
      });
      return 0;
    }
  }

  /**
   * Convenience helper used by Analytics component.  Calls daily insights
   * and converts the LLM output into the frontend's InsightTip shape.
   */
  async generateFinancialConsultancy(transactions: Transaction[]): Promise<
    { title: string; description: string; type: 'economy' | 'investment' | 'habit' | 'alert' }[]
  > {
    try {
      const daily: DailyInsightLike[] = await this.generateDailyInsights(transactions);
      return daily.map(ins => {
        let t: 'economy' | 'investment' | 'habit' | 'alert' = 'economy';
        if (ins.type === 'alerta') t = 'alert';
        else if (ins.title.toLowerCase().includes('invest')) t = 'investment';
        else if (ins.title.toLowerCase().includes('hábito') || ins.title.toLowerCase().includes('hábitos')) t = 'habit';
        return { title: ins.title, description: ins.description, type: t };
      });
    } catch (error) {
      logError('[AIService] generateFinancialConsultancy failed', error, {
        fallback: 'ai-generate-financial-consultancy-failed',
      });
      return [];
    }
  }

  // ─── CFO helper ──────────────────────────────────────────────────────────
  async generateCFO(question: string, context: string, intent: string): Promise<{ answer: string }> {
    if (isLocalDemoMode()) {
      return { answer: buildLocalCFOAnswer(question, context, intent) };
    }

    try {
      return await apiRequest(
        API_ENDPOINTS.AI.CFO,
        {
          method: 'POST',
          body: JSON.stringify({ question, context, intent }),
        }
      );
    } catch (error) {
      logError('[AIService] generateCFO failed', error, {
        fallback: 'ai-generate-cfo-failed',
      });
      return { answer: buildLocalCFOAnswer(question, context, intent) };
    }
  }

  // ─── Private Helper Methods ────────────────────────────────────────────────

  private extractMemoryContext(text: string): string {
    // Extract any memory markers from prompt
    const memoryMatch = text.match(/\[CONTEXTO DO USUÁRIO(.*?)\]/s);
    return memoryMatch ? memoryMatch[1] : '';
  }
}
