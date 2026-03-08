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
  ReportService,
  SubscriptionService,
  BankConnectionService,
} from '../app/services';

export interface AppConfig {
  storageProvider: 'local' | 'api';
  apiUrl?: string;
  authToken?: string;
}

export class AppContainer {
  private storageProvider: LocalStorageProvider | ApiStorageProvider;
  private userService: UserService;
  private services: Map<string, any> = new Map();

  constructor(config: AppConfig) {
    // Initialize storage provider
    if (config.storageProvider === 'api' && config.apiUrl) {
      this.storageProvider = new ApiStorageProvider(config.apiUrl, config.authToken);
    } else {
      this.storageProvider = new LocalStorageProvider();
    }

    // Initialize user service (doesn't need userId)
    this.userService = new UserService(this.storageProvider);
  }

  getUserService(): UserService {
    return this.userService;
  }

  getTransactionService(userId: string): TransactionService {
    const key = `transaction_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new TransactionService(this.storageProvider, userId));
    }
    return this.services.get(key);
  }

  getAccountService(userId: string): AccountService {
    const key = `account_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new AccountService(this.storageProvider, userId));
    }
    return this.services.get(key);
  }

  getGoalService(userId: string): GoalService {
    const key = `goal_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new GoalService(this.storageProvider, userId));
    }
    return this.services.get(key);
  }

  getSimulationService(userId: string): SimulationService {
    const key = `simulation_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new SimulationService(this.storageProvider, userId));
    }
    return this.services.get(key);
  }

  getReportService(userId: string): ReportService {
    const key = `report_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new ReportService(this.storageProvider, userId));
    }
    return this.services.get(key);
  }

  getSubscriptionService(userId: string): SubscriptionService {
    const key = `subscription_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new SubscriptionService(this.storageProvider, userId));
    }
    return this.services.get(key);
  }

  getBankConnectionService(userId: string): BankConnectionService {
    const key = `bank_${userId}`;
    if (!this.services.has(key)) {
      this.services.set(key, new BankConnectionService(this.storageProvider, userId));
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