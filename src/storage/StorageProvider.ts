/**
 * STORAGE LAYER - Flow Finance
 *
 * Storage abstraction following Repository pattern.
 * Current runtime is backend-first through HTTP-backed providers.
 */

import { User, Account, Transaction, FinancialGoal, Subscription, BankConnection } from '../domain/entities';

export interface StorageProvider {
  // User operations
  getUser(userId: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;

  // Account operations
  getAccounts(userId: string): Promise<Account[]>;
  saveAccount(account: Account): Promise<void>;
  deleteAccount(accountId: string, userId?: string): Promise<void>;

  // Transaction operations
  getTransactions(userId: string): Promise<Transaction[]>;
  saveTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(transactionId: string, userId?: string): Promise<void>;

  // Goal operations
  getGoals(userId: string): Promise<FinancialGoal[]>;
  saveGoal(goal: FinancialGoal): Promise<void>;
  deleteGoal(goalId: string, userId?: string): Promise<void>;

  // Subscription operations
  getSubscriptions(userId: string): Promise<Subscription[]>;
  saveSubscription(subscription: Subscription): Promise<void>;
  deleteSubscription(subscriptionId: string, userId?: string): Promise<void>;

  // Bank connection operations
  getBankConnections(userId: string): Promise<BankConnection[]>;
  saveBankConnection(connection: BankConnection): Promise<void>;
  deleteBankConnection(connectionId: string, userId?: string): Promise<void>;
}

/**
 * API Storage Provider - For backend integration
 */
export class ApiStorageProvider implements StorageProvider {
  constructor(private apiUrl: string, private authToken?: string) {}

  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      return await this.apiRequest(`/users/${userId}`);
    } catch {
      return null;
    }
  }

  async saveUser(user: User): Promise<void> {
    await this.apiRequest(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }

  async getAccounts(userId: string): Promise<Account[]> {
    return this.apiRequest(`/users/${userId}/accounts`);
  }

  async saveAccount(account: Account): Promise<void> {
    await this.apiRequest(`/users/${account.userId}/accounts/${account.id}`, {
      method: 'PUT',
      body: JSON.stringify(account),
    });
  }

  async deleteAccount(accountId: string, _userId?: string): Promise<void> {
    // This would need userId context
    throw new Error('deleteAccount requires userId context');
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    return this.apiRequest(`/users/${userId}/transactions`);
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    await this.apiRequest(`/users/${transaction.userId}/transactions/${transaction.id}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    });
  }

  async deleteTransaction(transactionId: string, _userId?: string): Promise<void> {
    throw new Error('deleteTransaction requires userId context');
  }

  async getGoals(userId: string): Promise<FinancialGoal[]> {
    return this.apiRequest(`/users/${userId}/goals`);
  }

  async saveGoal(goal: FinancialGoal): Promise<void> {
    await this.apiRequest(`/users/${goal.userId}/goals/${goal.id}`, {
      method: 'PUT',
      body: JSON.stringify(goal),
    });
  }

  async deleteGoal(goalId: string, _userId?: string): Promise<void> {
    throw new Error('deleteGoal requires userId context');
  }

  async getSubscriptions(userId: string): Promise<Subscription[]> {
    return this.apiRequest(`/users/${userId}/subscriptions`);
  }

  async saveSubscription(subscription: Subscription): Promise<void> {
    await this.apiRequest(`/users/${subscription.userId}/subscriptions/${subscription.id}`, {
      method: 'PUT',
      body: JSON.stringify(subscription),
    });
  }

  async deleteSubscription(subscriptionId: string, _userId?: string): Promise<void> {
    throw new Error('deleteSubscription requires userId context');
  }

  async getBankConnections(userId: string): Promise<BankConnection[]> {
    return this.apiRequest(`/users/${userId}/bank-connections`);
  }

  async saveBankConnection(connection: BankConnection): Promise<void> {
    await this.apiRequest(`/users/${connection.userId}/bank-connections/${connection.id}`, {
      method: 'PUT',
      body: JSON.stringify(connection),
    });
  }

  async deleteBankConnection(connectionId: string, _userId?: string): Promise<void> {
    throw new Error('deleteBankConnection requires userId context');
  }
}
