import { timingSafeEqual } from 'node:crypto';
import logger from '../config/logger';
import env from '../config/env';
import {
  createBankingConnectionStore,
  migrateConnectionsBetweenStores,
  type StoredBankConnection,
} from '../services/openFinance/bankingConnectionStore';
import { PluggyClient } from '../services/openFinance/pluggyClient';
import { isPluggyProviderEnabled, isSupportedOpenFinanceProvider } from '../services/openFinance/providerMode';

export type ConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
export type BankProvider = 'mock' | 'pluggy' | 'belvo' | 'truelayer' | 'custom';

export interface BankCatalogItem {
  id: string;
  name: string;
  logo: string;
  color: string;
  provider: BankProvider;
  country: string;
}

export type BankConnection = StoredBankConnection;

export interface SyncResult {
  connection_id: string;
  transactions_imported: number;
  balance_updated: boolean;
  new_balance?: number;
  synced_at: string;
  transactions?: Array<{
    amount: number;
    type: 'Receita' | 'Despesa';
    category: 'Pessoal' | 'Trabalho' | 'Negócio' | 'Investimento';
    description: string;
    date: string;
    merchant?: string;
    source: 'import';
    confidence_score: number;
  }>;
  error?: string;
}

export interface PluggyWebhookPayload {
  event?: string;
  type?: string;
  itemId?: string;
  item?: {
    id?: string;
    status?: string;
    connector?: {
      id?: number;
      name?: string;
      imageUrl?: string;
      primaryColor?: string;
    };
  };
  data?: {
    itemId?: string;
    item?: {
      id?: string;
      status?: string;
    };
    transactionId?: string;
  };
  [key: string]: unknown;
}

export const BRAZILIAN_BANKS: BankCatalogItem[] = [
  { id: 'nubank', name: 'Nubank', logo: '🟣', color: '#8A05BE', provider: 'mock', country: 'BR' },
  { id: 'itau', name: 'Itaú', logo: '🟠', color: '#EC7000', provider: 'mock', country: 'BR' },
  { id: 'bradesco', name: 'Bradesco', logo: '🔴', color: '#CC0000', provider: 'mock', country: 'BR' },
  { id: 'santander', name: 'Santander', logo: '🔴', color: '#EC0000', provider: 'mock', country: 'BR' },
  { id: 'bb', name: 'Banco do Brasil', logo: '🟡', color: '#FBBD01', provider: 'mock', country: 'BR' },
  { id: 'caixa', name: 'Caixa Econômica', logo: '🔵', color: '#0070AF', provider: 'mock', country: 'BR' },
  { id: 'inter', name: 'Banco Inter', logo: '🟠', color: '#FF7A00', provider: 'mock', country: 'BR' },
  { id: 'c6', name: 'C6 Bank', logo: '⚫', color: '#242424', provider: 'mock', country: 'BR' },
  { id: 'picpay', name: 'PicPay', logo: '🟢', color: '#21C25E', provider: 'mock', country: 'BR' },
  { id: 'xp', name: 'XP Investimentos', logo: '⚫', color: '#1F1F1F', provider: 'mock', country: 'BR' },
];

export const bankingConnectionStore = createBankingConnectionStore();
export const pluggyClient = new PluggyClient();

export function stringsEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function randomBalance(): number {
  return Number((2500 + Math.random() * 7000).toFixed(2));
}

export function randomTransactionCount(days: number): number {
  const base = Math.max(2, Math.round(days * 0.3));
  return Math.min(base + Math.floor(Math.random() * 8), 120);
}

export function isPluggyEnabled(): boolean {
  const provider = String(env.OPEN_FINANCE_PROVIDER || 'mock').toLowerCase();

  if (!isSupportedOpenFinanceProvider(provider)) {
    logger.warn({ provider }, 'Unsupported OPEN_FINANCE_PROVIDER value. Falling back to mock behavior');
  }

  return isPluggyProviderEnabled(provider);
}

export function parseConnectorMap(): Record<string, number> {
  if (!env.PLUGGY_BANK_CONNECTORS) {
    return {};
  }

  try {
    const parsed = JSON.parse(env.PLUGGY_BANK_CONNECTORS) as Record<string, number>;
    return parsed || {};
  } catch (err) {
    logger.warn({
      err,
      envVar: 'PLUGGY_BANK_CONNECTORS',
      rawLength: env.PLUGGY_BANK_CONNECTORS.length,
      fallback: 'pluggy-bank-connectors-parse-failed',
    }, 'Failed to parse PLUGGY_BANK_CONNECTORS environment variable');
    return {};
  }
}

