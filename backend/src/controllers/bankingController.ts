import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../config/logger';
import env from '../config/env';
import { recordAuditEvent } from '../services/admin/auditLog';
import {
  createBankingConnectionStore,
  migrateConnectionsBetweenStores,
} from '../services/openFinance/bankingConnectionStore';
import {
  BRAZILIAN_BANKS,
  bankingConnectionStore,
  buildWorkspaceScopedStorageKey,
  countUsersWithConnections,
  assertConnectionOwnership,
  extractWebhookEventName,
  extractWebhookItemId,
  findConnectionsByExternalItemId,
  generateMockTransactions,
  getConnectionsForUserAsync,
  getPluggyConnectToken,
  getWorkspaceIdFromRequest,
  isPluggyEnabled,
  mapPluggyAccountType,
  markConnectionsAsError,
  parseConnectorMap,
  parseDefaultCredentials,
  randomBalance,
  randomTransactionCount,
  refreshPluggyConnectionsByItemId,
  resolveAuthenticatedUserId,
  setConnectionsForUser,
  stringsEqual,
  toExternalConnection,
  type BankConnection,
  type PluggyWebhookPayload,
  type SyncResult,
  pluggyClient,
} from './bankingControllerHelpers';

export const listBanksController = asyncHandler(async (_req: Request, res: Response) => {
  res.json(BRAZILIAN_BANKS);
});

export const listConnectionsController = asyncHandler(async (req: Request, res: Response) => {
  const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const userId = resolveAuthenticatedUserId(req, res, requestedUserId);
  const workspaceId = getWorkspaceIdFromRequest(req);
  if (!userId) {
    return;
  }
  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace context is required' });
    return;
  }

  res.json((await getConnectionsForUserAsync(buildWorkspaceScopedStorageKey(userId, workspaceId))).map(toExternalConnection));
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
  const workspaceId = getWorkspaceIdFromRequest(req);
  if (!resolvedUserId) {
    return;
  }
  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace context is required' });
    return;
  }
  const storageScopeId = buildWorkspaceScopedStorageKey(resolvedUserId, workspaceId);
  const bank = BRAZILIAN_BANKS.find((item) => item.id === bankId);

  if (!isPluggyEnabled() && !bank) {
    res.status(404).json({ message: `Bank ${bankId} not found` });
    return;
  }

  const existing = await getConnectionsForUserAsync(storageScopeId);
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
        user_id: storageScopeId,
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

      await setConnectionsForUser(storageScopeId, [...existing, connection]);
      logger.info({ userId: resolvedUserId, bankId, itemId: item.id, connectorId: item.connector?.id, connectionId: connection.id }, 'Pluggy bank connected');
      res.status(201).json(toExternalConnection(connection));
      return;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown Pluggy error';
      logger.error({
        error: message,
        userId: resolvedUserId,
        bankId,
        workspaceId,
        itemId,
        connectorId,
        fallback: 'pluggy-connect-failed',
      }, 'Pluggy connect failed');
      res.status(502).json({ message: `Pluggy connect failed: ${message}` });
      return;
    }
  }

  const connection: BankConnection = {
    id: crypto.randomUUID(),
    user_id: storageScopeId,
    bank_name: bank!.name,
    bank_logo: bank!.logo,
    bank_color: bank!.color,
    provider: bank!.provider,
    connection_status: 'connected',
    external_account_id: `ext_${bank!.id}_${Math.random().toString(36).slice(2, 8)}`,
    balance: randomBalance(),
    created_at: new Date().toISOString(),
  };

  await setConnectionsForUser(storageScopeId, [...existing, connection]);
  logger.info({ userId: resolvedUserId, bankId, connectionId: connection.id }, 'Bank connected');
  recordAuditEvent({ userId: resolvedUserId, action: 'banking.connect', status: 'success', resource: bankId, metadata: { connectionId: connection.id, provider: connection.provider } });

  res.status(201).json(toExternalConnection(connection));
});

export const disconnectBankController = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, userId } = req.body as { connectionId: string; userId?: string };
  const resolvedUserId = resolveAuthenticatedUserId(req, res, userId);
  const workspaceId = getWorkspaceIdFromRequest(req);
  if (!resolvedUserId) {
    return;
  }
  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace context is required' });
    return;
  }
  const storageScopeId = buildWorkspaceScopedStorageKey(resolvedUserId, workspaceId);

  const current = await getConnectionsForUserAsync(storageScopeId);
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
  await setConnectionsForUser(storageScopeId, next);

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
  const workspaceId = getWorkspaceIdFromRequest(req);
  if (!resolvedUserId) {
    return;
  }
  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace context is required' });
    return;
  }
  const storageScopeId = buildWorkspaceScopedStorageKey(resolvedUserId, workspaceId);

  const current = await getConnectionsForUserAsync(storageScopeId);
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
      await setConnectionsForUser(storageScopeId, updated);

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
      logger.error({
        error: message,
        userId: resolvedUserId,
        workspaceId,
        connectionId,
        days,
        fallback: 'pluggy-sync-failed',
      }, 'Pluggy sync failed');
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
  await setConnectionsForUser(storageScopeId, updated);

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
  const workspaceId = getWorkspaceIdFromRequest(req);
  const { clientUserId } = req.body as { clientUserId?: string };

  if (!authenticatedUserId) {
    res.status(401).json({ message: 'Authenticated user is required' });
    return;
  }
  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace context is required' });
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

  const token = await getPluggyConnectToken(workspaceId, clientUserId || authenticatedUserId);
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
    logger.error({
      eventName,
      itemId,
      error: message,
      fallback: 'pluggy-webhook-processing-failed',
    }, 'Pluggy webhook processing failed');
    res.status(202).json({ received: true, processed: false, reason: 'refresh-failed' });
  }
});

export const listConnectorsController = asyncHandler(async (_req: Request, res: Response) => {
  if (!isPluggyEnabled() || !env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    // Fallback: Return hardcoded bank catalog when Pluggy integration is inactive.
    // This should be removed once Pluggy becomes mandatory for production.
    res.json(BRAZILIAN_BANKS.map((b) => ({ id: b.id, name: b.name, imageUrl: b.logo, primaryColor: b.color, country: b.country })));
    return;
  }

  const connectors = await pluggyClient.listConnectors();
  res.json(connectors);
});

export const migrateCurrentUserConnectionsToFirebaseController = asyncHandler(async (req: Request, res: Response) => {
  const requestedUserId = typeof req.body?.userId === 'string' ? req.body.userId : undefined;
  const userId = resolveAuthenticatedUserId(req, res, requestedUserId);
  const workspaceId = getWorkspaceIdFromRequest(req);
  if (!userId) {
    return;
  }
  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace context is required' });
    return;
  }
  const storageScopeId = buildWorkspaceScopedStorageKey(userId, workspaceId);

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

  const result = await migrateConnectionsBetweenStores(bankingConnectionStore, targetStore, [storageScopeId]);
  const totalAfterMigration = (await targetStore.getConnectionsForUser(storageScopeId)).length;

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
