/**
 * OPEN BANKING SERVICE
 *
 * Orquestrador central para sincronização bancária.
 *
 * Pipeline de sync:
 *   connectBank → fetchAccounts → fetchTransactions
 *       ↓
 *   mapToTransactions (PART 4)
 *       ↓
 *   classifyWithAI (PART 5)
 *       ↓
 *   updateAccountBalance (PART 6)
 *       ↓
 *   emit bank_transactions_synced (PART 9)
 */

import { Transaction, TransactionType, Category } from '../../types';
import { Account } from '../../models/Account';
import { BankConnection, BankProvider, SyncResult, BRAZILIAN_BANKS } from '../../models/BankConnection';
import { getProvider, RawBankTransaction, ProviderKey } from './mockBankProvider';
import { FinancialEventEmitter } from '../../src/events/eventEngine';
import { classifyImportedTransactions } from '../../src/finance/importService';
import { normalizeFromIntegration, draftToTransaction } from '../../src/domain/intakeNormalizer';
import { learnMemory } from '../../src/ai/aiMemory';
import { makeId } from '../../utils/helpers';
import { API_ENDPOINTS, apiRequest, ApiRequestError } from '../../src/config/api.config';
import { getActiveWorkspaceScopedStorageKey } from '../../src/utils/workspaceStorage';

// ─── Storage ──────────────────────────────────────────────────────────────────

const CONNECTIONS_KEY = 'flow_bank_connections';

function readConnections(): BankConnection[] {
  try { return JSON.parse(localStorage.getItem(getActiveWorkspaceScopedStorageKey(CONNECTIONS_KEY)) || '[]'); }
  catch { return []; }
}

function writeConnections(conns: BankConnection[]): void {
  localStorage.setItem(getActiveWorkspaceScopedStorageKey(CONNECTIONS_KEY), JSON.stringify(conns));
}

function hasBackendBanking(): boolean {
  if (import.meta.env.MODE === 'test' && !import.meta.env.VITE_ENABLE_TEST_BACKEND_BANKING) {
    return false;
  }

  return Boolean(API_ENDPOINTS.BANKING.CONNECT);
}

function isLocalBankingFallbackEnabled(): boolean {
  if (import.meta.env.MODE === 'test') {
    return true;
  }

  return String(import.meta.env.VITE_ENABLE_LOCAL_BANKING_FALLBACK || '').toLowerCase() === 'true';
}

function isProductionRuntime(): boolean {
  return import.meta.env.MODE === 'production';
}

function getApiErrorStatus(error: unknown): number | null {
  const statusFromObject = (error as { statusCode?: unknown })?.statusCode;
  if (typeof statusFromObject === 'number') {
    return statusFromObject;
  }

  const message = String((error as any)?.message ?? '');
  const match = message.match(/API Error\s+(\d{3})/);
  return match ? Number(match[1]) : null;
}

function extractRequestId(error: unknown): string | null {
  if (error instanceof ApiRequestError && error.requestId) {
    return error.requestId;
  }

  const fromObject = (error as any)?.requestId;
  return typeof fromObject === 'string' && fromObject.trim() ? fromObject.trim() : null;
}

function collectErrorTokens(error: unknown, seen = new Set<unknown>()): string[] {
  if (error == null) return [];
  if (typeof error === 'string') return [error];
  if (typeof error !== 'object') return [String(error)];
  if (seen.has(error)) return [];
  seen.add(error);

  const tokens: string[] = [];
  const obj = error as Record<string, unknown>;

  for (const key of ['message', 'code', 'error', 'type']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      tokens.push(value);
    }
  }

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' || typeof value === 'string') {
      tokens.push(...collectErrorTokens(value, seen));
    }
  }

  return tokens;
}

export function mapPluggyConnectErrorMessage(error: unknown): string {
  const merged = collectErrorTokens(error).join(' ').toUpperCase();
  const requestId = extractRequestId(error);
  const suffix = requestId ? ` (requestId: ${requestId})` : '';

  if (merged.includes('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED')) {
    return `Sua credencial Pluggy esta em modo de teste. Use um conector sandbox ou solicite habilitacao de contas reais no painel da Pluggy.${suffix}`;
  }

  if (merged.includes('INVALID_CONNECT_TOKEN') || merged.includes('CONNECT_TOKEN')) {
    return `Token de conexao da Pluggy expirou ou e invalido. Atualize a tela e tente novamente.${suffix}`;
  }

  return `Conexao Pluggy cancelada ou invalida. Tente novamente.${suffix}`;
}

