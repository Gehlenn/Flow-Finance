import logger from '../config/logger';
import { initGemini } from '../config/gemini';
import { initOpenAI } from '../config/openai';
import { initializeWorkspaceStorePersistence } from '../services/admin/workspaceStore';
import { initializeAuditLogPersistence } from '../services/admin/auditLog';
import { initializeSaasStorePersistence } from '../utils/saasStore';

export type AIHealthStatus = Record<string, 'healthy' | 'unhealthy'>;

export interface AIInitializationResult {
  aiHealthStatus: AIHealthStatus;
  aiProviders: string[];
}

const PERSISTENCE_TASKS = ['workspaceStore', 'auditLog', 'saasStore'] as const;

export async function initializePersistenceStores(): Promise<void> {
  await Promise.all([
    initializeWorkspaceStorePersistence(),
    initializeAuditLogPersistence(),
    initializeSaasStorePersistence(),
  ]);
}

export function initializePersistenceStoresForServerlessColdStart(): void {
  void initializePersistenceStores().catch((error) => {
    logger.error({
      error,
      initializationTasks: [...PERSISTENCE_TASKS],
      vercel: process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
      fallback: 'serverless-cold-start-persistence-init-failed',
    }, 'Failed to initialize persistence on serverless cold start');
  });
}

export function initializeAIProviders(): AIInitializationResult {
  const aiHealthStatus: AIHealthStatus = {};
  const aiProviders: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    try {
      initOpenAI();
      aiProviders.push('OpenAI');
      aiHealthStatus.OpenAI = 'healthy';
    } catch (error) {
      logger.warn({
        error,
        provider: 'OpenAI',
        hasApiKey: true,
        fallback: 'openai-init-failed',
      }, 'Failed to initialize OpenAI');
      aiHealthStatus.OpenAI = 'unhealthy';
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      initGemini();
      aiProviders.push('Gemini');
      aiHealthStatus.Gemini = 'healthy';
    } catch (error) {
      logger.warn({
        error,
        provider: 'Gemini',
        hasApiKey: true,
        fallback: 'gemini-init-failed',
      }, 'Failed to initialize Gemini');
      aiHealthStatus.Gemini = 'unhealthy';
    }
  }

  if (aiProviders.length === 0) {
    logger.error('No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env');
  } else {
    logger.info(`AI providers available: ${aiProviders.join(', ')}`);
  }

  return { aiHealthStatus, aiProviders };
}
