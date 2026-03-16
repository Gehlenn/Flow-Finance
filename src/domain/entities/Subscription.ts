export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  merchant: string;
  cycle: 'monthly' | 'yearly' | 'unknown';
  occurrences: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