function shouldUseLocalMockFallback(error: unknown): boolean {
  if (!isLocalBankingFallbackEnabled()) {
    return false;
  }

  const status = getApiErrorStatus(error);

  // In production, do not mask backend failures with mock data.
  if (isProductionRuntime()) {
    return false;
  }

  // Client errors are deterministic and should be surfaced to the user.
  if (status !== null && status >= 400 && status < 500) {
    return false;
  }

  // Unknown errors and 5xx are eligible for local fallback in development.
  return true;
}

export interface BankingHealth {
  status: 'ok' | string;
  providerMode: string;
  pluggyConfigured: boolean;
  totalUsersWithConnections: number;
  timestamp: string;
}

export interface PluggyConnector {
  id: number;
  name: string;
  imageUrl?: string;
  primaryColor?: string;
  country?: string;
}

export async function getBankingHealth(): Promise<BankingHealth | null> {
  if (!hasBackendBanking()) return null;
  try {
    return await apiRequest<BankingHealth>(API_ENDPOINTS.BANKING.HEALTH, { method: 'GET', retries: 1 });
  } catch {
    return null;
  }
}

export async function listPluggyConnectors(): Promise<PluggyConnector[]> {
  if (!hasBackendBanking()) return [];
  try {
    return await apiRequest<PluggyConnector[]>(API_ENDPOINTS.BANKING.CONNECTORS, { method: 'GET', retries: 1 });
  } catch {
    return [];
  }
}

export async function createPluggyConnectToken(clientUserId?: string): Promise<string> {
  const response = await apiRequest<{ accessToken: string }>(API_ENDPOINTS.BANKING.CONNECT_TOKEN, {
    method: 'POST',
    body: JSON.stringify({}),
    retries: 1,
  });

  return response.accessToken;
}

export async function connectPluggyItem(
  bankId: string,
  userId: string,
  itemId: string,
): Promise<BankConnection> {
  const conn = await apiRequest<BankConnection>(API_ENDPOINTS.BANKING.CONNECT, {
    method: 'POST',
    body: JSON.stringify({ bankId, itemId }),
    retries: 1,
  });
  saveConnection(conn);
  return conn;
}


// ─── CRUD helpers ─────────────────────────────────────────────────────────────

export function getConnections(userId: string): BankConnection[] {
  return readConnections().filter(c => c.user_id === userId);
}

export async function reloadConnections(userId: string): Promise<BankConnection[]> {
  let local = getConnections(userId);

  if (isProductionRuntime()) {
    const cleanedLocal = local.filter((c) => c.provider !== 'mock');
    if (cleanedLocal.length !== local.length) {
      const otherUsers = readConnections().filter((c) => c.user_id !== userId);
      writeConnections([...otherUsers, ...cleanedLocal]);
      local = cleanedLocal;
    }
  }

  if (!hasBackendBanking()) {
    return isLocalBankingFallbackEnabled() ? local : [];
  }

  try {
    const remote = await apiRequest<BankConnection[]>(
      `${API_ENDPOINTS.BANKING.CONNECTIONS}?userId=${encodeURIComponent(userId)}`,
      { method: 'GET', retries: 0, silent: true },
    );

    const otherUsers = readConnections().filter((c) => c.user_id !== userId);
    writeConnections([...otherUsers, ...remote]);
    return remote;
  } catch {
    return local;
  }
}

export function getConnection(id: string): BankConnection | null {
  return readConnections().find(c => c.id === id) ?? null;
}

function saveConnection(conn: BankConnection): void {
  const all = readConnections();
  const idx = all.findIndex(c => c.id === conn.id);
  if (idx >= 0) all[idx] = conn; else all.push(conn);
  writeConnections(all);
}

function updateStatus(id: string, status: BankConnection['connection_status'], extra?: Partial<BankConnection>): void {
  const all = readConnections();
  const idx = all.findIndex(c => c.id === id);
  if (idx >= 0) writeConnections(all.map(c => c.id === id ? { ...c, connection_status: status, ...extra } : c));
}