export function parseDefaultCredentials(): Record<string, unknown> | null {
  if (!env.PLUGGY_DEFAULT_CREDENTIALS_JSON) {
    return null;
  }

  try {
    const parsed = JSON.parse(env.PLUGGY_DEFAULT_CREDENTIALS_JSON) as Record<string, unknown>;
    return parsed || null;
  } catch (err) {
    logger.warn({
      err,
      envVar: 'PLUGGY_DEFAULT_CREDENTIALS_JSON',
      rawLength: env.PLUGGY_DEFAULT_CREDENTIALS_JSON.length,
      fallback: 'pluggy-default-credentials-parse-failed',
    }, 'Failed to parse PLUGGY_DEFAULT_CREDENTIALS_JSON environment variable');
    return null;
  }
}

export function buildWorkspaceScopedStorageKey(userId: string, workspaceId: string): string {
  return `${workspaceId}::${userId}`;
}

export function parseWorkspaceScopedStorageKey(scopeKey: string): { workspaceId?: string; userId: string } {
  const separatorIndex = scopeKey.indexOf('::');
  if (separatorIndex === -1) {
    logger.warn({
      scopeKey,
      fallback: 'banking-scoped-storage-key-parse-failed',
    }, 'Malformed workspace scoped storage key encountered');
    return { userId: scopeKey };
  }

  const workspaceId = scopeKey.slice(0, separatorIndex);
  const userId = scopeKey.slice(separatorIndex + 2);
  if (!workspaceId || !userId) {
    logger.warn({
      scopeKey,
      fallback: 'banking-scoped-storage-key-parse-failed',
    }, 'Incomplete workspace scoped storage key encountered');
  }

  return { workspaceId, userId };
}

export function toExternalConnection(connection: BankConnection): BankConnection {
  const parsed = parseWorkspaceScopedStorageKey(connection.user_id);
  return {
    ...connection,
    user_id: parsed.userId,
  };
}

export async function getConnectionsForUserAsync(userId: string): Promise<BankConnection[]> {
  return bankingConnectionStore.getConnectionsForUser(userId);
}

export async function setConnectionsForUser(userId: string, connections: BankConnection[]): Promise<void> {
  await bankingConnectionStore.setConnectionsForUser(userId, connections);
}

export async function findConnectionsByExternalItemId(itemId: string): Promise<Array<{ storageUserId: string; userId: string; connection: BankConnection }>> {
  const matches = await bankingConnectionStore.findConnectionsByExternalItemId(itemId);
  return matches.map((match) => ({
    storageUserId: match.userId,
    userId: parseWorkspaceScopedStorageKey(match.userId).userId,
    connection: toExternalConnection(match.connection),
  }));
}

export async function countUsersWithConnections(): Promise<number> {
  return bankingConnectionStore.countUsersWithConnections();
}

export function mapPluggyConnectionStatus(status?: string): ConnectionStatus {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'UPDATED') return 'connected';
  if (normalized === 'DELETED') return 'disconnected';
  if (normalized.includes('ERROR') || normalized === 'OUTDATED') return 'error';
  if (normalized.includes('WAITING') || normalized.includes('LOGIN') || normalized === 'UPDATING' || normalized === 'CREATED') {
    return 'syncing';
  }

  return 'syncing';
}

export function extractWebhookEventName(payload: PluggyWebhookPayload): string {
  return String(payload.event || payload.type || 'unknown');
}

export function extractWebhookItemId(payload: PluggyWebhookPayload): string | null {
  const candidates = [
    payload.itemId,
    payload.item?.id,
    payload.data?.itemId,
    payload.data?.item?.id,
  ];

  const found = candidates.find((value) => typeof value === 'string' && value.length > 0);
  return found || null;
}

export function mapPluggyAccountType(type: string): 'checking' | 'savings' | 'credit' | 'investment' {
  const normalized = type.toUpperCase();
  if (normalized.includes('CREDIT')) return 'credit';
  if (normalized.includes('INVEST')) return 'investment';
  if (normalized.includes('SAVINGS')) return 'savings';
  return 'checking';
}

export function generateMockTransactions(count: number): SyncResult['transactions'] {
  const merchants = ['Uber', 'iFood', 'Mercado', 'Farmácia', 'Padaria', 'Salário', 'Pix Recebido'];
  return Array.from({ length: count }).map((_, idx) => {
    const income = idx % 7 === 0;
    const merchant = merchants[idx % merchants.length];
    const amount = income ? Number((1200 + Math.random() * 2200).toFixed(2)) : Number((20 + Math.random() * 380).toFixed(2));
    return {
      amount,
      type: income ? 'Receita' : 'Despesa',
      category: income ? 'Negócio' : 'Pessoal',
      description: income ? `${merchant} - crédito` : `${merchant} - débito`,
      date: new Date(Date.now() - idx * 86400000).toISOString(),
      merchant,
      source: 'import' as const,
      confidence_score: 0.9,
    };
  });
}

