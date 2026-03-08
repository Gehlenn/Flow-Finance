/**
 * FINANCIAL INTELLIGENCE GRAPH ENGINE
 * src/services/ai/financialGraph.ts
 *
 * Builds and queries a directed property graph over financial entities.
 *
 * Graph schema
 * ─────────────
 *  user
 *    └─[owns]──────────► account
 *                           └─[has_transaction]──► transaction
 *                                                    ├─[paid_to]──────► merchant
 *                                                    │                    └─[same_category]──► category
 *                                                    └─[belongs_to]───► category
 *  merchant
 *    └─[is_subscription]──► subscription
 *
 * Plus:
 *   merchant ←[co_occurs]→ merchant   (bought together within 24h)
 *
 * PART 3 — buildFinancialGraph
 * PART 4 — getTopMerchants, getCategorySpending, detectSubscriptionCandidates
 */

import { Transaction, TransactionType } from '../../types';
import { Account }                       from '../../models/Account';
import { FinancialGraphNode, MerchantNodeMeta, CategoryNodeMeta, SubscriptionNodeMeta } from '../../models/FinancialGraphNode';
import { FinancialGraphEdge }            from '../../models/FinancialGraphEdge';
import { detectSubscriptions }           from './subscriptionDetector';

// ─── Graph container ──────────────────────────────────────────────────────────

export interface FinancialGraph {
  nodes:      Map<string, FinancialGraphNode>;
  edges:      FinancialGraphEdge[];
  built_at:   string;
  user_id:    string;
  stats: {
    node_count:        number;
    edge_count:        number;
    merchant_count:    number;
    category_count:    number;
    subscription_count: number;
    transaction_count: number;
  };
}

// ─── Module-level graph cache ─────────────────────────────────────────────────

let _graphCache: FinancialGraph | null = null;
let _cacheKey: string = '';

function makeCacheKey(userId: string, txCount: number, accCount: number): string {
  return `${userId}:${txCount}:${accCount}`;
}

export function getGraphCache(): FinancialGraph | null { return _graphCache; }
export function invalidateGraphCache(): void { _graphCache = null; _cacheKey = ''; }

// ─── ID helpers ───────────────────────────────────────────────────────────────

function nodeId(type: string, key: string): string {
  return `${type}:${key.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`;
}

// ─── PART 3 — buildFinancialGraph ────────────────────────────────────────────

/**
 * Builds (or returns cached) the full Financial Intelligence Graph.
 *
 * @param userId       - current user identifier
 * @param accounts     - user's accounts array
 * @param transactions - all transactions (generated ones excluded)
 * @returns FinancialGraph
 */