// ─── PART 2 — connectBank ─────────────────────────────────────────────────────

export async function connectBank(
  bankId: string,
  userId: string
): Promise<BankConnection> {
  if (!hasBackendBanking() && !isLocalBankingFallbackEnabled()) {
    throw new Error('Open Banking backend indisponivel. Habilite o backend antes de conectar um banco.');
  }

  if (hasBackendBanking()) {
    try {
      const conn = await apiRequest<BankConnection>(API_ENDPOINTS.BANKING.CONNECT, {
        method: 'POST',
        body: JSON.stringify({ bankId }),
        retries: 1,
      });
      saveConnection(conn);
      return conn;
    } catch (error: unknown) {
      if (!shouldUseLocalMockFallback(error)) {
        throw error;
      }

      // Fallback to local mock flow
    }
  }

  const bankMeta = BRAZILIAN_BANKS.find(b => b.id === bankId);
  if (!bankMeta) throw new Error(`Banco "${bankId}" não encontrado no catálogo.`);

  const provider = getProvider(bankMeta.provider as ProviderKey);
  const { external_id } = await provider.connect(bankId, userId);

  const conn: BankConnection = {
    id: makeId(),
    user_id: userId,
    bank_name: bankMeta.name,
    bank_logo: bankMeta.logo,
    bank_color: bankMeta.color,
    provider: bankMeta.provider,
    connection_status: 'connected',
    external_account_id: external_id,
    created_at: new Date().toISOString(),
  };

  saveConnection(conn);

  // Aprender preferência de banco do usuário na AI Memory
  learnMemory(userId, `bank_${bankId}`, 'connected', 0.9).catch(e => {
    console.error('Erro ao registrar memória de conexão bancária:', e);
  });

  return conn;
}

// ─── PART 2 — disconnectBank ──────────────────────────────────────────────────

export async function disconnectBank(connectionId: string): Promise<void> {
  const conn = getConnection(connectionId);
  if (!conn) return;

  if (hasBackendBanking()) {
    try {
      await apiRequest<{ success: boolean }>(API_ENDPOINTS.BANKING.DISCONNECT, {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
        retries: 1,
      });
    } catch {
      // Fallback to local mock flow
    }
  }

  try {
    const provider = getProvider(conn.provider as ProviderKey);
    if (conn.external_account_id) {
      await provider.disconnect(conn.external_account_id);
    }
  } catch { /* silencioso — remover localmente mesmo assim */ }

  writeConnections(readConnections().filter(c => c.id !== connectionId));
}

// ─── PART 2 + 6 — syncAccounts ───────────────────────────────────────────────

export async function syncAccounts(
  connectionId: string,
  existingAccounts: Account[],
  onUpdateAccount: (acc: Account) => void
): Promise<void> {
  const conn = getConnection(connectionId);
  if (!conn || !conn.external_account_id) return;

  updateStatus(connectionId, 'syncing');

  try {
    const provider = getProvider(conn.provider as ProviderKey);
    const rawAccounts = await provider.fetchAccounts(conn.external_account_id);

    for (const raw of rawAccounts) {
      // PART 6 — Atualizar saldo da conta vinculada
      const linked = existingAccounts.find(a =>
        a.name.toLowerCase().includes(conn.bank_name.toLowerCase()) ||
        a.name.toLowerCase().includes('open banking') ||
        conn.bank_name.toLowerCase().includes(a.name.toLowerCase())
      );

      if (linked) {
        onUpdateAccount({ ...linked, balance: raw.balance });
      }

      // Atualizar saldo no registro da conexão
      updateStatus(connectionId, 'connected', { balance: raw.balance });
    }
  } catch (err: any) {
    updateStatus(connectionId, 'error', { error_message: err?.message ?? 'Erro ao sincronizar contas.' });
    throw err;
  }
}

// ─── PART 4 — mapToTransaction ────────────────────────────────────────────────

