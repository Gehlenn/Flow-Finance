import { timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../config/logger';
import env from '../config/env';
import {
  createBankingConnectionStore,
  migrateConnectionsBetweenStores,
  StoredBankConnection,
} from '../services/openFinance/bankingConnectionStore';
import { PluggyClient } from '../services/openFinance/pluggyClient';
import { isPluggyProviderEnabled, isSupportedOpenFinanceProvider } from '../services/openFinance/providerMode';
import { recordAuditEvent } from '../services/admin/auditLog';

type ConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
type BankProvider = 'mock' | 'pluggy' | 'belvo' | 'truelayer' | 'custom';

interface BankCatalogItem {
  id: string;
  name: string;
  logo: string;
  color: string;
  provider: BankProvider;
  country: string;
}

type BankConnection = StoredBankConnection;

interface SyncResult {
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

interface PluggyWebhookPayload {
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

const BRAZILIAN_BANKS: BankCatalogItem[] = [
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

const bankingConnectionStore = createBankingConnectionStore();
const pluggyClient = new PluggyClient();

function stringsEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function randomBalance(): number {
  return Number((2500 + Math.random() * 7000).toFixed(2));
}

function randomTransactionCount(days: number): number {
  const base = Math.max(2, Math.round(days * 0.3));
  return Math.min(base + Math.floor(Math.random() * 8), 120);
}

function isPluggyEnabled(): boolean {
  const provider = String(env.OPEN_FINANCE_PROVIDER || 'mock').toLowerCase();

  if (!isSupportedOpenFinanceProvider(provider)) {
    logger.warn({ provider }, 'Unsupported OPEN_FINANCE_PROVIDER value. Falling back to mock behavior');
  }

  return isPluggyProviderEnabled(provider);
}

function resolveAuthenticatedUserId(req: Request, res: Response, candidateUserId?: string): string | null {
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

/**
 * Asserts that a connection's stored user_id matches the authenticated user.
 * Returns false and sends 403 if ownership is violated — defense-in-depth
 * against any store inconsistency that could put cross-tenant records in a user's list.
 */
function assertConnectionOwnership(
  connection: BankConnection,
  userId: string,
  res: Response,
): boolean {
  if (connection.user_id !== userId) {
    res.status(403).json({ message: 'Access to this connection is forbidden' });
    return false;
  }
  return true;
}

function parseConnectorMap(): Record<string, number> {
  if (!env.PLUGGY_BANK_CONNECTORS) {
    return {};
  }

  try {
    const parsed = JSON.parse(env.PLUGGY_BANK_CONNECTORS) as Record<string, number>;
    return parsed || {};
  } catch {
    return {};
  }
}

function parseDefaultCredentials(): Record<string, unknown> | null {
  if (!env.PLUGGY_DEFAULT_CREDENTIALS_JSON) {
    return null;
  }

  try {
    const parsed = JSON.parse(env.PLUGGY_DEFAULT_CREDENTIALS_JSON) as Record<string, unknown>;
    return parsed || null;
  } catch {
    return null;
  }
}

function mapPluggyConnectionStatus(status?: string): ConnectionStatus {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'UPDATED') return 'connected';
  if (normalized === 'DELETED') return 'disconnected';
  if (normalized.includes('ERROR') || normalized === 'OUTDATED') return 'error';
  if (normalized.includes('WAITING') || normalized.includes('LOGIN') || normalized === 'UPDATING' || normalized === 'CREATED') {
    return 'syncing';
  }

  return 'syncing';
}

function extractWebhookEventName(payload: PluggyWebhookPayload): string {
  return String(payload.event || payload.type || 'unknown');
}

function extractWebhookItemId(payload: PluggyWebhookPayload): string | null {
  const candidates = [
    payload.itemId,
    payload.item?.id,
    payload.data?.itemId,
    payload.data?.item?.id,
  ];

  const found = candidates.find((value) => typeof value === 'string' && value.length > 0);
  return found || null;
}

async function markConnectionsAsError(itemId: string, message: string): Promise<void> {
  const matches = await findConnectionsByExternalItemId(itemId);

  for (const match of matches) {
    const current = await getConnectionsForUserAsync(match.userId);
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
    await setConnectionsForUser(match.userId, updated);
  }
}

async function refreshPluggyConnectionsByItemId(itemId: string, eventName: string): Promise<number> {
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
    const current = await getConnectionsForUserAsync(match.userId);
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
    await setConnectionsForUser(match.userId, updated);
  }

  return matches.length;
}

function mapPluggyAccountType(type: string): 'checking' | 'savings' | 'credit' | 'investment' {
  const normalized = type.toUpperCase();
  if (normalized.includes('CREDIT')) return 'credit';
  if (normalized.includes('INVEST')) return 'investment';
  if (normalized.includes('SAVINGS')) return 'savings';
  return 'checking';
}

function generateMockTransactions(count: number): SyncResult['transactions'] {
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

async function getConnectionsForUserAsync(userId: string): Promise<BankConnection[]> {
  return bankingConnectionStore.getConnectionsForUser(userId);
}

async function setConnectionsForUser(userId: string, connections: BankConnection[]): Promise<void> {
  await bankingConnectionStore.setConnectionsForUser(userId, connections);
}

async function findConnectionsByExternalItemId(itemId: string): Promise<Array<{ userId: string; connection: BankConnection }>> {
  return bankingConnectionStore.findConnectionsByExternalItemId(itemId);
}

async function countUsersWithConnections(): Promise<number> {
  return bankingConnectionStore.countUsersWithConnections();
}

export const listBanksController = asyncHandler(async (_req: Request, res: Response) => {
  res.json(BRAZILIAN_BANKS);
});

export const listConnectionsController = asyncHandler(async (req: Request, res: Response) => {
  const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const userId = resolveAuthenticatedUserId(req, res, requestedUserId);
  if (!userId) {
    return;
  }

  res.json(await getConnectionsForUserAsync(userId));
});

export const connectBankController = asyncHandler(async (req: Request, res: Response) => {
  const { bankId, userId, itemId, connectorId, credentials } = req.body as {
    bankId: string;
    userId?: string;
    itemId?: string;
    connectorId?: number;
    credentials?: Record<string, unknown>;
  };
  const resolvedUserId = resolveAuthenticatedUserId(req, res, userId);
  if (!resolvedUserId) {
    return;
  }
  const bank = BRAZILIAN_BANKS.find((item) => item.id === bankId);

  if (!isPluggyEnabled() && !bank) {
    res.status(404).json({ message: `Bank ${bankId} not found` });
    return;
  }

  const existing = await getConnectionsForUserAsync(resolvedUserId);
  const alreadyConnected = bank ? existing.find((conn) => conn.bank_name === bank.name) : undefined;
  if (alreadyConnected) {
    res.json(alreadyConnected);
    return;
  }

  if (isPluggyEnabled()) {
    try {
      const item = itemId
        ? await pluggyClient.getItem(itemId)
        : await (async () => {
          const connectorMap = parseConnectorMap();
          const resolvedConnectorId = connectorId || connectorMap[bankId];
          const resolvedCredentials = credentials || parseDefaultCredentials();

          if (!resolvedConnectorId) {
            res.status(400).json({
              message: `Pluggy connectorId not configured for bankId ${bankId}. Set PLUGGY_BANK_CONNECTORS or send connectorId.`,
            });
            return null;
          }

          if (!resolvedCredentials) {
            res.status(400).json({
              message: 'Pluggy credentials are required. Send credentials in request body or set PLUGGY_DEFAULT_CREDENTIALS_JSON.',
            });
            return null;
          }

          return pluggyClient.createItem({
            connectorId: resolvedConnectorId,
            parameters: resolvedCredentials,
            clientUserId: resolvedUserId,
          });
        })();

      if (!item) {
        return;
      }

      const duplicateByItem = existing.find((conn) => conn.external_account_id === item.id);
      if (duplicateByItem) {
        res.json(duplicateByItem);
        return;
      }

      const accounts = await pluggyClient.getAccounts(item.id);
      const firstAccount = accounts[0];

      const connection: BankConnection = {
        id: crypto.randomUUID(),
        user_id: resolvedUserId,
        bank_name: item.connector?.name || bank?.name || 'Banco conectado',
        bank_logo: item.connector?.imageUrl || bank?.logo,
        bank_color: item.connector?.primaryColor || bank?.color,
        provider: 'pluggy',
        connection_status: item.status === 'UPDATED' || item.status === 'UPDATING' ? 'connected' : 'syncing',
        external_account_id: item.id,
        account_type: firstAccount ? mapPluggyAccountType(firstAccount.type) : 'checking',
        balance: firstAccount?.balance,
        created_at: item.createdAt || new Date().toISOString(),
      };

      await setConnectionsForUser(resolvedUserId, [...existing, connection]);
      logger.info({ userId: resolvedUserId, bankId, itemId: item.id, connectorId: item.connector?.id, connectionId: connection.id }, 'Pluggy bank connected');
      res.status(201).json(connection);
      return;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown Pluggy error';
      logger.error({ error: message, userId: resolvedUserId, bankId }, 'Pluggy connect failed');
      res.status(502).json({ message: `Pluggy connect failed: ${message}` });
      return;
    }
  }

  const connection: BankConnection = {
    id: crypto.randomUUID(),
    user_id: resolvedUserId,
    bank_name: bank!.name,
    bank_logo: bank!.logo,
    bank_color: bank!.color,
    provider: bank!.provider,
    connection_status: 'connected',
    external_account_id: `ext_${bank!.id}_${Math.random().toString(36).slice(2, 8)}`,
    balance: randomBalance(),
    created_at: new Date().toISOString(),
  };

  await setConnectionsForUser(resolvedUserId, [...existing, connection]);
  logger.info({ userId: resolvedUserId, bankId, connectionId: connection.id }, 'Bank connected');
  recordAuditEvent({ userId: resolvedUserId, action: 'banking.connect', status: 'success', resource: bankId, metadata: { connectionId: connection.id, provider: connection.provider } });

  res.status(201).json(connection);
});

export const disconnectBankController = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, userId } = req.body as { connectionId: string; userId?: string };
  const resolvedUserId = resolveAuthenticatedUserId(req, res, userId);
  if (!resolvedUserId) {
    return;
  }

  const current = await getConnectionsForUserAsync(resolvedUserId);
  const connection = current.find((conn) => conn.id === connectionId);

  if (!connection) {
    res.status(404).json({ message: 'Connection not found' });
    return;
  }

  if (!assertConnectionOwnership(connection, resolvedUserId, res)) {
    return;
  }

  if (isPluggyEnabled() && connection.provider === 'pluggy' && connection.external_account_id) {
    try {
      await pluggyClient.deleteItem(connection.external_account_id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown Pluggy error';
      logger.warn({ error: message, connectionId, userId: resolvedUserId }, 'Pluggy disconnect failed, removing local mapping anyway');
    }
  }

  const next = current.filter((conn) => conn.id !== connectionId);
  await setConnectionsForUser(resolvedUserId, next);

  logger.info({ userId: resolvedUserId, connectionId }, 'Bank disconnected');
  recordAuditEvent({ userId: resolvedUserId, action: 'banking.disconnect', status: 'success', resource: connectionId });
  res.json({ success: true });
});

export const syncBankController = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, userId, days = 30 } = req.body as {
    connectionId: string;
    userId?: string;
    days?: number;
  };
  const resolvedUserId = resolveAuthenticatedUserId(req, res, userId);
  if (!resolvedUserId) {
    return;
  }

  const current = await getConnectionsForUserAsync(resolvedUserId);
  const idx = current.findIndex((conn) => conn.id === connectionId);

  if (idx < 0) {
    res.status(404).json({ message: 'Connection not found' });
    return;
  }

  if (!assertConnectionOwnership(current[idx], resolvedUserId, res)) {
    return;
  }

  if (isPluggyEnabled() && current[idx].provider === 'pluggy' && current[idx].external_account_id) {
    try {
      const itemId = current[idx].external_account_id;
      const accounts = await pluggyClient.getAccounts(itemId);
      const primaryAccount = accounts[0];

      const to = new Date();
      const from = new Date(Date.now() - days * 86400000);
      const txs = primaryAccount
        ? await pluggyClient.getTransactions(primaryAccount.id, from.toISOString(), to.toISOString())
        : [];

      const mappedTransactions = txs.map((tx) => {
        const amountAbs = Math.abs(tx.amount);
        const isIncome = tx.amount > 0 || tx.type === 'CREDIT';

        return {
          amount: Number(amountAbs.toFixed(2)),
          type: isIncome ? 'Receita' as const : 'Despesa' as const,
          category: isIncome ? 'Negócio' as const : 'Pessoal' as const,
          description: tx.description || 'Transação bancária',
          date: new Date(tx.date).toISOString(),
          merchant: tx.merchant?.name,
          source: 'import' as const,
          confidence_score: 0.95,
        };
      });

      const updated = [...current];
      updated[idx] = {
        ...updated[idx],
        connection_status: 'connected',
        balance: primaryAccount?.balance,
        last_sync: new Date().toISOString(),
      };
      await setConnectionsForUser(resolvedUserId, updated);

      const result: SyncResult = {
        connection_id: connectionId,
        transactions_imported: mappedTransactions.length,
        balance_updated: true,
        new_balance: primaryAccount?.balance,
        synced_at: new Date().toISOString(),
        transactions: mappedTransactions,
      };

      logger.info({ userId: resolvedUserId, connectionId, importedCount: mappedTransactions.length, days }, 'Pluggy bank sync completed');
      res.json(result);
      return;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown Pluggy error';
      logger.error({ error: message, userId: resolvedUserId, connectionId }, 'Pluggy sync failed');
      res.status(502).json({ message: `Pluggy sync failed: ${message}` });
      return;
    }
  }

  const importedCount = randomTransactionCount(days);
  const newBalance = randomBalance();
  const transactions = generateMockTransactions(importedCount);

  const updated = [...current];
  updated[idx] = {
    ...updated[idx],
    connection_status: 'connected',
    balance: newBalance,
    last_sync: new Date().toISOString(),
  };
  await setConnectionsForUser(resolvedUserId, updated);

  const result: SyncResult = {
    connection_id: connectionId,
    transactions_imported: importedCount,
    balance_updated: true,
    new_balance: newBalance,
    synced_at: new Date().toISOString(),
    transactions,
  };

  logger.info({ userId: resolvedUserId, connectionId, importedCount, days }, 'Bank sync completed');
  res.json(result);
});

