import { Transaction } from '../../types';
import { Account } from '../../models/Account';
import { makeCacheKey } from './financialGraphHelpers';
import { assembleFinancialGraph } from './financialGraphBuild';
import type { FinancialGraph } from './financialGraphTypes';

export type { FinancialGraph } from './financialGraphTypes';

let _graphCache: FinancialGraph | null = null;
let _cacheKey = '';

export function getGraphCache(): FinancialGraph | null {
  return _graphCache;
}

export function invalidateGraphCache(): void {
  _graphCache = null;
  _cacheKey = '';
}

export function buildFinancialGraph(
  userId: string,
  accounts: Account[],
  transactions: Transaction[],
): FinancialGraph {
  const baseTxs = transactions.filter((transaction) => !transaction.generated);
  const cacheKey = makeCacheKey(userId, baseTxs.length, accounts.length);

  if (_graphCache && _cacheKey === cacheKey) {
    return _graphCache;
  }

  const graph = assembleFinancialGraph(userId, accounts, transactions);
  _graphCache = graph;
  _cacheKey = cacheKey;
  return graph;
}

export * from './financialGraphQueries';
