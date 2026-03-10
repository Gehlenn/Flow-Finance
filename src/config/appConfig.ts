/**
 * APPLICATION CONFIGURATION - Flow Finance
 *
 * Dependency injection and service initialization
 */

import { LocalStorageProvider, ApiStorageProvider } from '../storage/StorageProvider';
import {
  UserService,
  TransactionService,
  AccountService,
  GoalService,
  SimulationService,
  SubscriptionService,
  BankConnectionService,
} from '../app/services';
import { AccountRepository, GoalRepository, TransactionRepository } from '../repositories';
import { PlanName, UserRole } from '../saas';
import { configureBillingTransport } from '../saas/billingHooks';
import { configureUsageStoreAdapter } from '../saas/usageTracker';

interface ServiceSaaSOptions {
  role?: UserRole;
  plan?: PlanName;
}

export interface AppConfig {
  storageProvider: 'local' | 'api';
  apiUrl?: string;
  authToken?: string;
  billingWebhookUrl?: string;
}

export class AppContainer {
  private storageProvider: LocalStorageProvider | ApiStorageProvider;
  private userService: UserService;
  private services: Map<string, any> = new Map();
  private transactionRepository: TransactionRepository;
  private accountRepository: AccountRepository;
  private goalRepository: GoalRepository;

  constructor(config: AppConfig) {
    // Initialize storage provider
    if (config.storageProvider === 'api' && config.apiUrl) {
      this.storageProvider = new ApiStorageProvider(config.apiUrl, config.authToken);
    } else {
      this.storageProvider = new LocalStorageProvider();
    }

    this.transactionRepository = new TransactionRepository(this.storageProvider);
    this.accountRepository = new AccountRepository(this.storageProvider);
    this.goalRepository = new GoalRepository(this.storageProvider);

    // Keep usage tracking persistent regardless of provider.
    void configureUsageStoreAdapter({
      read: async () => {
        if (typeof localStorage === 'undefined') {
          return {};
        }

        try {
          return JSON.parse(localStorage.getItem('flow_saas_usage') || '{}') as Record<string, {
            transactions: number;
            aiQueries: number;
            bankConnections: number;
          }>;
        } catch {
          return {};
        }
      },
      write: async (data) => {
        if (typeof localStorage === 'undefined') {
          return;
        }

        localStorage.setItem('flow_saas_usage', JSON.stringify(data));
      },
    });

    if (config.billingWebhookUrl) {
      configureBillingTransport(async (payload) => {
        await fetch(config.billingWebhookUrl as string, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      });
    }

    // Initialize user service (doesn't need userId)
    this.userService = new UserService(this.storageProvider);
  }

  getUserService(): UserService {
    return this.userService;
  }

  getTransactionService(userId: string, saasOptions: ServiceSaaSOptions = {}): TransactionService {
    const key = `transaction_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(
        key,
        new TransactionService(this.storageProvider, userId, saasOptions, {
          transactionRepository: this.transactionRepository,
        })
      );
    }
    return this.services.get(key);
  }

  getAccountService(userId: string, saasOptions: ServiceSaaSOptions = {}): AccountService {
    const key = `account_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(
        key,
        new AccountService(this.storageProvider, userId, saasOptions, {
          accountRepository: this.accountRepository,
        })
      );
    }
    return this.services.get(key);
  }

  getGoalService(userId: string, saasOptions: ServiceSaaSOptions = {}): GoalService {
    const key = `goal_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(
        key,
        new GoalService(this.storageProvider, userId, saasOptions, {
          goalRepository: this.goalRepository,
        })
      );
    }
    return this.services.get(key);
  }

  getSimulationService(userId: string, saasOptions: ServiceSaaSOptions = {}): SimulationService {
    const key = `simulation_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new SimulationService(this.storageProvider, userId, saasOptions));
    }
    return this.services.get(key);
  }

  getSubscriptionService(userId: string, saasOptions: ServiceSaaSOptions = {}): SubscriptionService {
    const key = `subscription_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new SubscriptionService(this.storageProvider, userId, saasOptions));
    }
    return this.services.get(key);
  }

  getBankConnectionService(userId: string, saasOptions: ServiceSaaSOptions = {}): BankConnectionService {
    const key = `bank_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new BankConnectionService(this.storageProvider, userId, saasOptions));
    }
    return this.services.get(key);
  }
}

// Default configuration for development
export const defaultConfig: AppConfig = {
  storageProvider: 'local',
};

// Global app container instance
let appContainer: AppContainer | null = null;

export function initializeApp(config: AppConfig = defaultConfig): AppContainer {
  appContainer = new AppContainer(config);
  return appContainer;
}

export function getAppContainer(): AppContainer {
  if (!appContainer) {
    throw new Error('App not initialized. Call initializeApp() first.');
  }
  return appContainer;
}