function mapToTransaction(raw: RawBankTransaction, accountId?: string): Partial<Transaction> & {
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
    raw_amount:      Math.abs(raw.amount),
    raw_date:        new Date(raw.date).toISOString(),
    raw_type:        isCredit ? TransactionType.RECEITA : TransactionType.DESPESA,
    merchant:        raw.merchant,
    // Campos que serão preenchidos pela AI classification:
    type:            isCredit ? TransactionType.RECEITA : TransactionType.DESPESA,
    category:        Category.PESSOAL,
    description:     raw.description,
    amount:          Math.abs(raw.amount),
    date:            new Date(raw.date).toISOString(),
    account_id:      accountId,
    selected:        true,
    confidence_score: 0.5,
    external_reference: raw.id,
  };
}

function normalizeBankTransactionsFromDraft(input: Array<Partial<Transaction>>): Partial<Transaction>[] {
  return input
    .filter((item) => typeof item.amount === 'number' && Number.isFinite(item.amount))
    .map((item, index) => {
      const rawAmount = item.amount as number;
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
        externalReference: String((item as Record<string, unknown>).external_reference ?? item.id ?? `bank_tx_${index}`),
        amount: normalizedAmount,
        occurredAt: item.date ?? new Date().toISOString(),
        description: item.description ?? item.merchant ?? 'Transacao bancaria sincronizada',
        type,
        category,
      });

      if (typeof (item as Record<string, unknown>).account_id === 'string') {
        draft.accountId = (item as Record<string, unknown>).account_id as string;
      }

      const tx = draftToTransaction(draft) as Partial<Transaction>;

      if (typeof item.merchant === 'string') {
        tx.merchant = item.merchant;
      }

      if (typeof item.category === 'string' && !category) {
        tx.category = item.category as any;
      }

      if (typeof item.confidence_score === 'number') {
        tx.confidence_score = item.confidence_score;
      }

      return tx;
    });
}

// ─── Detectar duplicatas contra transações existentes ────────────────────────

function isDuplicate(raw: RawBankTransaction, existing: Transaction[]): boolean {
  return existing.some(ex => {
    const sameDate = Math.abs(new Date(ex.date).getTime() - new Date(raw.date).getTime()) < 86400000 * 2;
    const sameAmt  = Math.abs(ex.amount - Math.abs(raw.amount)) < 0.01;
    const sameDesc = ex.description.toLowerCase().includes((raw.merchant ?? raw.description).toLowerCase().slice(0, 6));
    return sameDate && sameAmt && sameDesc;
  });
}

// ─── PART 2 + 5 + 9 — syncTransactions ───────────────────────────────────────

