import { query, testConnection } from '../../config/database';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import logger from '../../config/logger';

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

export interface StoreMatch {
  userId: string;
  connection: StoredBankConnection;
}

export interface BankingConnectionStoreStatus {
  driver: BankingConnectionStoreDriver;
  enabled: boolean;
  configured: boolean;
  ready: boolean;
}

export interface BankingConnectionStore {
  getStatus(): Promise<BankingConnectionStoreStatus>;
  getConnectionsForUser(userId: string): Promise<StoredBankConnection[]>;
  setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void>;
  findConnectionsByExternalItemId(itemId: string): Promise<StoreMatch[]>;
  countUsersWithConnections(): Promise<number>;
  listUserIdsWithConnections(): Promise<string[]>;
}

interface FirebaseAdapterStatus {
  configured: boolean;
  ready: boolean;
  reason?: string;
}

let firestoreSettingsConfigured = false;

export function applyFirestoreSettingsOnce(firestore: { settings: (options: { ignoreUndefinedProperties: boolean }) => void }): void {
  if (firestoreSettingsConfigured) {
    return;
  }

  firestore.settings({ ignoreUndefinedProperties: true });
  firestoreSettingsConfigured = true;
}

export function resetFirestoreSettingsForTests(): void {
  firestoreSettingsConfigured = false;
}

export interface FirebaseBankingConnectionStoreAdapter {
  getStatus(): Promise<FirebaseAdapterStatus>;
  getConnectionsForUser(userId: string): Promise<StoredBankConnection[]>;
  setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void>;
  listUsersWithConnections(): Promise<string[]>;
  getAllUserConnections(): Promise<Array<{ userId: string; connections: StoredBankConnection[] }>>;
}

class FirebaseAdminBankingConnectionStoreAdapter implements FirebaseBankingConnectionStoreAdapter {
  private readonly collectionName = 'open_finance_connections';
  private firestore: Firestore | null = null;
  private status: FirebaseAdapterStatus = {
    configured: false,
    ready: false,
    reason: 'not-initialized',
  };

  private buildStatus(configured: boolean, ready: boolean, reason?: string): FirebaseAdapterStatus {
    this.status = { configured, ready, reason };
    return this.status;
  }

  private isServiceAccountConfigured(): boolean {
    return Boolean(
      process.env.FIREBASE_PROJECT_ID
      && process.env.FIREBASE_CLIENT_EMAIL
      && process.env.FIREBASE_PRIVATE_KEY,
    );
  }

  private async ensureFirestore(): Promise<Firestore | null> {
    if (this.firestore) {
      return this.firestore;
    }

    const usingServiceAccount = this.isServiceAccountConfigured();
    const usingApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

    if (!usingServiceAccount && !usingApplicationDefault) {
      this.buildStatus(false, false, 'firebase-credentials-missing');
      return null;
    }

    try {
      const existingApp = getApps()[0];
      const app = existingApp || initializeApp(usingServiceAccount
        ? {
            credential: cert({
              projectId: String(process.env.FIREBASE_PROJECT_ID || ''),
              clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL || ''),
              privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            }),
            projectId: String(process.env.FIREBASE_PROJECT_ID || undefined),
            databaseURL: process.env.FIREBASE_DATABASE_URL,
          }
        : {
            credential: applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID,
            databaseURL: process.env.FIREBASE_DATABASE_URL,
          });

      const firestore = getFirestore(app);
      applyFirestoreSettingsOnce(firestore);
      this.firestore = firestore;
      this.buildStatus(true, true);
      return this.firestore;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'firebase-init-failed';
      logger.error({ error: message }, 'Failed to initialize Firebase Open Finance store');
      this.buildStatus(true, false, message);
      return null;
    }
  }

  async getStatus(): Promise<FirebaseAdapterStatus> {
    if (!this.firestore) {
      await this.ensureFirestore();
    }
    return this.status;
  }

  async getConnectionsForUser(userId: string): Promise<StoredBankConnection[]> {
    const firestore = await this.ensureFirestore();
    if (!firestore) {
      return [];
    }

    const doc = await firestore.collection(this.collectionName).doc(userId).get();
    if (!doc.exists) {
      return [];
    }

    const data = doc.data();
    const connections = data?.connections;
    if (!Array.isArray(connections)) {
      return [];
    }

    return connections as StoredBankConnection[];
  }

  async setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void> {
    const firestore = await this.ensureFirestore();
    if (!firestore) {
      throw new Error('Firebase Open Finance store is not ready');
    }

    await firestore.collection(this.collectionName).doc(userId).set({
      userId,
      connections,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  async listUsersWithConnections(): Promise<string[]> {
    const rows = await this.getAllUserConnections();
    return rows.filter((row) => row.connections.length > 0).map((row) => row.userId);
  }

  async getAllUserConnections(): Promise<Array<{ userId: string; connections: StoredBankConnection[] }>> {
    const firestore = await this.ensureFirestore();
    if (!firestore) {
      return [];
    }

    const snapshot = await firestore.collection(this.collectionName).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const connections = Array.isArray(data.connections) ? data.connections as StoredBankConnection[] : [];
      return {
        userId: doc.id,
        connections,
      };
    });
  }
}

