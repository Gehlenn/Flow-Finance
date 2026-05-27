import { logWarn } from '../utils/logger';
import type { SyncPullResult } from './localSyncService';

const GOALS_STORAGE_KEY = 'flow_financial_goals';
const GOALS_LAST_PULL_KEY = 'flow_financial_goals_last_pull';

function readLocalGoals(): Record<string, unknown>[] {
  try {
    return JSON.parse(localStorage.getItem(GOALS_STORAGE_KEY) || '[]');
  } catch (error) {
    logWarn('[LocalSync] Failed to parse local goals cache; using empty baseline', {
      key: GOALS_STORAGE_KEY,
      error,
    });
    return [];
  }
}

function writeLocalGoals(goals: Record<string, unknown>[]): void {
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

export async function hydrateGoalsFromCloud(
  pullFromCloud: (since?: string) => Promise<SyncPullResult | null>,
): Promise<boolean> {
  const since = localStorage.getItem(GOALS_LAST_PULL_KEY) ?? undefined;
  const result = await pullFromCloud(since || undefined);

  if (!result) return false;

  const cloudGoals = result.entities.goals;
  if (!cloudGoals.length) {
    localStorage.setItem(GOALS_LAST_PULL_KEY, result.serverTime);
    return false;
  }

  const localMap = new Map(readLocalGoals().map((goal) => [(goal as { id: string }).id, goal]));

  for (const cloudItem of cloudGoals) {
    if (cloudItem.deleted) {
      localMap.delete(cloudItem.id);
    } else if (cloudItem.payload) {
      localMap.set(cloudItem.id, { ...cloudItem.payload, id: cloudItem.id });
    }
  }

  writeLocalGoals(Array.from(localMap.values()));
  localStorage.setItem(GOALS_LAST_PULL_KEY, result.serverTime);

  return true;
}
