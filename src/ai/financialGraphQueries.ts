import type { FinancialGraph } from './financialGraphTypes';
import type { CategoryNodeMeta, MerchantNodeMeta, SubscriptionNodeMeta } from '../../models/FinancialGraphNode';

export interface TopMerchant {
  merchant_id: string;
  name: string;
  total_spent: number;
  visit_count: number;
  avg_amount: number;
  last_seen: string;
  category?: string;
}

export interface CategorySpending {
  category_id: string;
  name: string;
  total: number;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  top_merchants: string[];
}

export interface SubscriptionCandidate {
  merchant_id: string;
  name: string;
  estimated_amount: number;
  visit_count: number;
  is_confirmed_subscription: boolean;
  subscription_node_id?: string;
}

export function getTopMerchants(graph: FinancialGraph, limit = 10): TopMerchant[] {
  const results: TopMerchant[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type !== 'merchant') continue;
    const meta = node.metadata as MerchantNodeMeta;
    results.push({
      merchant_id: node.id,
      name: meta.name,
      total_spent: meta.total_spent,
      visit_count: meta.visit_count,
      avg_amount: meta.avg_amount,
      last_seen: meta.last_seen,
      category: meta.category_hint,
    });
  }
  return results.sort((a, b) => b.total_spent - a.total_spent).slice(0, limit);
}

export function getCategorySpending(graph: FinancialGraph): CategorySpending[] {
  const results: CategorySpending[] = [];

  for (const node of graph.nodes.values()) {
    if (node.type !== 'category') continue;
    const meta = node.metadata as CategoryNodeMeta;

    const merchantEdges = graph.edges.filter(
      (e) => e.relation === 'same_category' && e.to === node.id,
    );
    const topMerchants = merchantEdges
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 3)
      .map((e) => graph.nodes.get(e.from)?.label ?? e.from);

    results.push({
      category_id: node.id,
      name: meta.name,
      total: meta.total_amount,
      count: meta.transaction_count,
      percentage: meta.percentage_of_total,
      trend: meta.trend,
      top_merchants: topMerchants,
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

export function detectSubscriptionCandidates(graph: FinancialGraph): SubscriptionCandidate[] {
  const results: SubscriptionCandidate[] = [];
  const confirmedSubMerchants = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.relation !== 'is_subscription') continue;
    const subNode = graph.nodes.get(edge.to);
    const mNode = graph.nodes.get(edge.from);
    if (!subNode || !mNode) continue;

    confirmedSubMerchants.add(edge.from);
    const subMeta = subNode.metadata as SubscriptionNodeMeta;
    results.push({
      merchant_id: edge.from,
      name: mNode.label,
      estimated_amount: subMeta.amount,
      visit_count: (mNode.metadata as MerchantNodeMeta).visit_count,
      is_confirmed_subscription: true,
      subscription_node_id: edge.to,
    });
  }

  for (const node of graph.nodes.values()) {
    if (node.type !== 'merchant') continue;
    if (confirmedSubMerchants.has(node.id)) continue;

    const meta = node.metadata as MerchantNodeMeta;
    if (meta.visit_count < 2) continue;
    if (meta.avg_amount > 250) continue;
    if (meta.avg_amount < 5) continue;

    results.push({
      merchant_id: node.id,
      name: meta.name,
      estimated_amount: meta.avg_amount,
      visit_count: meta.visit_count,
      is_confirmed_subscription: false,
    });
  }

  return results.sort((a, b) => (b.is_confirmed_subscription ? 1 : 0) - (a.is_confirmed_subscription ? 1 : 0));
}

export function graphToAIContext(graph: FinancialGraph, maxMerchants = 8): string {
  const topMerchants = getTopMerchants(graph, maxMerchants);
  const catSpending = getCategorySpending(graph);
  const subCandidates = detectSubscriptionCandidates(graph);
  const confirmedSubs = subCandidates.filter((subscription) => subscription.is_confirmed_subscription);

  const fmt = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const merchantLines = topMerchants
    .map((merchant) => `  • ${merchant.name}: ${fmt(merchant.total_spent)} (${merchant.visit_count}×)`)
    .join('\n');

  const categoryLines = catSpending
    .slice(0, 5)
    .map((category) => `  • ${category.name}: ${fmt(category.total)} (${category.percentage}%) [${category.trend}]`)
    .join('\n');

  const subLines = confirmedSubs.length > 0
    ? confirmedSubs.map((subscription) => `  • ${subscription.name}: ${fmt(subscription.estimated_amount)}/mês`).join('\n')
    : '  • Nenhuma confirmada';

  return `
=== GRAFO FINANCEIRO (${graph.stats.node_count} nós, ${graph.stats.edge_count} arestas) ===

TOP ${topMerchants.length} ESTABELECIMENTOS:
${merchantLines || '  • Sem dados'}

GASTOS POR CATEGORIA:
${categoryLines || '  • Sem dados'}

ASSINATURAS CONFIRMADAS:
${subLines}

PADRÕES DE GRAFO:
  • Comerciantes únicos: ${graph.stats.merchant_count}
  • Categorias ativas: ${graph.stats.category_count}
  • Assinaturas detectadas: ${graph.stats.subscription_count}
  • Transações mapeadas: ${graph.stats.transaction_count}
`.trim();
}