export function assertConnectionOwnership(
  connection: BankConnection,
  userId: string,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): boolean {
  if (connection.user_id !== userId) {
    res.status(403).json({ message: 'Access to this connection is forbidden' });
    return false;
  }
  return true;
}

export function resolveAuthenticatedUserId(
  req: { userId?: string },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  candidateUserId?: string,
): string | null {
  const authenticatedUserId = req.userId;

  if (!authenticatedUserId) {
    res.status(401).json({ message: 'Authenticated user is required' });
    return null;
  }

  if (candidateUserId && candidateUserId !== authenticatedUserId) {
    res.status(403).json({ message: 'Authenticated user does not match requested userId' });
    return null;
  }

  return authenticatedUserId;
}

export function getWorkspaceIdFromRequest(req: { workspaceId?: string }): string | null {
  return typeof req.workspaceId === 'string' && req.workspaceId.length > 0 ? req.workspaceId : null;
}

export function isPluggyContextReady(): boolean {
  return isPluggyEnabled() && Boolean(env.PLUGGY_CLIENT_ID && env.PLUGGY_CLIENT_SECRET);
}

export async function markConnectionsAsError(itemId: string, message: string): Promise<void> {
  const matches = await findConnectionsByExternalItemId(itemId);

  for (const match of matches) {
    const current = await getConnectionsForUserAsync(match.storageUserId);
    const idx = current.findIndex((connection) => connection.id === match.connection.id);
    if (idx < 0) {
      continue;
    }

    const updated = [...current];
    updated[idx] = {
      ...updated[idx],
      connection_status: 'error',
      error_message: message,
      last_sync: new Date().toISOString(),
    };
    await setConnectionsForUser(match.storageUserId, updated);
  }
}

export async function refreshPluggyConnectionsByItemId(itemId: string, eventName: string): Promise<number> {
  const matches = await findConnectionsByExternalItemId(itemId);
  if (!matches.length) {
    return 0;
  }

  const item = await pluggyClient.getItem(itemId);
  const accounts = await pluggyClient.getAccounts(itemId);
  const primaryAccount = accounts[0];
  const nextStatus = mapPluggyConnectionStatus(item.status);
  const nextErrorMessage = nextStatus === 'error' ? `Pluggy status: ${item.status}` : undefined;
  const shouldUpdateLastSync = nextStatus === 'connected' || eventName.toLowerCase().includes('transaction');

  for (const match of matches) {
    const current = await getConnectionsForUserAsync(match.storageUserId);
    const idx = current.findIndex((connection) => connection.id === match.connection.id);
    if (idx < 0) {
      continue;
    }

    const updated = [...current];
    updated[idx] = {
      ...updated[idx],
      bank_name: item.connector?.name || updated[idx].bank_name,
      bank_logo: item.connector?.imageUrl || updated[idx].bank_logo,
      bank_color: item.connector?.primaryColor || updated[idx].bank_color,
      connection_status: nextStatus,
      account_type: primaryAccount ? mapPluggyAccountType(primaryAccount.type) : updated[idx].account_type,
      balance: primaryAccount?.balance ?? updated[idx].balance,
      last_sync: shouldUpdateLastSync ? new Date().toISOString() : updated[idx].last_sync,
      error_message: nextErrorMessage,
    };
    await setConnectionsForUser(match.storageUserId, updated);
  }

  return matches.length;
}

export async function getPluggyConnectToken(workspaceId: string, clientUserId: string): Promise<{ accessToken: string }> {
  return pluggyClient.createConnectToken(`${workspaceId}::${clientUserId}`);
}

export async function migrateWorkspaceConnectionsToFirebase(workspaceScopedUserIds: string[]): Promise<{
  sourceDriver: string;
  targetDriver: string;
  migratedUsers: number;
  migratedConnections: number;
  totalUserConnectionsInFirebase: number;
}> {
  const sourceStatus = await bankingConnectionStore.getStatus();
  const targetStore = createBankingConnectionStore({ driver: 'firebase' });
  const targetStatus = await targetStore.getStatus();

  if (!targetStatus.ready) {
    return {
      sourceDriver: sourceStatus.driver,
      targetDriver: targetStatus.driver,
      migratedUsers: 0,
      migratedConnections: 0,
      totalUserConnectionsInFirebase: 0,
    };
  }

  const result = await migrateConnectionsBetweenStores(bankingConnectionStore, targetStore, workspaceScopedUserIds);
  const totalUserConnectionsInFirebase = (await targetStore.getConnectionsForUser(workspaceScopedUserIds[0] || '')).length;

  return {
    sourceDriver: sourceStatus.driver,
    targetDriver: targetStatus.driver,
    migratedUsers: result.migratedUsers,
    migratedConnections: result.migratedConnections,
    totalUserConnectionsInFirebase,
  };
}
