import type { StoredBankConnection, StoredBankProvider, StoredConnectionStatus } from './bankingConnectionStoreTypes';

export function parseBankingConnectionStoreDriver(driver?: string): 'memory' | 'postgres' | 'firebase' | null {
  const normalized = String(driver || '').toLowerCase();
  if (normalized === 'memory' || normalized === 'postgres' || normalized === 'firebase') {
    return normalized;
  }
  return null;
}

export function mapBankingConnectionRow(row: Record<string, unknown>): StoredBankConnection {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    bank_name: String(row.bank_name),
    bank_logo: typeof row.bank_logo === 'string' ? row.bank_logo : undefined,
    bank_color: typeof row.bank_color === 'string' ? row.bank_color : undefined,
    provider: String(row.provider) as StoredBankProvider,
    connection_status: String(row.connection_status) as StoredConnectionStatus,
    external_account_id: typeof row.external_account_id === 'string' ? row.external_account_id : undefined,
    account_type: typeof row.account_type === 'string' ? row.account_type as StoredBankConnection['account_type'] : undefined,
    balance: row.balance === null || row.balance === undefined ? undefined : Number(row.balance),
    last_sync: row.last_sync ? new Date(String(row.last_sync)).toISOString() : undefined,
    error_message: typeof row.error_message === 'string' ? row.error_message : undefined,
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

export function listUserIdsWithConnectionsFromRows(rows: Array<{ user_id?: unknown }>): string[] {
  return rows
    .map((row) => (typeof row.user_id === 'string' ? row.user_id : null))
    .filter((value): value is string => Boolean(value));
}
