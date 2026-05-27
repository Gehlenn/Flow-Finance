export type WorkspacePlan = 'free' | 'pro';

export type MonetizationTier = 'core' | 'pro' | 'future';

export const FREE_LIMITS = {
  workspaces: 1,
  consultorIaQueriesPerMonth: 20,
  reportExportPerMonth: 0,
} as const;

export const PRO_FEATURES = {
  unlimitedConsultorIa: true,
  multipleWorkspaces: true,
  reportExport: true,
} as const;

type LegacyMonetizationFeature =
  | 'manualTransactions'
  | 'dashboardCore'
  | 'transactionsView'
  | 'remindersCore'
  | 'advancedReports'
  | 'advancedCashflowAnalysis'
  | 'aiRichConsultant'
  | 'historicalComparisons'
  | 'smartAlertSuggestions';

export type FlowMonetizationFeature = LegacyMonetizationFeature | keyof typeof PRO_FEATURES;

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
    id: 'unlimitedConsultorIa',
    tier: 'pro',
    title: 'Consultor IA ilimitado',
    valueMessage: 'Sem travar na consulta 21 do mes.',
  },
  {
    id: 'multipleWorkspaces',
    tier: 'pro',
    title: 'Multiplos workspaces',
    valueMessage: 'Separar operacoes, unidades e contextos sem misturar dados.',
  },
  {
    id: 'reportExport',
    tier: 'pro',
    title: 'Exportacao de relatorios',
    valueMessage: 'Levar PDF operacional para alinhamento, repasse ou auditoria.',
  },
  {
    id: 'advancedReports',
    tier: 'pro',
    title: 'Relatorios completos',
    valueMessage: 'Camada analitica mais profunda para operacao financeira.',
  },
  {
    id: 'advancedCashflowAnalysis',
    tier: 'pro',
    title: 'Analises profundas de caixa',
    valueMessage: 'Leitura mais detalhada de tendencia, risco e sazonalidade.',
  },
  {
    id: 'aiRichConsultant',
    tier: 'pro',
    title: 'Contexto estendido do consultor IA',
    valueMessage: 'Compatibilidade com gates antigos enquanto o app converge para o novo plano.',
  },
  {
    id: 'historicalComparisons',
    tier: 'pro',
    title: 'Comparativos historicos completos',
    valueMessage: 'Comparar periodos com mais contexto temporal.',
  },
  {
    id: 'smartAlertSuggestions',
    tier: 'pro',
    title: 'Sugestoes inteligentes de alertas',
    valueMessage: 'Configurar limites e alertas com menos trabalho manual.',
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

export function canAccessFeature(
  plan: WorkspacePlan | null | undefined,
  feature: FlowMonetizationFeature,
): boolean {
  const tier = FEATURE_TIER_BY_ID[feature];

  if (!tier) return false;
  if (tier === 'future') return false;
  if (tier === 'pro') return isProPlan(plan);

  return true;
}

export function withinFreeLimit(
  plan: WorkspacePlan | null | undefined,
  key: keyof typeof FREE_LIMITS,
  currentUsage: number,
): boolean {
  if (isProPlan(plan)) {
    return true;
  }

  return currentUsage < FREE_LIMITS[key];
}

export function getFeaturesByTier(tier: MonetizationTier): FeatureDefinition[] {
  return MONETIZATION_FEATURES.filter((feature) => feature.tier === tier);
}

export const MONETIZATION_PRICING = {
  proMonthlyBRL: 49,
  proAnnualBRL: 490,
};