class InMemoryBankingConnectionStore implements BankingConnectionStore {
  private readonly userConnections = new Map<string, StoredBankConnection[]>();

  async getStatus(): Promise<BankingConnectionStoreStatus> {
    return {
      driver: 'memory',
      enabled: true,
      configured: true,
      ready: true,
    };
  }

  async getConnectionsForUser(userId: string): Promise<StoredBankConnection[]> {
    return this.userConnections.get(userId) || [];
  }

  async setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void> {
    this.userConnections.set(userId, connections);
  }

  async findConnectionsByExternalItemId(itemId: string): Promise<StoreMatch[]> {
    const matches: StoreMatch[] = [];

    this.userConnections.forEach((connections, userId) => {
      for (const connection of connections) {
        if (connection.external_account_id === itemId) {
          matches.push({ userId, connection });
        }
      }
    });

    return matches;
  }

  async countUsersWithConnections(): Promise<number> {
    return this.userConnections.size;
  }

  async listUserIdsWithConnections(): Promise<string[]> {
    return [...this.userConnections.keys()];
  }
}

class PostgresBankingConnectionStore implements BankingConnectionStore {
  private readonly enabled: boolean;
  private initialized = false;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized || !this.enabled) {
      return;
    }

    await query(`
      CREATE TABLE IF NOT EXISTS bank_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        bank_logo TEXT,
        bank_color TEXT,
        provider TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        external_account_id TEXT,
        account_type TEXT,
        balance NUMERIC(18,2),
        last_sync TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON bank_connections(user_id);');
    await query('CREATE INDEX IF NOT EXISTS idx_bank_connections_external_account_id ON bank_connections(external_account_id);');

    this.initialized = true;
    logger.info('PostgreSQL banking connection store schema is ready');
  }

  private mapRow(row: Record<string, unknown>): StoredBankConnection {
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

  async getStatus(): Promise<BankingConnectionStoreStatus> {
    if (!this.enabled) {
      return {
        driver: 'postgres',
        enabled: false,
        configured: false,
        ready: false,
      };
    }

    const connected = await testConnection();
    if (!connected) {
      return {
        driver: 'postgres',
        enabled: true,
        configured: true,
        ready: false,
      };
    }

    await this.ensureSchema();
    return {
      driver: 'postgres',
      enabled: true,
      configured: true,
      ready: true,
    };
  }

  async getConnectionsForUser(userId: string): Promise<StoredBankConnection[]> {
    await this.ensureSchema();
    const result = await query(
      `SELECT id, user_id, bank_name, bank_logo, bank_color, provider, connection_status,
              external_account_id, account_type, balance, last_sync, error_message, created_at
       FROM bank_connections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void> {
    await this.ensureSchema();
    await query('DELETE FROM bank_connections WHERE user_id = $1', [userId]);

    for (const connection of connections) {
      await query(
        `INSERT INTO bank_connections (
           id, user_id, bank_name, bank_logo, bank_color, provider, connection_status,
           external_account_id, account_type, balance, last_sync, error_message, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13, NOW()
         )`,
        [
          connection.id,
          connection.user_id,
          connection.bank_name,
          connection.bank_logo || null,
          connection.bank_color || null,
          connection.provider,
          connection.connection_status,
          connection.external_account_id || null,
          connection.account_type || null,
          connection.balance ?? null,
          connection.last_sync || null,
          connection.error_message || null,
          connection.created_at,
        ],
      );
    }
  }

  async findConnectionsByExternalItemId(itemId: string): Promise<StoreMatch[]> {
    await this.ensureSchema();
    const result = await query(
      `SELECT id, user_id, bank_name, bank_logo, bank_color, provider, connection_status,
              external_account_id, account_type, balance, last_sync, error_message, created_at
       FROM bank_connections
       WHERE external_account_id = $1`,
      [itemId],
    );

    return result.rows.map((row: Record<string, unknown>) => {
      const connection = this.mapRow(row);
      return {
        userId: connection.user_id,
        connection,
      };
    });
  }

  async countUsersWithConnections(): Promise<number> {
    await this.ensureSchema();
    const result = await query('SELECT COUNT(DISTINCT user_id) AS count FROM bank_connections');
    return Number(result.rows[0]?.count || 0);
  }

  async listUserIdsWithConnections(): Promise<string[]> {
    await this.ensureSchema();
    const result = await query('SELECT DISTINCT user_id FROM bank_connections ORDER BY user_id');
    return result.rows
      .map((row: Record<string, unknown>) => (typeof row.user_id === 'string' ? row.user_id : null))
      .filter((value): value is string => Boolean(value));
  }
}

