import { learnMemory } from '../../../ai/aiMemory';
import type { FinanceCategory } from './transactionCategorizer';
import { normalizeToFinanceCategory } from '../../../services/ai/categorizationSchema';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export interface AICategorizeTransactionOptions {
  suggestCategory?: (tx: Record<string, unknown>) => Promise<string | null | undefined>;
}

/**
 * Fallback assíncrono para categorização quando regra não detecta categoria.
 */
export async function aiCategorizeTransaction(
  tx: Record<string, unknown>,
  options: AICategorizeTransactionOptions = {},
): Promise<FinanceCategory> {
  const suggested = options.suggestCategory
    ? await options.suggestCategory(tx)
    : null;

  return normalizeToFinanceCategory(String(suggested ?? '')) as FinanceCategory;
}

/**
 * Persistência de aprendizado por merchant após confirmação do usuário.
 */
export async function saveMerchantCategoryLearning(
  userId: string,
  merchant: string,
  category: string,
  confidence = 0.95,
): Promise<void> {
  const cleanMerchant = normalize(merchant);
  const normalizedCategory = normalize(category);
  if (!cleanMerchant || normalizedCategory === 'outros') return;

  await learnMemory(
    userId,
    `merchant_category:${cleanMerchant.slice(0, 32)}`,
    JSON.stringify({ merchant: cleanMerchant, category: normalizedCategory }),
    confidence,
  );
}
