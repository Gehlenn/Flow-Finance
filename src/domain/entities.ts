/**
 * DOMAIN ENTITIES - Flow Finance
 *
 * Core business entities following Domain Driven Design principles.
 * These entities contain only business rules and invariants.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: SubscriptionPlan;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  merchant?: string;
  date: Date;
  source: string;
  isGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  color: string;
  icon: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  cycle: 'monthly' | 'yearly';
  merchant: string;
  lastCharge: Date;
  nextExpected: Date;
  totalSpent: number;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankConnection {
  id: string;
  userId: string;
  bankName: string;
  bankLogo?: string;
  bankColor?: string;
  connectionStatus: 'connected' | 'syncing' | 'error' | 'disconnected';
  lastSync?: Date;
  balance?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: 'free' | 'pro';
  price: number;
  features: string[];
  limits: {
    transactionsPerMonth: number;
    aiQueriesPerMonth: number;
    bankConnections: number;
  };
}

// Domain invariants and business rules
export class UserEntity {
  constructor(private user: User) {}

  canAccessFeature(feature: string): boolean {
    return this.user.subscriptionPlan.features.includes(feature);
  }

  isWithinLimits(resource: keyof SubscriptionPlan['limits'], currentUsage: number): boolean {
    return currentUsage < this.user.subscriptionPlan.limits[resource];
  }
}

export class AccountEntity {
  constructor(private account: Account) {}

  canWithdraw(amount: number): boolean {
    return this.account.balance >= amount && this.account.isActive;
  }

  updateBalance(amount: number): void {
    this.account.balance += amount;
    this.account.updatedAt = new Date();
  }
}

export class TransactionEntity {
  constructor(private transaction: Transaction) {}

  isValid(): boolean {
    return this.transaction.amount > 0 &&
           this.transaction.description.trim().length > 0 &&
           this.transaction.date <= new Date();
  }

  belongsToUser(userId: string): boolean {
    return this.transaction.userId === userId;
  }
}