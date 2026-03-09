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

import { Transaction, Reminder } from "../types";
import { API_ENDPOINTS, apiRequest } from "../src/config/api.config";

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
          body: JSON.stringify({
            text,
            // Include memory context if available
            memoryContext: this.extractMemoryContext(text),
          }),
        }
      );
    } catch (error) {
      console.error('[AIService] processSmartInput failed:', error);
      // Return empty result instead of crashing
      return { intent: 'transaction', data: [] };
    }
  }

  /**
   * Parse financial document images (receipts, invoices, etc.)
   * Backend handles image analysis via Gemini
   */
  async parseFinancialImage(base64: string, mimeType: string, text?: string): Promise<any[]> {
    try {
      return await apiRequest(
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
      return await apiRequest(
        API_ENDPOINTS.AI.GENERATE_INSIGHTS,
        {
          method: 'POST',
          body: JSON.stringify({
            transactions,
            type: 'daily',
          }),
        }
      );
    } catch (error) {
      console.error('[AIService] generateDailyInsights failed:', error);
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
      return await apiRequest(
        API_ENDPOINTS.AI.GENERATE_INSIGHTS,
        {
          method: 'POST',
          body: JSON.stringify({
            transactions,
            type: 'strategic',
          }),
        }
      );
    } catch (error) {
      console.error('[AIService] generateStrategicReport failed:', error);
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
