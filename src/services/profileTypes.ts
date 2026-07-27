import type { Alert, Reminder } from '../../types';

export type ProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};
