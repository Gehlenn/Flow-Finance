export type WorkspacePlan = 'free' | 'pro';

export type MonetizationTier = 'core' | 'pro' | 'future';
export type PackagingStatus = 'available' | 'validation' | 'future';

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

export type PlanPackaging = {
  id: WorkspacePlan;
  label: string;
  priceLabel: string;
  shortPositioning: string;
  decisionJob: string;
  status: PackagingStatus;
  includedFeatureIds: FlowMonetizationFeature[];
  limits: {
    workspaces: number | 'multiple';
    consultorIaQueriesPerMonth: number | 'unlimited';
  };
  upgradeTrigger?: string;
};

export const MONETIZATION_FEATURES: FeatureDefinition[] = [
  {
    id: 'manualTransactions',
    tier: 'core',
    title: 'Lancamentos manuais',
    valueMessage: 'Registrar entradas e saidas manualmente para manter o caixa visivel.',
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
    valueMessage: 'Historico operacional para revisar o que entrou, saiu e ainda falta.',
  },
  {
    id: 'remindersCore',
    tier: 'core',
    title: 'Lembretes',
    valueMessage: 'Lembretes de vencimento e recebimento que pedem acao na revisao inicial.',
  },
  {
    id: 'unlimitedConsultorIa',
    tier: 'pro',
    title: 'Revisao semanal de caixa ilimitada',
    valueMessage: 'Revisar saldo, recebiveis e proximas saidas sem bloqueio mensal.',
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
    valueMessage: 'Futuro: exportar relatorios quando a geracao real estiver disponivel.',
  },
  {
    id: 'advancedReports',
    tier: 'pro',
    title: 'Historico de fluxo de caixa',
    valueMessage: 'Historico e relatorios para comparar semanas e meses.',
  },
  {
    id: 'advancedCashflowAnalysis',
    tier: 'pro',
    title: 'Analises profundas de caixa',
    valueMessage: 'Leitura de tendencia, risco e concentracao recorrente de caixa.',
  },
  {
    id: 'aiRichConsultant',
    tier: 'pro',
    title: 'Mais historico para comparar caixa',
    valueMessage: 'Mais historico de caixa e operacao para comparar previsto vs realizado sem resposta rasa.',
  },
  {
    id: 'historicalComparisons',
    tier: 'pro',
    title: 'Comparativos historicos completos',
    valueMessage: 'Comparar periodos para identificar mudancas reais de caixa.',
  },
  {
    id: 'smartAlertSuggestions',
    tier: 'pro',
    title: 'Sugestoes de alerta de caixa',
    valueMessage: 'Sugerir alertas quando saldo, recebiveis ou vencimentos pedem acao.',
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

export function formatMonthlyPriceBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}/mes`;
}

export function formatAnnualPriceBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}/ano`;
}

export const PLAN_PACKAGING: Record<WorkspacePlan, PlanPackaging> = {
  free: {
    id: 'free',
    label: 'Free',
    priceLabel: 'R$ 0',
    shortPositioning: 'Caixa basico para lancamento manual e revisao inicial.',
    decisionJob: 'Registrar entradas, saidas e vencimentos para a primeira leitura de caixa.',
    status: 'available',
    includedFeatureIds: ['manualTransactions', 'dashboardCore', 'transactionsView', 'remindersCore'],
    limits: {
      workspaces: FREE_LIMITS.workspaces,
      consultorIaQueriesPerMonth: FREE_LIMITS.consultorIaQueriesPerMonth,
    },
    upgradeTrigger: 'Upgrade quando a operacao precisar de historico, relatorios, revisao semanal ou workspaces separados.',
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    priceLabel: formatMonthlyPriceBRL(MONETIZATION_PRICING.proMonthlyBRL),
    shortPositioning: 'Historico, relatorios e revisao semanal para operacoes de servico.',
    decisionJob: 'Aprofundar previsto vs realizado, risco e contexto para a rotina semanal de caixa.',
    status: 'validation',
    includedFeatureIds: [
      'unlimitedConsultorIa',
      'multipleWorkspaces',
      'advancedReports',
      'advancedCashflowAnalysis',
      'aiRichConsultant',
      'historicalComparisons',
      'smartAlertSuggestions',
    ],
    limits: {
      workspaces: 'multiple',
      consultorIaQueriesPerMonth: 'unlimited',
    },
    upgradeTrigger: 'Upgrade quando o caixa depender de varias operacoes, historico comparativo ou consultas consultivas recorrentes.',
  },
};

export function getPlanPackaging(plan: WorkspacePlan): PlanPackaging {
  return PLAN_PACKAGING[plan];
}

export function getPlanFeatureMessages(plan: WorkspacePlan): string[] {
  return getPlanPackaging(plan).includedFeatureIds.map((featureId) => {
    const feature = MONETIZATION_FEATURES.find((item) => item.id === featureId);
    return feature?.valueMessage || featureId;
  });
}

export function getUpgradePromptBullets(): string[] {
  return [
    'Sem bloqueio mensal para revisar caixa, recebiveis e proximas saidas.',
    'Historico para comparar previsto vs realizado sem depender de memoria.',
    'Workspaces separados para operacoes, unidades ou clientes de servico.',
  ];
}

export function getPackagingEvidenceBoundary(): string {
  return 'Packaging preparado para validacao; nao prova disposicao a pagar, conversao paga, CAC, LTV, demanda de mercado ou billing real.';
}
