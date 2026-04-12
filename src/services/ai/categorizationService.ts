import { Category, Transaction, TransactionType } from '../../../types';
import { apiRequest, API_ENDPOINTS } from '../../config/api.config';
import {
  buildCanonicalCategorizationResult,
  type CanonicalCategorizationResult,
} from './categorizationSchema';

export interface CategorizationSuggestion {
  categoria: Category | 'Indefinida';
  confidence: number;
  rationale?: string;
  erro?: string;
}

export interface CategorizationInput {
  description: string;
  amount?: number;
  date?: string;
  merchant?: string;
  type?: TransactionType;
}

interface BackendClassificationResponse {
  category: string;
  type: string;
  confidence?: number;
}

export async function classifyTransactionsWithAI(
  transactions: CategorizationInput[],
): Promise<CanonicalCategorizationResult[]> {
  if (transactions.length === 0) return [];

  try {
    const response = await apiRequest<BackendClassificationResponse[]>(
      API_ENDPOINTS.AI.CLASSIFY_TRANSACTIONS,
      {
        method: 'POST',
        body: JSON.stringify({
          transactions: transactions.map((transaction) => ({
            description: transaction.description,
            amount: transaction.amount ?? 0,
            date: transaction.date ?? new Date().toISOString(),
          })),
        }),
        timeout: 4000,
        retries: 0,
        silent: true,
      },
    );

    return transactions.map((transaction, index) => {
      const item = response[index];
      return buildCanonicalCategorizationResult({
        category: item?.category,
        confidence: item?.confidence ?? 0.5,
        type: item?.type ?? transaction.type,
        source: 'ai',
      });
    });
  } catch (error) {
    return transactions.map((transaction) =>
      buildCanonicalCategorizationResult({
        category: transaction.type === TransactionType.RECEITA ? Category.NEGOCIO : Category.PESSOAL,
        confidence: 0.3,
        type: transaction.type,
        source: 'fallback',
        erro: error instanceof Error ? error.message : 'classification_failed',
      }),
    );
  }
}

export async function sugerirCategoriaIA(transacao: Partial<Transaction>): Promise<CategorizationSuggestion> {
  if (!transacao.description?.trim()) {
    return {
      categoria: 'Indefinida',
      confidence: 0,
      erro: 'Descricao obrigatoria para sugestao',
    };
  }

  const [result] = await classifyTransactionsWithAI([
    {
      description: transacao.description,
      merchant: transacao.merchant,
      amount: transacao.amount,
      date: transacao.date,
      type: transacao.type,
    },
  ]);

  return {
    categoria: result?.category ?? 'Indefinida',
    confidence: result?.confidence ?? 0,
    rationale: result?.rationale,
    erro: result?.erro,
  };
}
