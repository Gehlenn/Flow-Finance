import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { Alert, Reminder } from '../../types';
import type { ProfileState } from './profileTypes';

function nowIso(): string {
  return new Date().toISOString();
}

function createDefaultProfileState(): ProfileState {
  return {
    name: null,
    theme: 'light',
    alerts: [],
    reminders: [],
  };
}

function normalizeProfileState(data: Partial<ProfileState> & { name?: string | null; theme?: 'light' | 'dark' }): ProfileState {
  return {
    name: data.name || null,
    theme: data.theme === 'dark' ? 'dark' : 'light',
    alerts: Array.isArray(data.alerts) ? data.alerts as Alert[] : [],
    reminders: Array.isArray(data.reminders) ? data.reminders as Reminder[] : [],
  };
}

export function subscribeToUserProfile(
  userId: string,
  onNext: (profile: ProfileState) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    queueMicrotask(() => onNext(createDefaultProfileState()));
    return () => undefined;
  }

  return onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      const data = snapshot.exists()
        ? snapshot.data() as Partial<ProfileState> & { name?: string | null; theme?: 'light' | 'dark' }
        : {};
      onNext(normalizeProfileState(data));
    },
    onError,
  );
}

export async function saveUserProfile(userId: string, updates: Partial<ProfileState & { name: string }>): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  await setDoc(doc(db, 'users', userId), {
    ...updates,
    updatedAt: nowIso(),
  }, { merge: true });
}
