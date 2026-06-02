import { Transaction, TransactionType } from '../../types';
import { Account } from '../../models/Account';
import {
  FinancialGraphNode,
  MerchantNodeMeta,
  CategoryNodeMeta,
  SubscriptionNodeMeta,
} from '../../models/FinancialGraphNode';
import { FinancialGraphEdge } from '../../models/FinancialGraphEdge';
import { detectSubscriptions } from './subscriptionDetector';
import { formatGraphDateOnly, nodeId, parseGraphDate } from './financialGraphHelpers';
import type { FinancialGraph } from './financialGraphTypes';

type MerchantAggregate = {
  total: number;
  count: number;
  dates: string[];
  categories: string[];
};

type CategoryAggregate = {
  total: number;
  count: number;
};

function buildGraphStats(nodes: Map<string, FinancialGraphNode>, edges: FinancialGraphEdge[], userId: string): FinancialGraph {
  return {
    nodes,
    edges,
    built_at: new Date().toISOString(),
    user_id: userId,
    stats: {
      node_count: nodes.size,
      edge_count: edges.length,
      merchant_count: [...nodes.values()].filter((n) => n.type === 'merchant').length,
      category_count: [...nodes.values()].filter((n) => n.type === 'category').length,
      subscription_count: [...nodes.values()].filter((n) => n.type === 'subscription').length,
      transaction_count: [...nodes.values()].filter((n) => n.type === 'transaction').length,
    },
  };
}

