import type { Alert, Reminder } from '../../types';

export type LocalProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};

const PROFILE_STORAGE_PREFIX = 'flow_sync_profile:';

export function createDefaultLocalProfileState(): LocalProfileState {
  return {
    name: null,
    theme: 'light',
    alerts: [],
    reminders: [],
  };
}

function buildProfileStorageKey(userId: string): string {
  return `${PROFILE_STORAGE_PREFIX}${userId}`;
}

function normalizeProfileState(data: Partial<LocalProfileState> | null | undefined): LocalProfileState {
  return {
    name: typeof data?.name === 'string' && data.name.trim().length > 0 ? data.name : null,
    theme: data?.theme === 'dark' ? 'dark' : 'light',
    alerts: Array.isArray(data?.alerts) ? data.alerts : [],
    reminders: Array.isArray(data?.reminders) ? data.reminders : [],
  };
}

export function loadLocalProfileState(userId: string): LocalProfileState | null {
  if (typeof window === 'undefined' || !userId) {
    return null;
  }

  const raw = window.localStorage.getItem(buildProfileStorageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    return normalizeProfileState(JSON.parse(raw) as Partial<LocalProfileState>);
  } catch {
    return null;
  }
}

export function saveLocalProfileState(userId: string, profile: Partial<LocalProfileState>): LocalProfileState {
  const normalized = normalizeProfileState(profile);

  if (typeof window !== 'undefined' && userId) {
    window.localStorage.setItem(buildProfileStorageKey(userId), JSON.stringify(normalized));
  }

  return normalized;
}

export function clearLocalProfileState(userId: string): void {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  window.localStorage.removeItem(buildProfileStorageKey(userId));
}
