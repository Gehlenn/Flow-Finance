export type LocalSyncEntity =
  | 'goals'
  | 'accounts'
  | 'transactions'
  | 'reminders'
  | 'receivables'
  | 'subscriptions';

export interface SyncItem {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  payload?: Record<string, unknown>;
}

export interface SyncPushPayload {
  entity: LocalSyncEntity;
  items: SyncItem[];
}

export interface SyncPushResult {
  success: boolean;
  upserted: number;
  deleted: number;
  latestServerUpdatedAt: string;
  reconciledIds: Array<{ clientId: string; serverId: string }>;
}

export interface SyncPullResult {
  since: string | null;
  serverTime: string;
  entities: {
    goals: SyncItem[];
    accounts: SyncItem[];
    transactions: SyncItem[];
    reminders: SyncItem[];
    receivables: SyncItem[];
    subscriptions: SyncItem[];
  };
}