export const createConnectTokenController = asyncHandler(async (req: Request, res: Response) => {
  const authenticatedUserId = req.userId;
  const { clientUserId } = req.body as { clientUserId?: string };

  if (!authenticatedUserId) {
    res.status(401).json({ message: 'Authenticated user is required' });
    return;
  }

  if (clientUserId && clientUserId !== authenticatedUserId) {
    res.status(403).json({ message: 'clientUserId must match the authenticated user' });
    return;
  }

  if (!isPluggyEnabled()) {
    res.status(501).json({ message: 'Connect Token is only available when OPEN_FINANCE_PROVIDER=pluggy' });
    return;
  }

  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    res.status(503).json({ message: 'Pluggy credentials are not configured. Set PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET in your environment.' });
    return;
  }

  const token = await pluggyClient.createConnectToken(clientUserId || authenticatedUserId);
  res.json({ accessToken: token.accessToken });
});

export const pluggyWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const configuredSecret = env.PLUGGY_WEBHOOK_SECRET;
  const providedSecret = String(
    req.query.secret
    || req.headers['x-pluggy-webhook-secret']
    || req.headers['x-webhook-secret']
    || ''
  );

  if (configuredSecret && !stringsEqual(providedSecret, configuredSecret)) {
    logger.warn({ path: req.path }, 'Rejected Pluggy webhook due to invalid secret');
    res.status(401).json({ message: 'Invalid webhook secret' });
    return;
  }

  const payload = req.body as PluggyWebhookPayload;
  const eventName = extractWebhookEventName(payload);
  const itemId = extractWebhookItemId(payload);

  if (!isPluggyEnabled()) {
    logger.info({ eventName, itemId }, 'Pluggy webhook ignored because provider is disabled');
    res.status(202).json({ received: true, processed: false, reason: 'provider-disabled' });
    return;
  }

  if (!itemId) {
    logger.info({ eventName }, 'Pluggy webhook received without itemId');
    res.status(202).json({ received: true, processed: false, reason: 'missing-itemId' });
    return;
  }

  const matchedConnections = await findConnectionsByExternalItemId(itemId);
  if (!matchedConnections.length) {
    logger.info({ eventName, itemId }, 'Pluggy webhook received for unknown item');
    res.status(202).json({ received: true, processed: false, reason: 'item-not-registered' });
    return;
  }

  try {
    const updatedConnections = await refreshPluggyConnectionsByItemId(itemId, eventName);
    logger.info({ eventName, itemId, updatedConnections }, 'Pluggy webhook processed successfully');
    res.status(202).json({ received: true, processed: true, updatedConnections });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Pluggy webhook error';
    await markConnectionsAsError(itemId, `Webhook refresh failed: ${message}`);
    logger.error({ eventName, itemId, error: message }, 'Pluggy webhook processing failed');
    res.status(202).json({ received: true, processed: false, reason: 'refresh-failed' });
  }
});

