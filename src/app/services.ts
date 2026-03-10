/**
 * APPLICATION SERVICES - Flow Finance
 *
 * Application layer services that coordinate between domain entities
 * and infrastructure services. Following Clean Architecture principles.
 */

import { Transaction, Account, FinancialGoal, User, Subscription, BankConnection } from '../domain/entities';
import { StorageProvider } from '../storage/StorageProvider';
import { AccountRepository, GoalRepository, TransactionRepository } from '../repositories';
import { simulateFinancialScenario } from '../ai/financialSimulator';
import { FinancialEventEmitter } from '../events/eventEngine';
import {
  emitBudgetChanged,
  emitGoalCreated,
  emitTransactionUpdated,
} from '../events/financialEventStream';
import {
  emitBudgetUpdatedEvent,
  emitGoalCreatedEvent,
  emitTransactionCreatedEvent,
  emitTransactionDeletedEvent,
} from '../events/financialEvents';
import { logAuditEvent } from '../security/auditLogService';
import { TransactionType, Category } from '../../types';
import {
  assertCanPerform,
  assertWithinPlanLimit,
  emitBillingHook,
  getCurrentUsage,
  PlanName,
  SaaSContext,
  trackUsage,
  UserRole,
} from '../saas';

interface ServiceSaaSOptions {
  role?: UserRole;
  plan?: PlanName;
}

interface ServiceRepositories {
  transactionRepository?: TransactionRepository;
  accountRepository?: AccountRepository;
  goalRepository?: GoalRepository;
}

async function resolveSaaSContext(
  storage: StorageProvider,
  userId: string,
  options: ServiceSaaSOptions
): Promise<SaaSContext> {
  let plan = options.plan;

  if (!plan) {
    const user = await storage.getUser(userId);
    const planName = user?.subscriptionPlan?.name;
    plan = planName === 'pro' ? 'pro' : 'free';
  }

  return {
    userId,
    role: options.role || 'member',
    plan,
  };
}

export class UserService {
  constructor(private storage: StorageProvider) {}

  async getUser(userId: string): Promise<User | null> {
    return this.storage.getUser(userId);
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...userData,
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.saveUser(user);

    logAuditEvent('user_created', 'user', user.id, {
      email: user.email,
      name: user.name,
    });

    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    await this.storage.saveUser(updatedUser);

    logAuditEvent('user_updated', 'user', userId, {
      fields: Object.keys(updates),
    });

    return updatedUser;
  }
}

export class TransactionService {
  private readonly transactionRepository: TransactionRepository;

  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {},
    repositories: ServiceRepositories = {}
  ) {
    this.transactionRepository = repositories.transactionRepository || new TransactionRepository(storage);
  }

  async createTransaction(transactionData: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'transactions:create');

    const currentUsage = getCurrentUsage(this.userId, 'transactions');
    assertWithinPlanLimit(saasContext, 'transactions', currentUsage);

    // Domain validation
    const transaction: Transaction = {
      ...transactionData,
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save transaction
    await this.transactionRepository.create(transaction);

    // Audit log
    logAuditEvent('transaction_created', 'transaction', transaction.id, {
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
    });

    // Emit event for AI processing
    FinancialEventEmitter.transactionCreated(transaction);
    emitTransactionCreatedEvent({
      userId: this.userId,
      transactionId: transaction.id,
      amount: transaction.amount,
      category: transaction.category,
      transaction,
    });

    const updatedUsage = trackUsage(this.userId, 'transactions');
    emitBillingHook({
      userId: this.userId,
      plan: saasContext.plan,
      event: 'usage_recorded',
      resource: 'transactions',
      amount: updatedUsage,
      at: new Date().toISOString(),
      metadata: { transactionId: transaction.id },
    });

    return transaction;
  }

  async getTransactions(filters?: { accountId?: string; category?: string; dateFrom?: Date; dateTo?: Date }): Promise<Transaction[]> {
    const transactions = await this.transactionRepository.getByUser(this.userId);

    return transactions.filter(tx => {
      if (filters?.accountId && tx.accountId !== filters.accountId) return false;
      if (filters?.category && tx.category !== filters.category) return false;
      if (filters?.dateFrom && tx.date < filters.dateFrom) return false;
      if (filters?.dateTo && tx.date > filters.dateTo) return false;
      return true;
    });
  }

  async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<Transaction> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'transactions:update');

    const transactions = await this.transactionRepository.getByUser(this.userId);
    const existing = transactions.find((tx) => tx.id === transactionId);

    if (!existing) {
      throw new Error('Transaction not found');
    }

    const updated: Transaction = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.transactionRepository.create(updated);

    emitTransactionUpdated({
      userId: this.userId,
      transactionId: updated.id,
      accountId: updated.accountId,
      amount: updated.amount,
      category: updated.category,
      date: updated.date.toISOString(),
    });

    return updated;
  }

  async importTransactions(transactions: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]): Promise<Transaction[]> {
    const imported: Transaction[] = [];

    for (const txData of transactions) {
      try {
        const transaction = await this.createTransaction(txData);
        imported.push(transaction);
      } catch (error) {
        console.error('Failed to import transaction:', error);
      }
    }

    // Emit bulk import event
    FinancialEventEmitter.transactionsImported(imported);

    return imported;
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'transactions:update');

    const transactions = await this.transactionRepository.getByUser(this.userId);
    const existing = transactions.find((tx) => tx.id === transactionId);

    if (!existing) {
      throw new Error('Transaction not found');
    }

    await this.transactionRepository.delete(transactionId);

    emitTransactionDeletedEvent({
      userId: this.userId,
      transactionId,
      deletedAt: new Date().toISOString(),
    });
  }
}

