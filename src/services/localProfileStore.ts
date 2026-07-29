import type { ProfileState } from './profileTypes';

const PROFILE_STORAGE_PREFIX = 'flow_sync_profile:';

export function createDefaultLocalProfileState(): ProfileState {
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

function normalizeProfileState(data: Partial<ProfileState> | null | undefined): ProfileState {
  return {
    name: typeof data?.name === 'string' && data.name.trim().length > 0 ? data.name : null,
    theme: data?.theme === 'dark' ? 'dark' : 'light',
    alerts: Array.isArray(data?.alerts) ? data.alerts : [],
    reminders: Array.isArray(data?.reminders) ? data.reminders : [],
  };
}

export function loadLocalProfileState(userId: string): ProfileState | null {
  if (typeof window === 'undefined' || !userId) {
    return null;
  }

  const raw = window.localStorage.getItem(buildProfileStorageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    return normalizeProfileState(JSON.parse(raw) as Partial<ProfileState>);
  } catch {
    return null;
  }
}

export function saveLocalProfileState(userId: string, profile: Partial<ProfileState>): ProfileState {
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