export const listConnectorsController = asyncHandler(async (_req: Request, res: Response) => {
  if (!isPluggyEnabled() || !env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    // Return static catalog when Pluggy is not active
    res.json(BRAZILIAN_BANKS.map((b) => ({ id: b.id, name: b.name, imageUrl: b.logo, primaryColor: b.color, country: b.country })));
    return;
  }

  const connectors = await pluggyClient.listConnectors();
  res.json(connectors);
});

export const migrateCurrentUserConnectionsToFirebaseController = asyncHandler(async (req: Request, res: Response) => {
  const requestedUserId = typeof req.body?.userId === 'string' ? req.body.userId : undefined;
  const userId = resolveAuthenticatedUserId(req, res, requestedUserId);
  if (!userId) {
    return;
  }

  const sourceStatus = await bankingConnectionStore.getStatus();
  const targetStore = createBankingConnectionStore({ driver: 'firebase' });
  const targetStatus = await targetStore.getStatus();

  if (!targetStatus.ready) {
    res.status(503).json({
      message: 'Firebase persistence is not ready. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
      sourceDriver: sourceStatus.driver,
      targetDriver: targetStatus.driver,
      targetConfigured: targetStatus.configured,
      targetReady: targetStatus.ready,
    });
    return;
  }

  const result = await migrateConnectionsBetweenStores(bankingConnectionStore, targetStore, [userId]);
  const totalAfterMigration = (await targetStore.getConnectionsForUser(userId)).length;

  logger.info({ userId, sourceDriver: sourceStatus.driver, migratedConnections: result.migratedConnections }, 'Migrated Open Finance connections to Firebase');

  res.json({
    sourceDriver: sourceStatus.driver,
    targetDriver: targetStatus.driver,
    migratedUsers: result.migratedUsers,
    migratedConnections: result.migratedConnections,
    totalUserConnectionsInFirebase: totalAfterMigration,
  });
});

export const bankingHealthController = asyncHandler(async (_req: Request, res: Response) => {
  const storeStatus = await bankingConnectionStore.getStatus();
  res.json({
    status: 'ok',
    providerMode: process.env.OPEN_FINANCE_PROVIDER || 'mock',
    pluggyConfigured: Boolean(env.PLUGGY_CLIENT_ID && env.PLUGGY_CLIENT_SECRET),
    webhookSecretConfigured: Boolean(env.PLUGGY_WEBHOOK_SECRET),
    persistenceDriver: storeStatus.driver,
    persistenceEnabled: storeStatus.enabled,
    persistenceReady: storeStatus.ready,
    totalUsersWithConnections: await countUsersWithConnections(),
    timestamp: new Date().toISOString(),
  });
});
