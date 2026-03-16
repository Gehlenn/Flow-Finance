export interface NormalizedImportedTransaction {
  amount: number;
  date: string;
  description: string;
  merchant: string;
  source: 'import';
}

export function normalizeImportedTransaction(tx: Record<string, unknown>): NormalizedImportedTransaction {
  const amount = Number(tx.amount ?? 0);
  const parsedDate = new Date(String(tx.date ?? ''));

  return {
    amount: Number.isFinite(amount) ? amount : 0,
    date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
    description: String(tx.description ?? '').trim(),
    merchant: String(tx.merchant ?? '').trim(),
    source: 'import',
  };
}
