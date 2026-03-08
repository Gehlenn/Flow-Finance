import { Transaction, TransactionType } from '../../types';

// ─── Model (PART 3) ───────────────────────────────────────────────────────────

export type FinancialProfile =
  | 'disciplined'
  | 'balanced'
  | 'impulsive'
  | 'convenience_spender'
  | 'social_spender';

export interface FinancialProfileResult {
  profile: FinancialProfile;
  label: string;
  description: string;
  emoji: string;
  score: Record<FinancialProfile, number>;
}

const PROFILE_META: Record<FinancialProfile, { label: string; description: string; emoji: string }> = {
  disciplined: {
    label: 'Disciplinado',
    description: 'Você mantém gastos estáveis e previsíveis. Seus padrões indicam controle financeiro consistente.',
    emoji: '🎯',
  },
  balanced: {
    label: 'Equilibrado',
    description: 'Você equilibra bem despesas e receitas, com variações moderadas ao longo do mês.',
    emoji: '⚖️',
  },
  impulsive: {
    label: 'Impulsivo',
    description: 'Você realiza muitas compras pequenas e frequentes. Pequenos valores somados podem impactar seu saldo.',
    emoji: '⚡',
  },
  convenience_spender: {
    label: 'Consumidor por Conveniência',
    description: 'Você tende a gastar em serviços práticos (delivery, apps, assinaturas). Praticidade tem um custo.',
    emoji: '📱',
  },
  social_spender: {
    label: 'Gastador Social',
    description: 'Seus gastos concentram-se em lazer, restaurantes e atividades sociais.',
    emoji: '🎉',
  },
};

// Keywords para detecção de padrões
const CONVENIENCE_KEYWORDS = ['ifood', 'uber', 'rappi', 'delivery', '99', 'netflix', 'spotify', 'amazon', 'assinatura', 'app'];
const SOCIAL_KEYWORDS = ['restaurante', 'bar', 'festa', 'cinema', 'show', 'viagem', 'hotel', 'lazer', 'balada', 'café'];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// ─── detectFinancialProfile ───────────────────────────────────────────────────

export function detectFinancialProfile(transactions: Transaction[]): FinancialProfileResult {
  const baseTxs = transactions.filter(t => !t.generated && t.type === TransactionType.DESPESA);

  const scores: Record<FinancialProfile, number> = {
    disciplined: 0,
    balanced: 0,
    impulsive: 0,
    convenience_spender: 0,
    social_spender: 0,
  };

  if (baseTxs.length === 0) {
    scores.balanced = 1;
    return buildResult(scores);
  }

  // ── Impulsive: muitas compras pequenas (< R$30) ───────────────────────────
  const smallCount = baseTxs.filter(t => t.amount < 30).length;
  const smallRatio = smallCount / baseTxs.length;
  if (smallRatio > 0.5) scores.impulsive += 3;
  else if (smallRatio > 0.3) scores.impulsive += 1;

  // ── Convenience: keywords de conveniência ─────────────────────────────────
  const convCount = baseTxs.filter(t =>
    matchesKeywords(t.description, CONVENIENCE_KEYWORDS) ||
    matchesKeywords(t.merchant ?? '', CONVENIENCE_KEYWORDS)
  ).length;
  if (convCount / baseTxs.length > 0.25) scores.convenience_spender += 3;
  else if (convCount >= 2) scores.convenience_spender += 1;

  // ── Social: keywords de lazer/social ─────────────────────────────────────
  const socialCount = baseTxs.filter(t =>
    matchesKeywords(t.description, SOCIAL_KEYWORDS) ||
    matchesKeywords(t.merchant ?? '', SOCIAL_KEYWORDS)
  ).length;
  if (socialCount / baseTxs.length > 0.25) scores.social_spender += 3;
  else if (socialCount >= 2) scores.social_spender += 1;

  // ── Disciplined: gastos com recurrence / estáveis ─────────────────────────
  const recurringCount = transactions.filter(t => t.recurring).length;
  if (recurringCount >= 3) scores.disciplined += 2;

  // Variação mensal estável
  const byMonth: Record<string, number> = {};
  for (const t of baseTxs) {
    const key = t.date.slice(0, 7);
    byMonth[key] = (byMonth[key] ?? 0) + t.amount;
  }
  const monthlyValues = Object.values(byMonth);
  if (monthlyValues.length >= 2) {
    const avg = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
    const maxDeviation = Math.max(...monthlyValues.map(v => Math.abs(v - avg) / avg));
    if (maxDeviation < 0.15) scores.disciplined += 2;
    else if (maxDeviation < 0.30) scores.balanced += 2;
    else scores.balanced += 1;
  }

  // ── Balanced: fallback se nenhum destaca ──────────────────────────────────
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) scores.balanced = 1;

  return buildResult(scores);
}

function buildResult(scores: Record<FinancialProfile, number>): FinancialProfileResult {
  const profile = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as FinancialProfile;
  return {
    profile,
    ...PROFILE_META[profile],
    score: scores,
  };
}
