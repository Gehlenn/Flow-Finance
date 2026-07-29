export type StoredConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
export type StoredBankProvider = 'mock' | 'pluggy' | 'belvo' | 'truelayer' | 'custom';
export type BankingConnectionStoreDriver = 'memory' | 'postgres' | 'firebase';

export interface StoredBankConnection {
  id: string;
  user_id: string;
  bank_name: string;
  bank_logo?: string;
  bank_color?: string;
  provider: StoredBankProvider;
  connection_status: StoredConnectionStatus;
  external_account_id?: string;
  account_type?: 'checking' | 'savings' | 'credit' | 'investment';
  balance?: number;
  last_sync?: string;
  error_message?: string;
  created_at: string;
}
