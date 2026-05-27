import type { FixedExpenseCategory } from './fixedExpenseDetectorTypes';

const CATEGORY_LABELS: Record<FixedExpenseCategory, string> = {
  housing: 'Moradia',
  utilities: 'Utilidades',
  subscription: 'Assinaturas',
  insurance: 'Seguros',
  education: 'Educação',
  fitness: 'Saúde / Fitness',
  transport: 'Transporte',
  financing: 'Financiamentos',
  other_fixed: 'Outros Fixos',
};

const CATEGORY_LOGOS: Record<FixedExpenseCategory, string> = {
  housing: '🏠',
  utilities: '⚡',
  subscription: '📱',
  insurance: '🛡️',
  education: '🎓',
  fitness: '💪',
  transport: '🚌',
  financing: '💳',
  other_fixed: '🔄',
};

export function formatExpenseCategory(category: FixedExpenseCategory): string {
  return CATEGORY_LABELS[category] ?? 'Outros';
}

export function getCategoryLogo(category: FixedExpenseCategory): string {
  return CATEGORY_LOGOS[category] ?? '📌';
}

export function assessCommitmentRatio(ratio: number | undefined): {
  label: string;
  color: string;
  warning: boolean;
} {
  if (!ratio) return { label: 'Não calculado', color: 'text-slate-400', warning: false };
  const pct = Math.round(ratio * 100);
  if (pct <= 30) return { label: `${pct}% da renda - saudável`, color: 'text-emerald-500', warning: false };
  if (pct <= 50) return { label: `${pct}% da renda - atenção`, color: 'text-amber-500', warning: false };
  return { label: `${pct}% da renda - crítico`, color: 'text-rose-500', warning: true };
}
