/**
 * FLOW FINANCE - Clean Architecture Entry Point
 *
 * Main exports for the entire application following Clean Architecture
 */

// Domain Layer
export * from './domain/entities';

// Application Layer
export * from './app/services';

// Infrastructure Layer
export * from './storage/StorageProvider';
export * from './ai/aiOrchestrator';
export * from './finance/reportEngine';
export * from './security/transactionIntegrity';

// Configuration
export * from './config/appConfig';

// Event System
export { FinancialEventEmitter } from './events/eventEngine';