export function buildFinancialGraph(
  userId: string,
  accounts: Account[],
  transactions: Transaction[]
): FinancialGraph {
  const baseTxs   = transactions.filter(t => !t.generated);
  const cacheKey  = makeCacheKey(userId, baseTxs.length, accounts.length);

  if (_graphCache && _cacheKey === cacheKey) return _graphCache;

  const nodes = new Map<string, FinancialGraphNode>();
  const edges: FinancialGraphEdge[] = [];

  // ── Step 1a: User node ──────────────────────────────────────────────────
  const userNodeId = nodeId('user', userId);
  nodes.set(userNodeId, {
    id:    userNodeId,
    type:  'user',
    label: 'Usuário',
    metadata: { user_id: userId },
  });

  // ── Step 1b: Account nodes ──────────────────────────────────────────────
  for (const acc of accounts) {
    const accNodeId = nodeId('account', acc.id);
    nodes.set(accNodeId, {
      id:    accNodeId,
      type:  'account',
      label: acc.name,
      metadata: {
        account_id:   acc.id,
        account_type: acc.type,
        balance:      acc.balance,
        currency:     'BRL',
      },
    });
    edges.push({ from: userNodeId, to: accNodeId, relation: 'owns', weight: acc.balance });
  }

  // ── Step 1c: Collect merchant + category aggregates ─────────────────────
  const merchantAgg: Record<string, {
    total: number; count: number; dates: string[]; categories: string[];
  }> = {};
  const categoryAgg: Record<string, { total: number; count: number }> = {};
  const categoryPrev: Record<string, number> = {};  // prev-30d for trend

  const now = Date.now();
  const cut30  = now - 30  * 86400000;
  const cut60  = now - 60  * 86400000;

  for (const tx of baseTxs) {
    if (tx.type !== TransactionType.DESPESA) continue;
    const txDate = new Date(tx.date).getTime();

    // Category aggregation
    const catKey = tx.category ?? 'Outros';
    if (!categoryAgg[catKey]) categoryAgg[catKey] = { total: 0, count: 0 };
    categoryAgg[catKey].total += tx.amount;
    categoryAgg[catKey].count++;

    // Prev-period category (30–60 days ago)
    if (txDate >= cut60 && txDate < cut30) {
      categoryPrev[catKey] = (categoryPrev[catKey] ?? 0) + tx.amount;
    }

    // Merchant aggregation (only if merchant is known)
    const merchant = (tx.merchant ?? '').trim() || tx.description?.split(' ').slice(0, 3).join(' ');
    if (!merchant) continue;

    const mKey = merchant.toLowerCase();
    if (!merchantAgg[mKey]) merchantAgg[mKey] = { total: 0, count: 0, dates: [], categories: [] };
    merchantAgg[mKey].total += tx.amount;
    merchantAgg[mKey].count++;
    merchantAgg[mKey].dates.push(tx.date);
    if (!merchantAgg[mKey].categories.includes(catKey)) merchantAgg[mKey].categories.push(catKey);
  }

  // Category total for percentage
  const totalCategoryAmount = Object.values(categoryAgg).reduce((s, v) => s + v.total, 0);

  // ── Step 1d: Category nodes ─────────────────────────────────────────────
  for (const [catName, agg] of Object.entries(categoryAgg)) {
    const catNodeId = nodeId('category', catName);
    const prevAmt   = categoryPrev[catName] ?? 0;
    const trend: CategoryNodeMeta['trend'] =
      prevAmt === 0         ? 'stable'
      : agg.total > prevAmt * 1.05 ? 'up'
      : agg.total < prevAmt * 0.95 ? 'down'
      : 'stable';

    const meta: CategoryNodeMeta = {
      name:                catName,
      total_amount:        agg.total,
      transaction_count:   agg.count,
      percentage_of_total: totalCategoryAmount > 0
        ? Math.round((agg.total / totalCategoryAmount) * 1000) / 10
        : 0,
      trend,
    };

    nodes.set(catNodeId, {
      id: catNodeId, type: 'category', label: catName, metadata: meta,
    });
  }

  // ── Step 1e: Merchant nodes ─────────────────────────────────────────────
  for (const [mKey, agg] of Object.entries(merchantAgg)) {
    const mNodeId = nodeId('merchant', mKey);
    const sortedDates = [...agg.dates].sort();
    const meta: MerchantNodeMeta = {
      name:          mKey,
      total_spent:   agg.total,
      visit_count:   agg.count,
      avg_amount:    agg.total / agg.count,
      last_seen:     sortedDates[sortedDates.length - 1] ?? '',
      category_hint: agg.categories[0],
    };
    nodes.set(mNodeId, {
      id: mNodeId, type: 'merchant', label: mKey, metadata: meta,
    });

    // merchant → category (same_category edge)
    for (const cat of agg.categories) {
      const catNodeId = nodeId('category', cat);
      if (nodes.has(catNodeId)) {
        edges.push({
          from: mNodeId, to: catNodeId, relation: 'same_category',
          weight: agg.total,
        });
      }
    }
  }

  // ── Step 2: Transaction nodes + edges ───────────────────────────────────
  for (const tx of baseTxs) {
    const txNodeId  = nodeId('transaction', tx.id);
    const merchant  = (tx.merchant ?? '').trim() || tx.description?.split(' ').slice(0, 3).join(' ');
    const catKey    = tx.category ?? 'Outros';

    nodes.set(txNodeId, {
      id:   txNodeId,
      type: 'transaction',
      label: tx.description ?? 'Transação',
      metadata: {
        transaction_id: tx.id,
        amount:         tx.amount,
        type:           tx.type,
        date:           tx.date,
        category:       catKey,
        merchant:       merchant || undefined,
        source:         tx.source,
      },
    });

    // account → transaction
    const accNodeId = tx.account_id
      ? nodeId('account', tx.account_id)
      : (accounts[0] ? nodeId('account', accounts[0].id) : null);

    if (accNodeId && nodes.has(accNodeId)) {
      edges.push({
        from: accNodeId, to: txNodeId, relation: 'has_transaction', weight: tx.amount,
      });
    }

    // transaction → merchant
    if (merchant) {
      const mNodeId = nodeId('merchant', merchant.toLowerCase());
      if (nodes.has(mNodeId)) {
        edges.push({
          from: txNodeId, to: mNodeId, relation: 'paid_to', weight: tx.amount,
        });
      }
    }

    // transaction → category
    const catNodeId = nodeId('category', catKey);
    if (nodes.has(catNodeId)) {
      edges.push({
        from: txNodeId, to: catNodeId, relation: 'belongs_to', weight: tx.amount,
      });
    }
  }

  // ── Step 3: Subscription nodes + merchant→subscription edges ────────────
  const subSummary = detectSubscriptions(baseTxs);
  for (const sub of subSummary.subscriptions) {
    const subNodeId = nodeId('subscription', sub.id);
    const meta: SubscriptionNodeMeta = {
      name:          sub.name,
      amount:        sub.amount,
      cycle:         sub.cycle,
      last_charge:   sub.last_charge,
      next_expected: sub.next_expected,
      total_spent:   sub.total_spent,
      logo:          sub.logo,
    };
    nodes.set(subNodeId, {
      id: subNodeId, type: 'subscription', label: sub.name, metadata: meta,
    });

    // merchant → subscription
    const mNodeId = nodeId('merchant', sub.merchant.toLowerCase());
    if (nodes.has(mNodeId)) {
      edges.push({
        from: mNodeId, to: subNodeId, relation: 'is_subscription', weight: sub.amount,
      });
    }
  }

  // ── Step 4: Co-occurrence edges (same-day merchant pairs) ────────────────
  const txByDay: Record<string, string[]> = {}; // date → [merchantNodeId]
  for (const tx of baseTxs) {
    if (tx.type !== TransactionType.DESPESA) continue;
    const dayKey = tx.date.slice(0, 10);
    const merchant = (tx.merchant ?? '').trim() || tx.description?.split(' ').slice(0, 3).join(' ');
    if (!merchant) continue;
    const mNodeId = nodeId('merchant', merchant.toLowerCase());
    if (!txByDay[dayKey]) txByDay[dayKey] = [];
    if (!txByDay[dayKey].includes(mNodeId)) txByDay[dayKey].push(mNodeId);
  }

  const coOccCount: Record<string, number> = {};
  for (const mIds of Object.values(txByDay)) {
    if (mIds.length < 2) continue;
    for (let i = 0; i < mIds.length; i++) {
      for (let j = i + 1; j < mIds.length; j++) {
        const key = [mIds[i], mIds[j]].sort().join('||');
        coOccCount[key] = (coOccCount[key] ?? 0) + 1;
      }
    }
  }

  for (const [key, count] of Object.entries(coOccCount)) {
    if (count < 2) continue; // need at least 2 co-occurrences
    const [a, b] = key.split('||');
    if (nodes.has(a) && nodes.has(b)) {
      edges.push({ from: a, to: b, relation: 'co_occurs', weight: count });
    }
  }

  // ── Assemble graph ───────────────────────────────────────────────────────
  const graph: FinancialGraph = {
    nodes,
    edges,
    built_at:  new Date().toISOString(),
    user_id:   userId,
    stats: {
      node_count:         nodes.size,
      edge_count:         edges.length,
      merchant_count:     [...nodes.values()].filter(n => n.type === 'merchant').length,
      category_count:     [...nodes.values()].filter(n => n.type === 'category').length,
      subscription_count: [...nodes.values()].filter(n => n.type === 'subscription').length,
      transaction_count:  [...nodes.values()].filter(n => n.type === 'transaction').length,
    },
  };

  _graphCache  = graph;
  _cacheKey    = cacheKey;

  return graph;
}

