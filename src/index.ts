/**
 * FLOW FINANCE - Clean Architecture Entry Point
 *
 * Main exports for the entire application following Clean Architecture
 */

// Domain Layer
export * from './domain';

// Application Layer
export * from './app/services';

// Infrastructure Layer
export * from './storage/StorageProvider';
export * from './finance/reportEngine';
export * from './security/transactionIntegrity';

// Configuration
export * from './config/appConfig';

// User Context Layer
export * from './context';

// SaaS Layer
export * from './saas';

// Event System
export { FinancialEventEmitter } from './events/eventEngine';
export * from './events';

// Engines (AI + Finance)
export * from './engines';