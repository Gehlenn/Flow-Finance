export type WorkspacePlan = 'free' | 'pro';

export type MonetizationTier = 'core' | 'free' | 'pro' | 'future';

export type FlowMonetizationFeature =
  | 'manualTransactions'
  | 'dashboardCore'
  | 'transactionsView'
  | 'remindersCore'
  | 'advancedReports'
  | 'advancedCashflowAnalysis'
  | 'aiRichConsultant'
  | 'historicalComparisons'
  | 'smartAlertSuggestions';

type FeatureDefinition = {
  id: FlowMonetizationFeature;
  tier: MonetizationTier;
  title: string;
  valueMessage: string;
};

export const MONETIZATION_FEATURES: FeatureDefinition[] = [
  {
    id: 'manualTransactions',
    tier: 'core',
    title: 'Lancamentos manuais',
    valueMessage: 'Registrar entradas e saidas sem bloqueio.',
  },
  {
    id: 'dashboardCore',
    tier: 'core',
    title: 'Dashboard principal',
    valueMessage: 'Leitura rapida de caixa e sinais operacionais.',
  },
  {
    id: 'transactionsView',
    tier: 'core',
    title: 'Tela de transacoes',
    valueMessage: 'Historico e ajustes basicos de movimentacoes.',
  },
  {
    id: 'remindersCore',
    tier: 'core',
    title: 'Lembretes',
    valueMessage: 'Controle operacional e financeiro recorrente.',
  },
  {
    id: 'advancedReports',
    tier: 'pro',
    title: 'Relatorios completos',
    valueMessage: 'Mais profundidade para decisoes de rotina.',
  },
  {
    id: 'advancedCashflowAnalysis',
    tier: 'pro',
    title: 'Analises profundas de caixa',
    valueMessage: 'Visao mais detalhada de tendencia e risco.',
  },
  {
    id: 'aiRichConsultant',
    tier: 'pro',
    title: 'IA com contexto ampliado',
    valueMessage: 'Respostas mais ricas para planejamento financeiro.',
  },
  {
    id: 'historicalComparisons',
    tier: 'pro',
    title: 'Comparativos historicos completos',
    valueMessage: 'Leitura de evolucao com mais contexto temporal.',
  },
  {
    id: 'smartAlertSuggestions',
    tier: 'pro',
    title: 'Sugestoes inteligentes de alertas',
    valueMessage: 'Conveniencia para configurar limites com menos friccao.',
  },
];

const FEATURE_TIER_BY_ID: Record<FlowMonetizationFeature, MonetizationTier> = MONETIZATION_FEATURES.reduce(
  (acc, feature) => {
    acc[feature.id] = feature.tier;
    return acc;
  },
  {} as Record<FlowMonetizationFeature, MonetizationTier>,
);

export function isProPlan(plan: WorkspacePlan | null | undefined): boolean {
  return plan === 'pro';
}

export function canAccessFeature(plan: WorkspacePlan | null | undefined, feature: FlowMonetizationFeature): boolean {
  const tier = FEATURE_TIER_BY_ID[feature];

  if (!tier) return false;
  if (tier === 'future') return false;
  if (tier === 'pro') return isProPlan(plan);

  return true;
}

export function getFeaturesByTier(tier: MonetizationTier): FeatureDefinition[] {
  return MONETIZATION_FEATURES.filter((feature) => feature.tier === tier);
}

export const MONETIZATION_PRICING = {
  proMonthlyBRL: 29.9,
  annualDiscountPercent: 20,
};