export function assembleFinancialGraph(
  userId: string,
  accounts: Account[],
  transactions: Transaction[],
): FinancialGraph {
  const baseTxs = transactions.filter((transaction) => !transaction.generated);
  const nodes = new Map<string, FinancialGraphNode>();
  const edges: FinancialGraphEdge[] = [];

  const userNodeId = nodeId('user', userId);
  nodes.set(userNodeId, {
    id: userNodeId,
    type: 'user',
    label: 'Usuário',
    metadata: { user_id: userId },
  });

  for (const account of accounts) {
    const accountNodeId = nodeId('account', account.id);
    nodes.set(accountNodeId, {
      id: accountNodeId,
      type: 'account',
      label: account.name,
      metadata: {
        account_id: account.id,
        account_type: account.type,
        balance: account.balance,
        currency: 'BRL',
      },
    });
    edges.push({ from: userNodeId, to: accountNodeId, relation: 'owns', weight: account.balance });
  }

  const merchantAgg: Record<string, MerchantAggregate> = {};
  const categoryAgg: Record<string, CategoryAggregate> = {};
  const categoryPrev: Record<string, number> = {};

  const now = Date.now();
  const cut30 = now - 30 * 86400000;
  const cut60 = now - 60 * 86400000;

  for (const tx of baseTxs) {
    if (tx.type !== TransactionType.DESPESA) continue;
    const txDate = parseGraphDate(tx.date)?.getTime();
    if (txDate === undefined) continue;

    const catKey = tx.category ?? 'Outros';
    if (!categoryAgg[catKey]) categoryAgg[catKey] = { total: 0, count: 0 };
    categoryAgg[catKey].total += tx.amount;
    categoryAgg[catKey].count += 1;

    if (txDate >= cut60 && txDate < cut30) {
      categoryPrev[catKey] = (categoryPrev[catKey] ?? 0) + tx.amount;
    }

    const merchant = (tx.merchant ?? '').trim() || tx.description?.split(' ').slice(0, 3).join(' ');
    if (!merchant) continue;

    const merchantKey = merchant.toLowerCase();
    if (!merchantAgg[merchantKey]) {
      merchantAgg[merchantKey] = { total: 0, count: 0, dates: [], categories: [] };
    }
    merchantAgg[merchantKey].total += tx.amount;
    merchantAgg[merchantKey].count += 1;
    merchantAgg[merchantKey].dates.push(tx.date);
    if (!merchantAgg[merchantKey].categories.includes(catKey)) {
      merchantAgg[merchantKey].categories.push(catKey);
    }
  }

  const totalCategoryAmount = Object.values(categoryAgg).reduce((sum, value) => sum + value.total, 0);

  for (const [categoryName, aggregate] of Object.entries(categoryAgg)) {
    const categoryNodeId = nodeId('category', categoryName);
    const previousAmount = categoryPrev[categoryName] ?? 0;
    const trend: CategoryNodeMeta['trend'] =
      previousAmount === 0
        ? 'stable'
        : aggregate.total > previousAmount * 1.05
          ? 'up'
          : aggregate.total < previousAmount * 0.95
            ? 'down'
            : 'stable';

    const meta: CategoryNodeMeta = {
      name: categoryName,
      total_amount: aggregate.total,
      transaction_count: aggregate.count,
      percentage_of_total: totalCategoryAmount > 0 ? Math.round((aggregate.total / totalCategoryAmount) * 1000) / 10 : 0,
      trend,
    };

    nodes.set(categoryNodeId, {
      id: categoryNodeId,
      type: 'category',
      label: categoryName,
      metadata: meta,
    });
  }

  for (const [merchantKey, aggregate] of Object.entries(merchantAgg)) {
    const merchantNodeId = nodeId('merchant', merchantKey);
    const sortedDates = [...aggregate.dates].sort((leftDate, rightDate) => {
      const left = parseGraphDate(leftDate);
      const right = parseGraphDate(rightDate);
      if (!left && !right) return leftDate.localeCompare(rightDate);
      if (!left) return -1;
      if (!right) return 1;
      return left.getTime() - right.getTime();
    });

    const meta: MerchantNodeMeta = {
      name: merchantKey,
      total_spent: aggregate.total,
      visit_count: aggregate.count,
      avg_amount: aggregate.total / aggregate.count,
      last_seen: (() => {
        const lastDate = sortedDates[sortedDates.length - 1];
        const parsed = lastDate ? parseGraphDate(lastDate) : null;
        return parsed ? formatGraphDateOnly(parsed) : '';
      })(),
      category_hint: aggregate.categories[0],
    };

    nodes.set(merchantNodeId, {
      id: merchantNodeId,
      type: 'merchant',
      label: merchantKey,
      metadata: meta,
    });

    for (const category of aggregate.categories) {
      const categoryNodeId = nodeId('category', category);
      if (nodes.has(categoryNodeId)) {
        edges.push({
          from: merchantNodeId,
          to: categoryNodeId,
          relation: 'same_category',
          weight: aggregate.total,
        });
      }
    }
  }

  for (const tx of baseTxs) {
    const txNodeId = nodeId('transaction', tx.id);
    const merchant = (tx.merchant ?? '').trim() || tx.description?.split(' ').slice(0, 3).join(' ');
    const category = tx.category ?? 'Outros';

    nodes.set(txNodeId, {
      id: txNodeId,
      type: 'transaction',
      label: tx.description ?? 'Transação',
      metadata: {
        transaction_id: tx.id,
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        category,
        merchant: merchant || undefined,
        source: tx.source,
      },
    });

    const accountNodeId = tx.account_id
      ? nodeId('account', tx.account_id)
      : (accounts[0] ? nodeId('account', accounts[0].id) : null);

    if (accountNodeId && nodes.has(accountNodeId)) {
      edges.push({
        from: accountNodeId,
        to: txNodeId,
        relation: 'has_transaction',
        weight: tx.amount,
      });
    }

    if (merchant) {
      const merchantNodeId = nodeId('merchant', merchant.toLowerCase());
      if (nodes.has(merchantNodeId)) {
        edges.push({ from: txNodeId, to: merchantNodeId, relation: 'paid_to', weight: tx.amount });
      }
    }

    const categoryNodeId = nodeId('category', category);
    if (nodes.has(categoryNodeId)) {
      edges.push({ from: txNodeId, to: categoryNodeId, relation: 'belongs_to', weight: tx.amount });
    }
  }

  const subscriptionSummary = detectSubscriptions(baseTxs);
  for (const subscription of subscriptionSummary.subscriptions) {
    const subscriptionNodeId = nodeId('subscription', subscription.id);
    const meta: SubscriptionNodeMeta = {
      name: subscription.name,
      amount: subscription.amount,
      cycle: subscription.cycle,
      last_charge: subscription.last_charge,
      next_expected: subscription.next_expected,
      total_spent: subscription.total_spent,
      logo: subscription.logo,
    };

    nodes.set(subscriptionNodeId, {
      id: subscriptionNodeId,
      type: 'subscription',
      label: subscription.name,
      metadata: meta,
    });

    const merchantNodeId = nodeId('merchant', subscription.merchant.toLowerCase());
    if (nodes.has(merchantNodeId)) {
      edges.push({
        from: merchantNodeId,
        to: subscriptionNodeId,
        relation: 'is_subscription',
        weight: subscription.amount,
      });
    }
  }

  const txByDay: Record<string, string[]> = {};
  for (const tx of baseTxs) {
    if (tx.type !== TransactionType.DESPESA) continue;
    const parsedDate = parseGraphDate(tx.date);
    if (!parsedDate) continue;
    const dayKey = formatGraphDateOnly(parsedDate);
    const merchant = (tx.merchant ?? '').trim() || tx.description?.split(' ').slice(0, 3).join(' ');
    if (!merchant) continue;
    const merchantNodeId = nodeId('merchant', merchant.toLowerCase());
    if (!txByDay[dayKey]) txByDay[dayKey] = [];
    if (!txByDay[dayKey].includes(merchantNodeId)) txByDay[dayKey].push(merchantNodeId);
  }

  const coOccCount: Record<string, number> = {};
  for (const merchantNodeIds of Object.values(txByDay)) {
    if (merchantNodeIds.length < 2) continue;
    for (let i = 0; i < merchantNodeIds.length; i += 1) {
      for (let j = i + 1; j < merchantNodeIds.length; j += 1) {
        const key = [merchantNodeIds[i], merchantNodeIds[j]].sort().join('||');
        coOccCount[key] = (coOccCount[key] ?? 0) + 1;
      }
    }
  }

  for (const [key, count] of Object.entries(coOccCount)) {
    if (count < 2) continue;
    const [from, to] = key.split('||');
    if (nodes.has(from) && nodes.has(to)) {
      edges.push({ from, to, relation: 'co_occurs', weight: count });
    }
  }

  return buildGraphStats(nodes, edges, userId);
}
