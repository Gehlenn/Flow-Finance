export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type SyncEntity = 'accounts' | 'transactions' | 'goals' | 'reminders' | 'receivables';

export type SyncEntityIdMap = Record<string, string>;
