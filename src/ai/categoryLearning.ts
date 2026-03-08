/**
 * AI CATEGORY LEARNING — Aprendizado automático de categorias
 *
 * Sistema de aprendizado de máquina para associar merchants a categorias
 * baseado em transações históricas e padrões aprendidos.
 */

import { Transaction } from '../../types';
import { learnMemory, getAIMemory } from './aiMemory';

export interface CategoryLearningEntry {
  merchant: string;
  category: string;
  confidence: number; // 0-1
  occurrences: number;
}

/**
 * Aprende categorias a partir de transações existentes.
 * Salva no AI Memory para uso futuro.
 */
export async function learnCategoryFromTransactions(
  userId: string,
  transactions: Transaction[]
): Promise<void> {
  const merchantCategories: Record<string, { categories: Record<string, number> }> = {};

  // Agregar por merchant
  for (const tx of transactions) {
    if (!tx.merchant || !tx.category) continue;
    const merchant = tx.merchant.toLowerCase().trim();
    if (!merchantCategories[merchant]) {
      merchantCategories[merchant] = { categories: {} };
    }
    merchantCategories[merchant].categories[tx.category] =
      (merchantCategories[merchant].categories[tx.category] || 0) + 1;
  }

  // Salvar no memory
  for (const [merchant, data] of Object.entries(merchantCategories)) {
    const total = Object.values(data.categories).reduce((s, v) => s + v, 0);
    const topCategory = Object.entries(data.categories)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    const confidence = total > 0 ? (data.categories[topCategory] / total) : 0;

    if (confidence > 0.5) { // só salvar se confiança alta
      await learnMemory(userId, `category_${merchant}`, topCategory, confidence);
    }
  }
}

/**
 * Detecta categoria para um merchant baseado no aprendizado.
 */
export async function detectMerchantCategory(
  userId: string,
  merchant: string
): Promise<string | null> {
  const memories = await getAIMemory(userId);
  const key = `category_${merchant.toLowerCase().trim()}`;
  const memory = memories.find(m => m.key === key);
  return memory && memory.confidence > 0.7 ? memory.value : null;
}