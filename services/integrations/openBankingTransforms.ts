import { Category, Transaction, TransactionType } from '../../types';
import { normalizeFromIntegration, draftToTransaction } from '../../src/domain/intakeNormalizer';
import { RawBankTransaction } from './mockBankProvider';

export interface BackendBankSyncTransaction {
  id?: string;
  amount?: number;
  date?: string;
  description?: string;
  account_id?: string;
  external_reference?: string;
  confidence_score?: number;
}

export interface BackendBankSyncResponse {
  connection_id: string;
  transactions_imported: number;
  balance_updated: boolean;
  new_balance?: number;
  synced_at: string;
  error?: string;
  transactions?: BackendBankSyncTransaction[];
}

export interface ParsedImportTransaction {
  raw_date: string;
  raw_amount: number;
  raw_description: string;
  raw_type: TransactionType;
  category?: Category;
  merchant?: string;
  type?: TransactionType;
  confidence?: number;
  selected?: boolean;
  id?: string;
  account_id?: string;
  external_reference: string;
}

export interface NormalizedBankDraft {
  id?: string;
  amount?: number;
  type?: TransactionType;
  category?: Category;
  description?: string;
  date?: string;
  merchant?: string;
  account_id?: string;
  confidence_score?: number;
  external_reference?: string;
}

export function mapToTransaction(raw: RawBankTransaction, accountId?: string): Partial<Transaction> & {
  raw_description: string;
  raw_amount: number;
  raw_date: string;
  raw_type: TransactionType;
  selected: boolean;
  external_reference: string;
} {
  const isCredit = raw.amount > 0;
  return {
    raw_description: raw.description,
    raw_amount: Math.abs(raw.amount),
    raw_date: new Date(raw.date).toISOString(),
    raw_type: isCredit ? TransactionType.RECEITA : TransactionType.DESPESA,
    merchant: raw.merchant,
    type: isCredit ? TransactionType.RECEITA : TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: raw.description,
    amount: Math.abs(raw.amount),
    date: new Date(raw.date).toISOString(),
    account_id: accountId,
    selected: true,
    confidence_score: 0.5,
    external_reference: raw.id,
  };
}

export function normalizeBankTransactionsFromDraft(input: NormalizedBankDraft[]): Partial<Transaction>[] {
  return input
    .filter((item): item is NormalizedBankDraft & { amount: number } => typeof item.amount === 'number' && Number.isFinite(item.amount))
    .map((item, index) => {
      const rawAmount = item.amount;
      const normalizedAmount = Math.abs(rawAmount);

      const explicitType = typeof item.type === 'string' ? item.type.toLowerCase() : '';
      const type = explicitType === String(TransactionType.RECEITA).toLowerCase() || explicitType === 'income'
        ? TransactionType.RECEITA
        : explicitType === String(TransactionType.DESPESA).toLowerCase() || explicitType === 'expense'
          ? TransactionType.DESPESA
          : rawAmount >= 0
            ? TransactionType.RECEITA
            : TransactionType.DESPESA;

      const category = Object.values(Category).includes(item.category as Category)
        ? (item.category as Category)
        : undefined;

      const draft = normalizeFromIntegration({
        externalReference: String(item.external_reference ?? item.id ?? `bank_tx_${index}`),
        amount: normalizedAmount,
        occurredAt: item.date ?? new Date().toISOString(),
        description: item.description ?? item.merchant ?? 'Transacao bancaria sincronizada',
        type,
        category,
      });

      if (typeof item.account_id === 'string') {
        draft.accountId = item.account_id;
      }

      const tx = draftToTransaction(draft) as Partial<Transaction>;

      if (typeof item.merchant === 'string') {
        tx.merchant = item.merchant;
      }

      if (typeof item.category === 'string' && !category && Object.values(Category).includes(item.category as Category)) {
        tx.category = item.category as Category;
      }

      if (typeof item.confidence_score === 'number') {
        tx.confidence_score = item.confidence_score;
      }

      return tx;
    });
}