export class AccountService {
  private readonly accountRepository: AccountRepository;

  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {},
    repositories: ServiceRepositories = {}
  ) {
    this.accountRepository = repositories.accountRepository || new AccountRepository(storage);
  }

  async createAccount(accountData: Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'accounts:create');

    const account: Account = {
      ...accountData,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.accountRepository.create(account);

    logAuditEvent('account_created', 'account', account.id, {
      name: account.name,
      type: account.type,
    });

    return account;
  }

  async getAccounts(): Promise<Account[]> {
    return this.accountRepository.getByUser(this.userId);
  }

  async updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'accounts:update');

    const accounts = await this.getAccounts();
    const account = accounts.find(acc => acc.id === accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const oldBalance = account.balance;
    account.balance = newBalance;
    account.updatedAt = new Date();

    await this.accountRepository.create(account);

    logAuditEvent('account_balance_updated', 'account', accountId, {
      oldBalance,
      newBalance,
      difference: newBalance - oldBalance,
    });

    emitBudgetChanged({
      userId: this.userId,
      accountId,
      previousBudget: oldBalance,
      currentBudget: newBalance,
      changedAt: new Date().toISOString(),
    });

    emitBudgetUpdatedEvent({
      userId: this.userId,
      accountId,
      previousBudget: oldBalance,
      currentBudget: newBalance,
    });
  }
}

export class GoalService {
  private readonly goalRepository: GoalRepository;

  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {},
    repositories: ServiceRepositories = {}
  ) {
    this.goalRepository = repositories.goalRepository || new GoalRepository(storage);
  }

  async createGoal(goalData: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isCompleted'>): Promise<FinancialGoal> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'goals:create');

    const goal: FinancialGoal = {
      ...goalData,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.goalRepository.create(goal);

    logAuditEvent('goal_created', 'goal', goal.id, {
      name: goal.name,
      targetAmount: goal.targetAmount,
    });

    FinancialEventEmitter.goalCreated(goal);
    emitGoalCreated({
      userId: this.userId,
      goalId: goal.id,
      title: goal.name,
      targetAmount: goal.targetAmount,
      createdAt: goal.createdAt.toISOString(),
    });
    emitGoalCreatedEvent({
      userId: this.userId,
      goalId: goal.id,
      targetAmount: goal.targetAmount,
    });

    return goal;
  }

  async getGoals(): Promise<FinancialGoal[]> {
    return this.goalRepository.getByUser(this.userId);
  }

  async updateGoalProgress(goalId: string, currentAmount: number): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'goals:update');

    const goals = await this.getGoals();
    const goal = goals.find(g => g.id === goalId);

    if (!goal) {
      throw new Error('Goal not found');
    }

    goal.currentAmount = currentAmount;
    goal.isCompleted = currentAmount >= goal.targetAmount;
    goal.updatedAt = new Date();

    await this.goalRepository.create(goal);
  }
}

