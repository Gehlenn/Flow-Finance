export type WorkspacePlan = 'free' | 'pro';

export type MonetizationTier = 'core' | 'pro' | 'future';

export const FREE_LIMITS = {
  workspaces: 1,
  consultorIaQueriesPerMonth: 20,
} as const;

export const PRO_FEATURES = {
  unlimitedConsultorIa: true,
  multipleWorkspaces: true,
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
  | 'smartAlertSuggestions'
  | 'reportExport';

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
    valueMessage: 'Registrar entradas, saidas e recebiveis que alimentam o fluxo de caixa.',
  },
  {
    id: 'dashboardCore',
    tier: 'core',
    title: 'Dashboard principal',
    valueMessage: 'Leitura rapida de caixa confirmado, previsto, realizado e pendente.',
  },
  {
    id: 'transactionsView',
    tier: 'core',
    title: 'Tela de transacoes',
    valueMessage: 'Historico operacional para entender o que entrou, saiu e ainda falta.',
  },
  {
    id: 'remindersCore',
    tier: 'core',
    title: 'Lembretes',
    valueMessage: 'Controle de vencimentos e recebiveis que afetam a decisao de caixa.',
  },
  {
    id: 'unlimitedConsultorIa',
    tier: 'pro',
    title: 'Consultor IA ilimitado',
    valueMessage: 'Revisao semanal de caixa sem travar na consulta 21 do mes.',
  },
  {
    id: 'multipleWorkspaces',
    tier: 'pro',
    title: 'Multiplos workspaces',
    valueMessage: 'Separar unidades, clientes ou operacoes de servico sem misturar caixa.',
  },
  {
    id: 'reportExport',
    tier: 'future',
    title: 'Exportacao de relatorios',
    valueMessage: 'Futuro: exportar relatorios quando o backend tiver geracao real.',
  },
  {
    id: 'advancedReports',
    tier: 'pro',
    title: 'Historico de fluxo de caixa',
    valueMessage: 'Comparar semanas e meses para revisar previsto vs realizado.',
  },
  {
    id: 'advancedCashflowAnalysis',
    tier: 'pro',
    title: 'Analises profundas de caixa',
    valueMessage: 'Leitura de tendencia, risco, sazonalidade e buracos de caixa recorrentes.',
  },
  {
    id: 'aiRichConsultant',
    tier: 'pro',
    title: 'Contexto estendido do consultor IA',
    valueMessage: 'Mais historico de caixa e operacao para respostas consultivas menos rasas.',
  },
  {
    id: 'historicalComparisons',
    tier: 'pro',
    title: 'Comparativos historicos completos',
    valueMessage: 'Comparar periodos para entender repeticao de atrasos, entradas e saidas.',
  },
  {
    id: 'smartAlertSuggestions',
    tier: 'pro',
    title: 'Sugestoes de alerta de caixa',
    valueMessage: 'Sugerir limites quando saldo, recebivel ou vencimento exige acao.',
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
