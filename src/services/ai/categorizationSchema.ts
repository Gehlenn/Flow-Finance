import { Category, TransactionType } from '../../../types';

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
  | 'compras'
  | 'servicos'
  | 'banco'
  | 'outros';

export interface CanonicalCategorizationResult {
  category: Category;
  financeCategory: FinanceCategory;
  confidence: number;
  type?: TransactionType;
  rationale?: string;
  source: 'rule' | 'ai' | 'fallback';
  erro?: string;
}

const PRODUCT_CATEGORY_ALIASES: Array<[Category, string[]]> = [
  [Category.PESSOAL, ['pessoal', 'pessoais', 'personal']],
  [Category.CONSULTORIO, ['trabalho', 'consultorio', 'consultório', 'clinica', 'clínica', 'workspace']],
  [Category.NEGOCIO, ['negocio', 'negócio', 'empresa', 'business', 'servicos', 'serviços']],
  [Category.INVESTIMENTO, ['investimento', 'investimentos', 'aporte', 'aplicacao', 'aplicação']],
];

const FINANCE_TO_PRODUCT_CATEGORY: Record<FinanceCategory, Category> = {
  transporte: Category.PESSOAL,
  alimentacao: Category.PESSOAL,
  assinaturas: Category.PESSOAL,
  moradia: Category.PESSOAL,
  saude: Category.PESSOAL,
  combustivel: Category.PESSOAL,
  educacao: Category.PESSOAL,
  lazer: Category.PESSOAL,
  salario: Category.NEGOCIO,
  compras: Category.PESSOAL,
  servicos: Category.NEGOCIO,
  banco: Category.CONSULTORIO,
  outros: Category.PESSOAL,
};

const PRODUCT_TO_FINANCE_FALLBACK: Record<Category, FinanceCategory> = {
  [Category.PESSOAL]: 'outros',
  [Category.CONSULTORIO]: 'servicos',
  [Category.NEGOCIO]: 'servicos',
  [Category.INVESTIMENTO]: 'banco',
};

const RAW_FINANCE_CATEGORY_ALIASES: Array<[FinanceCategory, string[]]> = [
  ['transporte', ['transporte', 'uber', 'corrida', 'taxi', 'táxi', 'mobilidade']],
  ['alimentacao', ['alimentacao', 'alimentação', 'mercado', 'restaurante', 'ifood', 'comida']],
  ['assinaturas', ['assinaturas', 'assinatura', 'streaming', 'subscription', 'software']],
  ['moradia', ['moradia', 'aluguel', 'condominio', 'condomínio', 'casa']],
  ['saude', ['saude', 'saúde', 'farmacia', 'farmácia', 'clinica', 'clínica']],
  ['combustivel', ['combustivel', 'combustível', 'posto', 'gasolina']],
  ['educacao', ['educacao', 'educação', 'curso', 'escola', 'treinamento']],
  ['lazer', ['lazer', 'entretenimento', 'viagem', 'show']],
  ['salario', ['salario', 'salário', 'receita', 'faturamento', 'venda', 'income']],
  ['compras', ['compras', 'compra', 'shopping', 'varejo']],
  ['servicos', ['servicos', 'serviços', 'servico', 'serviço', 'marketing', 'fornecedor', 'trabalho', 'consultorio', 'consultório', 'clinica', 'clínica']],
  ['banco', ['banco', 'tarifa', 'juros', 'investimento', 'aporte']],
  ['outros', ['outros', 'geral', 'indefinida', 'indefinido', 'unknown']],
];

export function normalizeCategoryLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function tokenizeCategoryLabel(value: string): string[] {
  return value
    .split(/[\/|,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function normalizeToProductCategory(value: string | Category | null | undefined): Category {
  const normalized = normalizeCategoryLabel(value);

  for (const [category, aliases] of PRODUCT_CATEGORY_ALIASES) {
    if (aliases.includes(normalized) || normalizeCategoryLabel(category) === normalized) {
      return category;
    }
  }

  const financeCategory = normalizeToFinanceCategory(normalized);
  return FINANCE_TO_PRODUCT_CATEGORY[financeCategory];
}

export function normalizeToFinanceCategory(
  value: string | FinanceCategory | Category | null | undefined,
): FinanceCategory {
  const normalized = normalizeCategoryLabel(value);
  const normalizedTokens = tokenizeCategoryLabel(normalized);

  for (const [financeCategory, aliases] of RAW_FINANCE_CATEGORY_ALIASES) {
    if (aliases.includes(normalized) || financeCategory === normalized) {
      return financeCategory;
    }

    if (normalizedTokens.length > 1 && normalizedTokens.some((token) => aliases.includes(token))) {
      return financeCategory;
    }
  }

  const productCategory = Object.values(Category).find(
    (category) => normalizeCategoryLabel(category) === normalized,
  );
  if (productCategory) {
    return PRODUCT_TO_FINANCE_FALLBACK[productCategory];
  }

  for (const [category, aliases] of PRODUCT_CATEGORY_ALIASES) {
    if (aliases.includes(normalized) || normalizeCategoryLabel(category) === normalized) {
      return PRODUCT_TO_FINANCE_FALLBACK[category];
    }

    if (normalizedTokens.length > 1 && normalizedTokens.some((token) => aliases.includes(token))) {
      return PRODUCT_TO_FINANCE_FALLBACK[category];
    }
  }

  return 'outros';
}

export function buildCanonicalCategorizationResult(input: {
  category?: string | null;
  financeCategory?: string | null;
  confidence?: number | null;
  type?: string | TransactionType | null;
  rationale?: string | null;
  source?: CanonicalCategorizationResult['source'];
  erro?: string | null;
}): CanonicalCategorizationResult {
  const financeCategory = input.financeCategory
    ? normalizeToFinanceCategory(input.financeCategory)
    : normalizeToFinanceCategory(input.category);

  const category = input.category
    ? normalizeToProductCategory(input.category)
    : FINANCE_TO_PRODUCT_CATEGORY[financeCategory];

  const rawType = String(input.type ?? '').trim();
  const type =
    rawType === TransactionType.RECEITA
      ? TransactionType.RECEITA
      : rawType === TransactionType.DESPESA
      ? TransactionType.DESPESA
      : undefined;

  return {
    category,
    financeCategory,
    confidence: typeof input.confidence === 'number' ? input.confidence : 0,
    type,
    rationale: input.rationale ?? undefined,
    source: input.source ?? 'fallback',
    erro: input.erro ?? undefined,
  };
}
