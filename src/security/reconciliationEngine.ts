/**
 * RECONCILIATION ENGINE — Reconciliação de saldos
 *
 * Compara saldos armazenados com saldos calculados para detectar divergências.
 */

import { Transaction, TransactionType } from '../../types';
import { Account } from '../../models/Account';
import { sumTransactions } from './moneyMath';
import { logAuditEvent } from './auditLogService';

export interface ReconciliationResult {
  account_id: string;
  stored_balance: number;
  calculated_balance: number;
  difference: number;
  is_reconciled: boolean;
  transactions_count: number;
}

/**
 * Reconcilia o saldo de uma conta.
 */
export function reconcileAccountBalance(
  account: Account,
  transactions: Transaction[]
): ReconciliationResult {
  // Filtrar transações da conta
  const accountTxs = transactions.filter(tx => tx.account_id === account.id);

  // Calcular saldo baseado em transações
  const initialBalance = account.balance; // assumir que account.balance é o saldo inicial
  const inflows = accountTxs
    .filter(tx => tx.type === TransactionType.RECEITA)
    .map(tx => tx.amount);
  const outflows = accountTxs
    .filter(tx => tx.type === TransactionType.DESPESA)
    .map(tx => tx.amount);

  const totalInflows = sumTransactions(inflows);
  const totalOutflows = sumTransactions(outflows);
  const calculatedBalance = initialBalance + totalInflows - totalOutflows;

  const difference = account.balance - calculatedBalance;
  const isReconciled = Math.abs(difference) < 0.01; // tolerância de 1 centavo

  if (!isReconciled) {
    logAuditEvent('reconciliation_mismatch', 'account', account.id, {
      stored_balance: account.balance,
      calculated_balance: calculatedBalance,
      difference,
    });
  }

  return {
    account_id: account.id,
    stored_balance: account.balance,
    calculated_balance: calculatedBalance,
    difference,
    is_reconciled: isReconciled,
    transactions_count: accountTxs.length,
  };
}