export class SimulationService {
  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {}
  ) {}

  async runSimulation(scenario: any): Promise<any> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'simulations:run');

    const accounts = await this.storage.getAccounts(this.userId);
    const transactions = await this.storage.getTransactions(this.userId);

    const normalizedTransactions = transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type === 'income' ? TransactionType.RECEITA : TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: tx.description,
      date: tx.date instanceof Date ? tx.date.toISOString() : new Date(tx.date).toISOString(),
      generated: tx.isGenerated,
    }));

    const result = simulateFinancialScenario(accounts, normalizedTransactions, scenario);

    logAuditEvent('simulation_run', 'simulation', `sim_${Date.now()}`, {
      scenario: scenario.type,
      projectedBalance: result.projected_balance,
    });

    return result;
  }
}

export class SubscriptionService {
  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {}
  ) {}

  async createSubscription(subscriptionData: Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'subscriptions:create');

    const subscription: Subscription = {
      ...subscriptionData,
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.saveSubscription(subscription);

    logAuditEvent('subscription_created', 'subscription', subscription.id, {
      name: subscription.name,
      amount: subscription.amount,
      cycle: subscription.cycle,
    });

    return subscription;
  }

  async getSubscriptions(): Promise<Subscription[]> {
    return this.storage.getSubscriptions(this.userId);
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'subscriptions:update');

    const subscriptions = await this.getSubscriptions();
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updatedSubscription: Subscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date(),
    };

    await this.storage.saveSubscription(updatedSubscription);

    logAuditEvent('subscription_updated', 'subscription', subscriptionId, {
      fields: Object.keys(updates),
    });
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'subscriptions:delete');

    const subscriptions = await this.getSubscriptions();
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    await this.storage.deleteSubscription(subscriptionId);

    logAuditEvent('subscription_deleted', 'subscription', subscriptionId, {
      name: subscription.name,
    });
  }
}

export class BankConnectionService {
  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {}
  ) {}

  async createBankConnection(connectionData: Omit<BankConnection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<BankConnection> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'bankConnections:create');

    const currentConnections = (await this.storage.getBankConnections(this.userId)).length;
    assertWithinPlanLimit(saasContext, 'bankConnections', currentConnections);

    const connection: BankConnection = {
      ...connectionData,
      id: `bc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.saveBankConnection(connection);

    logAuditEvent('bank_connection_created', 'bank_connection', connection.id, {
      bankName: connection.bankName,
      connectionStatus: connection.connectionStatus,
    });

    const updatedUsage = trackUsage(this.userId, 'bankConnections');
    emitBillingHook({
      userId: this.userId,
      plan: saasContext.plan,
      event: 'usage_recorded',
      resource: 'bankConnections',
      amount: updatedUsage,
      at: new Date().toISOString(),
      metadata: { connectionId: connection.id },
    });

    return connection;
  }

  async getBankConnections(): Promise<BankConnection[]> {
    return this.storage.getBankConnections(this.userId);
  }

  async updateBankConnection(connectionId: string, updates: Partial<BankConnection>): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'bankConnections:update');

    const connections = await this.getBankConnections();
    const connection = connections.find(conn => conn.id === connectionId);

    if (!connection) {
      throw new Error('Bank connection not found');
    }

    const updatedConnection: BankConnection = {
      ...connection,
      ...updates,
      updatedAt: new Date(),
    };

    await this.storage.saveBankConnection(updatedConnection);

    logAuditEvent('bank_connection_updated', 'bank_connection', connectionId, {
      fields: Object.keys(updates),
    });
  }

  async deleteBankConnection(connectionId: string): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'bankConnections:delete');

    const connections = await this.getBankConnections();
    const connection = connections.find(conn => conn.id === connectionId);

    if (!connection) {
      throw new Error('Bank connection not found');
    }

    await this.storage.deleteBankConnection(connectionId);

    logAuditEvent('bank_connection_deleted', 'bank_connection', connectionId, {
      bankName: connection.bankName,
    });
  }
}