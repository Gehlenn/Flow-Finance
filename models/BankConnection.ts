export type ConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
export type BankProvider = 'mock' | 'pluggy' | 'belvo' | 'truelayer' | 'custom';

export interface BankConnection {
  id: string;
  user_id: string;
  bank_name: string;
  bank_logo?: string;          // URL ou emoji fallback
  bank_color?: string;         // Cor primária do banco (#hex)
  provider: BankProvider;      // Qual provedor de API usou para conectar
  connection_status: ConnectionStatus;
  external_account_id?: string; // ID da conta no provedor externo
  account_type?: 'checking' | 'savings' | 'credit' | 'investment';
  balance?: number;             // Último saldo sincronizado
  last_sync?: string;           // ISO timestamp da última sincronização
  error_message?: string;       // Mensagem de erro se status = 'error'
  created_at: string;
}

// ─── Bank catalog (pode crescer com futuros providers) ────────────────────────

export interface BankOption {
  id: string;
  name: string;
  logo: string;       // emoji fallback
  color: string;
  provider: BankProvider;
  country: string;
}

export const BRAZILIAN_BANKS: BankOption[] = [
  { id: 'nubank',       name: 'Nubank',             logo: '🟣', color: '#8A05BE', provider: 'mock', country: 'BR' },
  { id: 'itau',         name: 'Itaú',               logo: '🟠', color: '#EC7000', provider: 'mock', country: 'BR' },
  { id: 'bradesco',     name: 'Bradesco',            logo: '🔴', color: '#CC0000', provider: 'mock', country: 'BR' },
  { id: 'santander',    name: 'Santander',           logo: '🔴', color: '#EC0000', provider: 'mock', country: 'BR' },
  { id: 'bb',           name: 'Banco do Brasil',     logo: '🟡', color: '#FBBD01', provider: 'mock', country: 'BR' },
  { id: 'caixa',        name: 'Caixa Econômica',     logo: '🔵', color: '#0070AF', provider: 'mock', country: 'BR' },
  { id: 'inter',        name: 'Banco Inter',         logo: '🟠', color: '#FF7A00', provider: 'mock', country: 'BR' },
  { id: 'c6',           name: 'C6 Bank',             logo: '⚫', color: '#242424', provider: 'mock', country: 'BR' },
  { id: 'picpay',       name: 'PicPay',              logo: '🟢', color: '#21C25E', provider: 'mock', country: 'BR' },
  { id: 'xp',           name: 'XP Investimentos',    logo: '⚫', color: '#1F1F1F', provider: 'mock', country: 'BR' },
];

// ─── Sync result ──────────────────────────────────────────────────────────────

export interface SyncResult {
  connection_id: string;
  transactions_imported: number;
  balance_updated: boolean;
  new_balance?: number;
  synced_at: string;
  error?: string;
}