class FirebaseBankingConnectionStore implements BankingConnectionStore {
  private readonly adapter: FirebaseBankingConnectionStoreAdapter;

  constructor(adapter: FirebaseBankingConnectionStoreAdapter) {
    this.adapter = adapter;
  }

  async getStatus(): Promise<BankingConnectionStoreStatus> {
    const status = await this.adapter.getStatus();
    return {
      driver: 'firebase',
      enabled: true,
      configured: status.configured,
      ready: status.ready,
    };
  }

  async getConnectionsForUser(userId: string): Promise<StoredBankConnection[]> {
    return this.adapter.getConnectionsForUser(userId);
  }

  async setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void> {
    await this.adapter.setConnectionsForUser(userId, connections);
  }

  async findConnectionsByExternalItemId(itemId: string): Promise<StoreMatch[]> {
    const allRows = await this.adapter.getAllUserConnections();
    const matches: StoreMatch[] = [];

    for (const row of allRows) {
      for (const connection of row.connections) {
        if (connection.external_account_id === itemId) {
          matches.push({
            userId: row.userId,
            connection,
          });
        }
      }
    }

    return matches;
  }

  async countUsersWithConnections(): Promise<number> {
    const userIds = await this.adapter.listUsersWithConnections();
    return userIds.length;
  }

  async listUserIdsWithConnections(): Promise<string[]> {
    return this.adapter.listUsersWithConnections();
  }
}

export interface BankingConnectionStoreFactoryOptions {
  driver?: BankingConnectionStoreDriver;
  firebaseAdapter?: FirebaseBankingConnectionStoreAdapter;
}

function parseStoreDriver(driver?: string): BankingConnectionStoreDriver | null {
  const normalized = String(driver || '').toLowerCase();
  if (normalized === 'memory' || normalized === 'postgres' || normalized === 'firebase') {
    return normalized;
  }
  return null;
}

export function resolveBankingConnectionStoreDriver(): BankingConnectionStoreDriver {
  const explicitDriver = parseStoreDriver(process.env.OPEN_FINANCE_STORE_DRIVER);
  if (explicitDriver) {
    return explicitDriver;
  }

  const postgresEnabled = String(process.env.OPEN_FINANCE_POSTGRES_ENABLED || 'false').toLowerCase() === 'true';
  if (postgresEnabled) {
    return 'postgres';
  }

  return 'memory';
}

export interface StoreMigrationResult {
  migratedUsers: number;
  migratedConnections: number;
}

export async function migrateConnectionsBetweenStores(
  sourceStore: BankingConnectionStore,
  targetStore: BankingConnectionStore,
  userIds?: string[],
): Promise<StoreMigrationResult> {
  const resolvedUserIds = userIds && userIds.length > 0
    ? [...new Set(userIds)]
    : await sourceStore.listUserIdsWithConnections();

  let migratedUsers = 0;
  let migratedConnections = 0;

  for (const userId of resolvedUserIds) {
    const connections = await sourceStore.getConnectionsForUser(userId);
    await targetStore.setConnectionsForUser(userId, connections);
    migratedUsers += 1;
    migratedConnections += connections.length;
  }

  return {
    migratedUsers,
    migratedConnections,
  };
}

export function createBankingConnectionStore(options: BankingConnectionStoreFactoryOptions = {}): BankingConnectionStore {
  const driver = options.driver || resolveBankingConnectionStoreDriver();

  if (driver === 'postgres') {
    return new PostgresBankingConnectionStore(true);
  }

  if (driver === 'firebase') {
    const adapter = options.firebaseAdapter || new FirebaseAdminBankingConnectionStoreAdapter();
    return new FirebaseBankingConnectionStore(adapter);
  }

  return new InMemoryBankingConnectionStore();
}
