/**
 * Serviço de categorização automática por IA ao editar transação
 * Roadmap: v0.8.x
 *
 * - Sugere categoria com base em merchant, descrição e histórico
 * - Integra com pipeline de edição de transação
 * - Permite desfazer sugestão
 */

import { Transaction, CategoryType } from '../../../shared/types';

export interface CategorizationSuggestion {
  categoria: CategoryType | string;
  confidence: number;
  rationale?: string;
  erro?: string;
}

export async function sugerirCategoriaIA(transacao: Partial<Transaction>): Promise<CategorizationSuggestion> {
  // TODO: Integrar modelo IA (OpenAI, Gemini, etc)
  return {
    categoria: 'Indefinida',
    confidence: 0,
    rationale: '',
    erro: 'Sugestão IA não implementada'
  };
}
