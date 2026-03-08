/**
 * TRANSACTION INTEGRITY — Idempotência e validação de transações
 *
 * Garante que transações não sejam duplicadas e sejam válidas.
 */

import { Transaction } from '../../types';

export interface TransactionHash {
  hash: string;
  transaction_id: string;
}

const processedHashes = new Set<string>();

/**
 * Gera hash único para uma transação baseado em amount, date, merchant, description.
 */
export function generateTransactionHash(tx: Transaction): string {
  const data = `${tx.amount}|${tx.date}|${tx.merchant || ''}|${tx.description || ''}`;
  // Simple hash for browser compatibility
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verifica se a transação já foi processada (idempotência).
 */
export function checkTransactionIdempotency(tx: Transaction): boolean {
  const hash = generateTransactionHash(tx);
  if (processedHashes.has(hash)) {
    return false; // duplicata
  }
  processedHashes.add(hash);
  return true;
}

/**
 * Valida integridade básica da transação.
 */
export function validateTransaction(tx: Transaction): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!tx.amount || tx.amount <= 0) {
    errors.push('Amount must be positive');
  }

  if (!tx.date) {
    errors.push('Date is required');
  }

  if (!tx.description) {
    errors.push('Description is required');
  }

  return { valid: errors.length === 0, errors };
}