// ─── PART 4 — Graph query helpers ────────────────────────────────────────────

export interface TopMerchant {
  merchant_id: string;
  name:        string;
  total_spent: number;
  visit_count: number;
  avg_amount:  number;
  last_seen:   string;
  category?:   string;
}

/**
 * Returns the top N merchants by total spend.
 */
export function getTopMerchants(graph: FinancialGraph, limit = 10): TopMerchant[] {
  const results: TopMerchant[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type !== 'merchant') continue;
    const meta = node.metadata as MerchantNodeMeta;
    results.push({
      merchant_id: node.id,
      name:        meta.name,
      total_spent: meta.total_spent,
      visit_count: meta.visit_count,
      avg_amount:  meta.avg_amount,
      last_seen:   meta.last_seen,
      category:    meta.category_hint,
    });
  }
  return results.sort((a, b) => b.total_spent - a.total_spent).slice(0, limit);
}

export interface CategorySpending {
  category_id:   string;
  name:          string;
  total:         number;
  count:         number;
  percentage:    number;
  trend:         'up' | 'down' | 'stable';
  top_merchants: string[];
}

/**
 * Returns spending breakdown by category, sorted by total descending.
 */
export function getCategorySpending(graph: FinancialGraph): CategorySpending[] {
  const results: CategorySpending[] = [];

  for (const node of graph.nodes.values()) {
    if (node.type !== 'category') continue;
    const meta = node.metadata as CategoryNodeMeta;

    // Find merchants that point to this category
    const merchantEdges = graph.edges.filter(
      e => e.relation === 'same_category' && e.to === node.id
    );
    const topMerchants = merchantEdges
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 3)
      .map(e => graph.nodes.get(e.from)?.label ?? e.from);

    results.push({
      category_id:   node.id,
      name:          meta.name,
      total:         meta.total_amount,
      count:         meta.transaction_count,
      percentage:    meta.percentage_of_total,
      trend:         meta.trend,
      top_merchants: topMerchants,
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

export interface SubscriptionCandidate {
  merchant_id:   string;
  name:          string;
  estimated_amount: number;
  visit_count:   number;
  is_confirmed_subscription: boolean;
  subscription_node_id?: string;
}

/**
 * Detects merchants that are likely subscriptions:
 * confirmed (has subscription node) + candidates (frequent, consistent low amounts).
 */
export function detectSubscriptionCandidates(graph: FinancialGraph): SubscriptionCandidate[] {
  const results: SubscriptionCandidate[] = [];
  const confirmedSubMerchants = new Set<string>();

  // First pass: confirmed subscriptions (merchant → subscription edges)
  for (const edge of graph.edges) {
    if (edge.relation !== 'is_subscription') continue;
    const subNode = graph.nodes.get(edge.to);
    const mNode   = graph.nodes.get(edge.from);
    if (!subNode || !mNode) continue;

    confirmedSubMerchants.add(edge.from);
    const subMeta = subNode.metadata as SubscriptionNodeMeta;
    results.push({
      merchant_id:              edge.from,
      name:                     mNode.label,
      estimated_amount:         subMeta.amount,
      visit_count:              (mNode.metadata as MerchantNodeMeta).visit_count,
      is_confirmed_subscription: true,
      subscription_node_id:     edge.to,
    });
  }

  // Second pass: candidates — merchants with ≥2 visits and < R$200 avg
  for (const node of graph.nodes.values()) {
    if (node.type !== 'merchant') continue;
    if (confirmedSubMerchants.has(node.id)) continue;

    const meta = node.metadata as MerchantNodeMeta;
    if (meta.visit_count < 2) continue;
    if (meta.avg_amount > 250) continue; // high-value merchants unlikely to be subs
    if (meta.avg_amount < 5)  continue;  // too small (parking, etc.)

    results.push({
      merchant_id:               node.id,
      name:                      meta.name,
      estimated_amount:          meta.avg_amount,
      visit_count:               meta.visit_count,
      is_confirmed_subscription: false,
    });
  }

  return results.sort((a, b) => (b.is_confirmed_subscription ? 1 : 0) - (a.is_confirmed_subscription ? 1 : 0));
}

// ─── Additional query helpers ─────────────────────────────────────────────────

/** Returns all nodes of a given type. */
export function getNodesByType(
  graph: FinancialGraph,
  type: FinancialGraphNode['type']
): FinancialGraphNode[] {
  return [...graph.nodes.values()].filter(n => n.type === type);
}

/** Returns all edges from a given node. */
export function getEdgesFrom(graph: FinancialGraph, nodeId: string): FinancialGraphEdge[] {
  return graph.edges.filter(e => e.from === nodeId);
}

/** Returns all edges pointing to a given node. */
export function getEdgesTo(graph: FinancialGraph, nodeId: string): FinancialGraphEdge[] {
  return graph.edges.filter(e => e.to === nodeId);
}

/** Returns immediate neighbors of a node (via outgoing edges). */
export function getNeighbors(graph: FinancialGraph, nodeId: string): FinancialGraphNode[] {
  return getEdgesFrom(graph, nodeId)
    .map(e => graph.nodes.get(e.to))
    .filter((n): n is FinancialGraphNode => Boolean(n));
}

/** Finds a path between two nodes (BFS, returns node ids or null). */
export function findPath(
  graph: FinancialGraph,
  fromId: string,
  toId: string,
  maxDepth = 5
): string[] | null {
  if (!graph.nodes.has(fromId) || !graph.nodes.has(toId)) return null;
  const queue: string[][] = [[fromId]];
  const visited = new Set<string>([fromId]);

  while (queue.length) {
    const path = queue.shift()!;
    const curr = path[path.length - 1];
    if (curr === toId) return path;
    if (path.length >= maxDepth) continue;

    for (const edge of graph.edges.filter(e => e.from === curr)) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push([...path, edge.to]);
      }
    }
  }
  return null;
}

// ─── PART 5 — AI-ready graph summary string ──────────────────────────────────

/**
 * Serialises the most relevant graph facts into a compact text block
 * suitable for injection into LLM prompts (AI CFO, Autopilot, Insight Generator).
 */
export function graphToAIContext(graph: FinancialGraph, maxMerchants = 8): string {
  const topMerchants  = getTopMerchants(graph, maxMerchants);
  const catSpending   = getCategorySpending(graph);
  const subCandidates = detectSubscriptionCandidates(graph);
  const confirmedSubs = subCandidates.filter(s => s.is_confirmed_subscription);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const merchantLines = topMerchants
    .map(m => `  • ${m.name}: ${fmt(m.total_spent)} (${m.visit_count}×)`)
    .join('\n');

  const categoryLines = catSpending
    .slice(0, 5)
    .map(c => `  • ${c.name}: ${fmt(c.total)} (${c.percentage}%) [${c.trend}]`)
    .join('\n');

  const subLines = confirmedSubs.length > 0
    ? confirmedSubs.map(s => `  • ${s.name}: ${fmt(s.estimated_amount)}/mês`).join('\n')
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