export async function syncTransactions(
  connectionId: string,
  existingTransactions: Transaction[],
  userId: string,
  onNewTransactions: (txs: Partial<Transaction>[]) => void,
  days = 30
): Promise<SyncResult> {
  const conn = getConnection(connectionId);
  if (!conn || !conn.external_account_id) {
    return { connection_id: connectionId, transactions_imported: 0, balance_updated: false, synced_at: new Date().toISOString(), error: 'Conexão não encontrada.' };
  }

  if (isProductionRuntime() && conn.provider === 'mock') {
    writeConnections(readConnections().filter((c) => c.id !== connectionId));
    return {
      connection_id: connectionId,
      transactions_imported: 0,
      balance_updated: false,
      synced_at: new Date().toISOString(),
      error: 'Conexão local de teste removida. Conecte novamente usando o fluxo real.',
    };
  }

  if (hasBackendBanking()) {
    try {
      const result = await apiRequest<SyncResult & { transactions?: Partial<Transaction>[] }>(API_ENDPOINTS.BANKING.SYNC, {
        method: 'POST',
        body: JSON.stringify({ connectionId, days }),
        retries: 0,
      });

      if (result.transactions?.length) {
        onNewTransactions(normalizeBankTransactionsFromDraft(result.transactions));
      }

      const nextStatus: BankConnection['connection_status'] = result.error ? 'error' : 'connected';
      updateStatus(connectionId, nextStatus, {
        last_sync: result.synced_at,
        balance: result.new_balance,
        error_message: result.error,
      });

      FinancialEventEmitter.bankTransactionsSynced({
        connection_id: connectionId,
        bank_name: conn.bank_name,
        count: result.transactions_imported,
        days,
        synced_at: result.synced_at,
      });

      return result;
    } catch (error: any) {
      const message = String(error?.message ?? '');
      if (message.includes('API Error 404')) {
        writeConnections(readConnections().filter((c) => c.id !== connectionId));
        return {
          connection_id: connectionId,
          transactions_imported: 0,
          balance_updated: false,
          synced_at: new Date().toISOString(),
          error: 'Conexão não encontrada no backend. Atualize a lista e reconecte o banco.',
        };
      }

      if (!shouldUseLocalMockFallback(error)) {
        updateStatus(connectionId, 'error', {
          error_message: message || 'Erro ao sincronizar com o backend.',
        });
        return {
          connection_id: connectionId,
          transactions_imported: 0,
          balance_updated: false,
          synced_at: new Date().toISOString(),
          error: message || 'Erro ao sincronizar com o backend.',
        };
      }

      // Fallback to local mock flow
    }
  }

  updateStatus(connectionId, 'syncing');

  try {
    const provider = getProvider(conn.provider as ProviderKey);
    const rawTxs = await provider.fetchTransactions(conn.external_account_id, days);

    // Filtrar duplicatas
    const newRaw = rawTxs.filter(r => !isDuplicate(r, existingTransactions));

    if (newRaw.length === 0) {
      updateStatus(connectionId, 'connected', { last_sync: new Date().toISOString() });
      return { connection_id: connectionId, transactions_imported: 0, balance_updated: false, synced_at: new Date().toISOString() };
    }

    // PART 4 — Mapear para formato interno
    const mapped = newRaw.map(r => mapToTransaction(r));

    // PART 5 — Classificar com IA (reutiliza classifyImportedTransactions do importService)
    let classified = mapped;
    try {
      classified = await classifyImportedTransactions(mapped as any, userId) as any;
    } catch { /* usar mapeamento básico se AI falhar */ }

    // Converter para Transaction final sempre via TransactionDraft
    const finalTxs = normalizeBankTransactionsFromDraft(
      classified.map((item: any) => ({
        id: item.id,
        amount: item.raw_amount ?? item.amount,
        type: item.type ?? item.raw_type,
        category: item.category ?? Category.PESSOAL,
        description: item.raw_description ?? item.description,
        date: item.raw_date ?? item.date,
        merchant: item.merchant,
        account_id: item.account_id,
        confidence_score: item.confidence ?? 0.7,
        external_reference: item.external_reference,
      })),
    );

    onNewTransactions(finalTxs);

    // Atualizar timestamp de sync
    updateStatus(connectionId, 'connected', { last_sync: new Date().toISOString() });

    // PART 9 — Emitir evento para acionar insights, autopilot, adaptive learning
    FinancialEventEmitter.bankTransactionsSynced({
      connection_id: connectionId,
      bank_name:     conn.bank_name,
      count:         finalTxs.length,
      days,
      synced_at:     new Date().toISOString(),
    });

    return {
      connection_id: connectionId,
      transactions_imported: finalTxs.length,
      balance_updated: false,
      synced_at: new Date().toISOString(),
    };

  } catch (err: any) {
    updateStatus(connectionId, 'error', { error_message: err?.message ?? 'Erro ao sincronizar.' });
    return {
      connection_id: connectionId,
      transactions_imported: 0,
      balance_updated: false,
      synced_at: new Date().toISOString(),
      error: err?.message,
    };
  }
}

// ─── Full sync (accounts + transactions) ─────────────────────────────────────

export async function fullSync(
  connectionId: string,
  existingTransactions: Transaction[],
  existingAccounts: Account[],
  userId: string,
  onNewTransactions: (txs: Partial<Transaction>[]) => void,
  onUpdateAccount: (acc: Account) => void
): Promise<SyncResult> {
  try {
    await syncAccounts(connectionId, existingAccounts, onUpdateAccount);
  } catch { /* continua mesmo se falhar o sync de contas */ }

  return syncTransactions(connectionId, existingTransactions, userId, onNewTransactions);
}

// ─── Helpers para UI ──────────────────────────────────────────────────────────

export function formatLastSync(lastSync?: string): string {
  if (!lastSync) return 'Nunca';
  const diff = Date.now() - new Date(lastSync).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Agora mesmo';
  if (mins < 60) return `${mins} min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h atrás`;
  return new Date(lastSync).toLocaleDateString('pt-BR');
}
