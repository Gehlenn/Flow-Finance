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

type DailyInsightsApiResponse = { insights?: any[] } | any[];
type StrategicInsightsApiResponse = { report?: any } | any;

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
      console.warn('[AIService] processSmartInput unavailable, using deterministic fallback');
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
      console.error('[AIService] parseFinancialImage failed:', error);
      return [];
    }
  }

  /**
   * Generate daily insights about transactions
   * Backend handles LLM call and analysis
   */
  async generateDailyInsights(transactions: Transaction[]): Promise<any[]> {
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
      console.warn('[AIService] generateDailyInsights unavailable, using empty fallback');
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
      console.error('[AIService] classifyTransactions failed:', error);
      return [];
    }
  }

  /**
   * Generate strategic financial report
   * Backend handles detailed analysis
   */
  async generateStrategicReport(transactions: Transaction[]): Promise<any> {
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

      return Array.isArray(response) ? response : (response.report ?? response);
    } catch (error) {
      console.warn('[AIService] generateStrategicReport unavailable, using null fallback');
      return null;
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
      console.error('[AIService] countTokens failed:', error);
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
      const daily: any[] = await this.generateDailyInsights(transactions);
      return daily.map(ins => {
        let t: 'economy' | 'investment' | 'habit' | 'alert' = 'economy';
        if (ins.type === 'alerta') t = 'alert';
        else if (ins.title.toLowerCase().includes('invest')) t = 'investment';
        else if (ins.title.toLowerCase().includes('hábito') || ins.title.toLowerCase().includes('hábitos')) t = 'habit';
        return { title: ins.title, description: ins.description, type: t };
      });
    } catch (error) {
      console.error('[AIService] generateFinancialConsultancy failed:', error);
      return [];
    }
  }

  // ─── CFO helper ──────────────────────────────────────────────────────────
  async generateCFO(question: string, context: string, intent: string): Promise<{ answer: string }> {
    try {
      return await apiRequest(
        API_ENDPOINTS.AI.CFO,
        {
          method: 'POST',
          body: JSON.stringify({ question, context, intent }),
        }
      );
    } catch (error) {
      console.error('[AIService] generateCFO failed:', error);
      return { answer: '' };
    }
  }

  // ─── Private Helper Methods ────────────────────────────────────────────────

  private extractMemoryContext(text: string): string {
    // Extract any memory markers from prompt
    const memoryMatch = text.match(/\[CONTEXTO DO USUÁRIO(.*?)\]/s);
    return memoryMatch ? memoryMatch[1] : '';
  }
}
