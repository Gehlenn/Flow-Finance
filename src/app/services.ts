/**
 * APPLICATION SERVICES - Flow Finance
 *
 * Application layer services that coordinate between domain entities
 * and infrastructure services. Following Clean Architecture principles.
 */

import { Transaction, Account, FinancialGoal, User, Subscription, BankConnection } from '../domain/entities';
import { StorageProvider } from '../storage/StorageProvider';
import { AccountRepository, GoalRepository, SubscriptionRepository, TransactionRepository } from '../repositories';
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
import { AppError } from '../errors/AppError';
import { validateTransactionInput } from '../validators/transactionValidator';
import { validateGoalInput } from '../validators/goalValidator';
import { logError, logInfo } from '../utils/logger';
import {
  assertCanPerform,
  assertFeatureEnabled,
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
  subscriptionRepository?: SubscriptionRepository;
}

const SAAS_CONTEXT_TTL_MS = 30_000;
const saasContextCache = new Map<string, { context: SaaSContext; cachedAt: number }>();
const saasContextPending = new Map<string, Promise<SaaSContext>>();

function getSaaSContextCacheKey(userId: string, options: ServiceSaaSOptions): string {
  return `${userId}:${options.role || 'member'}:${options.plan || 'auto'}`;
}

async function resolveSaaSContext(
  storage: StorageProvider,
  userId: string,
  options: ServiceSaaSOptions
): Promise<SaaSContext> {
  const cacheKey = getSaaSContextCacheKey(userId, options);
  const now = Date.now();
  const cached = saasContextCache.get(cacheKey);

  if (cached && (now - cached.cachedAt) < SAAS_CONTEXT_TTL_MS) {
    return cached.context;
  }

  const pending = saasContextPending.get(cacheKey);
  if (pending) {
    return pending;
  }

  const resolver = (async () => {
  let plan = options.plan;

  if (!plan) {
    const user = await storage.getUser(userId);
    const planName = user?.subscriptionPlan?.name;
    plan = planName === 'pro' ? 'pro' : 'free';
  }

    const context = {
    userId,
    role: options.role || 'member',
    plan,
    };

    saasContextCache.set(cacheKey, {
      context,
      cachedAt: Date.now(),
    });

    return context;
  })().finally(() => {
    saasContextPending.delete(cacheKey);
  });

  saasContextPending.set(cacheKey, resolver);
  return resolver;
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
      throw new AppError('User not found', 404, { userId });
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

    validateTransactionInput(transactionData);

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
    logInfo('Transaction created', {
      userId: this.userId,
      transactionId: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
    });

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
      throw new AppError('Transaction not found', 404, { transactionId });
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
        logError('Failed to import transaction', {
          userId: this.userId,
          txData,
          error,
        });
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
      throw new AppError('Transaction not found', 404, { transactionId });
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
      throw new AppError('Account not found', 404, { accountId });
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

    validateGoalInput(goalData);

    const goal: FinancialGoal = {
      ...goalData,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.goalRepository.create(goal);
    logInfo('Goal created', {
      userId: this.userId,
      goalId: goal.id,
      targetAmount: goal.targetAmount,
    });

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
      throw new AppError('Goal not found', 404, { goalId });
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
  private readonly subscriptionRepository: SubscriptionRepository;

  constructor(
    private storage: StorageProvider,
    private userId: string,
    private saasOptions: ServiceSaaSOptions = {},
    repositories: ServiceRepositories = {}
  ) {
    this.subscriptionRepository = repositories.subscriptionRepository || new SubscriptionRepository(storage);
  }

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

    await this.subscriptionRepository.create(subscription);

    logAuditEvent('subscription_created', 'subscription', subscription.id, {
      name: subscription.name,
      amount: subscription.amount,
      cycle: subscription.cycle,
    });

    return subscription;
  }

  async getSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.getByUser(this.userId);
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<void> {
    const saasContext = await resolveSaaSContext(this.storage, this.userId, this.saasOptions);
    assertCanPerform(saasContext, 'subscriptions:update');

    const subscriptions = await this.getSubscriptions();
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);

    if (!subscription) {
      throw new AppError('Subscription not found', 404, { subscriptionId });
    }

    const updatedSubscription: Subscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date(),
    };

    await this.subscriptionRepository.update(updatedSubscription);

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
      throw new AppError('Subscription not found', 404, { subscriptionId });
    }

    await this.subscriptionRepository.delete(subscriptionId);

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

    if (currentConnections >= 1) {
      assertFeatureEnabled(saasContext, 'multiBankSync');
    }

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
      throw new AppError('Bank connection not found', 404, { connectionId });
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
      throw new AppError('Bank connection not found', 404, { connectionId });
    }

    await this.storage.deleteBankConnection(connectionId);

    logAuditEvent('bank_connection_deleted', 'bank_connection', connectionId, {
      bankName: connection.bankName,
    });
  }
}