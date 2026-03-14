import { categorizationRules } from './categorizationRules';
import { aiCategorizeTransaction, saveMerchantCategoryLearning } from './aiCategorizerFallback';

export type FinanceCategory =
  | 'transporte'
  | 'alimentacao'
  | 'assinaturas'
  | 'moradia'
  | 'saude'
  | 'combustivel'
  | 'educacao'
  | 'lazer'
  | 'salario'
  | 'outros';

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function categorizeTransaction(description = '', merchant = ''): FinanceCategory {
  const desc = normalize(`${description} ${merchant}`);

  for (const key of Object.keys(categorizationRules)) {
    if (desc.includes(key)) {
      return categorizationRules[key];
    }
  }

  return 'outros';
}

export interface AICategorizeOptions {
  userId?: string;
  aiFallback?: (description: string, merchant?: string) => Promise<string | null | undefined>;
  merchant?: string;
}

/**
 * Camada 4: usa regra simples primeiro; se falhar, tenta fallback IA.
 * Quando IA acerta, persiste em memória para aprendizado incremental.
 */
export async function categorizeTransactionWithAI(
  description: string,
  options: AICategorizeOptions = {},
): Promise<FinanceCategory> {
  const fromRule = categorizeTransaction(description, options.merchant ?? '');
  if (fromRule !== 'outros') return fromRule;

  const aiCategory = await aiCategorizeTransaction(
    {
      description,
      merchant: options.merchant,
    },
    {
      suggestCategory: options.aiFallback
        ? async (tx) => options.aiFallback?.(String(tx.description ?? ''), String(tx.merchant ?? ''))
        : undefined,
    },
  );

  if (options.userId && options.merchant && aiCategory !== 'outros') {
    await saveMerchantCategoryLearning(options.userId, options.merchant, aiCategory, 0.95);
  }

  return aiCategory;
}
