/**
 * STORAGE LAYER - Flow Finance
 *
 * Storage abstraction following Repository pattern.
 * Supports multiple storage providers (localStorage, API, etc.)
 */

import { User, Account, Transaction, FinancialGoal, Subscription, BankConnection } from '../domain/entities';

export interface StorageProvider {
  // User operations
  getUser(userId: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;

  // Account operations
  getAccounts(userId: string): Promise<Account[]>;
  saveAccount(account: Account): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;

  // Transaction operations
  getTransactions(userId: string): Promise<Transaction[]>;
  saveTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(transactionId: string): Promise<void>;

  // Goal operations
  getGoals(userId: string): Promise<FinancialGoal[]>;
  saveGoal(goal: FinancialGoal): Promise<void>;
  deleteGoal(goalId: string): Promise<void>;

  // Subscription operations
  getSubscriptions(userId: string): Promise<Subscription[]>;
  saveSubscription(subscription: Subscription): Promise<void>;
  deleteSubscription(subscriptionId: string): Promise<void>;

  // Bank connection operations
  getBankConnections(userId: string): Promise<BankConnection[]>;
  saveBankConnection(connection: BankConnection): Promise<void>;
  deleteBankConnection(connectionId: string): Promise<void>;
}

/**
 * Local Storage Provider - For client-side storage
 */
export class LocalStorageProvider implements StorageProvider {
  private getKey(type: string, userId: string): string {
    return `flow_${type}_${userId}`;
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const data = localStorage.getItem(this.getKey('user', userId));
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async saveUser(user: User): Promise<void> {
    localStorage.setItem(this.getKey('user', user.id), JSON.stringify(user));
  }

  async getAccounts(userId: string): Promise<Account[]> {
    try {
      const data = localStorage.getItem(this.getKey('accounts', userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveAccount(account: Account): Promise<void> {
    const accounts = await this.getAccounts(account.userId);
    const existingIndex = accounts.findIndex(acc => acc.id === account.id);

    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    localStorage.setItem(this.getKey('accounts', account.userId), JSON.stringify(accounts));
  }

  async deleteAccount(accountId: string): Promise<void> {
    // Note: This would need the userId, simplified for demo
    console.warn('deleteAccount not fully implemented for LocalStorageProvider');
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    try {
      const data = localStorage.getItem(this.getKey('transactions', userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    const transactions = await this.getTransactions(transaction.userId);
    const existingIndex = transactions.findIndex(tx => tx.id === transaction.id);

    if (existingIndex >= 0) {
      transactions[existingIndex] = transaction;
    } else {
      transactions.push(transaction);
    }

    localStorage.setItem(this.getKey('transactions', transaction.userId), JSON.stringify(transactions));
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    console.warn('deleteTransaction not fully implemented for LocalStorageProvider');
  }

  async getGoals(userId: string): Promise<FinancialGoal[]> {
    try {
      const data = localStorage.getItem(this.getKey('goals', userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveGoal(goal: FinancialGoal): Promise<void> {
    const goals = await this.getGoals(goal.userId);
    const existingIndex = goals.findIndex(g => g.id === goal.id);

    if (existingIndex >= 0) {
      goals[existingIndex] = goal;
    } else {
      goals.push(goal);
    }

    localStorage.setItem(this.getKey('goals', goal.userId), JSON.stringify(goals));
  }

  async deleteGoal(goalId: string): Promise<void> {
    console.warn('deleteGoal not fully implemented for LocalStorageProvider');
  }

  async getSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      const data = localStorage.getItem(this.getKey('subscriptions', userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveSubscription(subscription: Subscription): Promise<void> {
    const subscriptions = await this.getSubscriptions(subscription.userId);
    const existingIndex = subscriptions.findIndex(sub => sub.id === subscription.id);

    if (existingIndex >= 0) {
      subscriptions[existingIndex] = subscription;
    } else {
      subscriptions.push(subscription);
    }

    localStorage.setItem(this.getKey('subscriptions', subscription.userId), JSON.stringify(subscriptions));
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    console.warn('deleteSubscription not fully implemented for LocalStorageProvider');
  }

  async getBankConnections(userId: string): Promise<BankConnection[]> {
    try {
      const data = localStorage.getItem(this.getKey('bank_connections', userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async saveBankConnection(connection: BankConnection): Promise<void> {
    const connections = await this.getBankConnections(connection.userId);
    const existingIndex = connections.findIndex(conn => conn.id === connection.id);

    if (existingIndex >= 0) {
      connections[existingIndex] = connection;
    } else {
      connections.push(connection);
    }

    localStorage.setItem(this.getKey('bank_connections', connection.userId), JSON.stringify(connections));
  }

  async deleteBankConnection(connectionId: string): Promise<void> {
    console.warn('deleteBankConnection not fully implemented for LocalStorageProvider');
  }
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

  async deleteAccount(accountId: string): Promise<void> {
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

  async deleteTransaction(transactionId: string): Promise<void> {
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

  async deleteGoal(goalId: string): Promise<void> {
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

  async deleteSubscription(subscriptionId: string): Promise<void> {
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

  async deleteBankConnection(connectionId: string): Promise<void> {
    throw new Error('deleteBankConnection requires userId context');
  }
}