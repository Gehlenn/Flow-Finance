import { config } from 'dotenv';

config();

const DEFAULT_DEV_JWT_SECRET = 'dev-secret-key-change-in-production';

function readEnv(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

function parseNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveJwtSecret(nodeEnv: string): string {
  const configuredSecret = readEnv('JWT_SECRET', DEFAULT_DEV_JWT_SECRET);
  const isProduction = nodeEnv === 'production';
  const isUnsafeDefault = configuredSecret === DEFAULT_DEV_JWT_SECRET;

  if (isProduction && (isUnsafeDefault || configuredSecret.length < 32)) {
    throw new Error('JWT_SECRET must be explicitly configured with at least 32 characters in production');
  }

  return configuredSecret;
}

const NODE_ENV = readEnv('NODE_ENV', 'development');
const JWT_SECRET = resolveJwtSecret(NODE_ENV);

export const env = {
  NODE_ENV,
  PORT: parseNumber('PORT', 3001),
  OPEN_FINANCE_PROVIDER: readEnv('OPEN_FINANCE_PROVIDER', 'mock'),
  
  // API Keys
  // AI provider keys (backend only)
  GEMINI_API_KEY: readEnv('GEMINI_API_KEY'),            // optional, used only if explicitly chosen
  OPENAI_API_KEY: readEnv('OPENAI_API_KEY'),            // gpt-4o-mini — custo-benefício
  OPENAI_MODEL: readEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  OPENAI_MAX_TOKENS: readEnv('OPENAI_MAX_TOKENS', '4096'),

  // AI Model Configuration (Orchestrator)
  // Models selection by type: chat (lightweight), analysis (heavyweight), ocr
  OPENAI_CHAT_MODEL: readEnv('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
  OPENAI_ANALYSIS_MODEL: readEnv('OPENAI_ANALYSIS_MODEL', 'gpt-4o-mini'),
  OPENAI_OCR_MODEL: readEnv('OPENAI_OCR_MODEL', 'gpt-4o-mini'),
  GEMINI_CHAT_MODEL: readEnv('GEMINI_CHAT_MODEL', 'gemini-2.5-flash'),
  GEMINI_ANALYSIS_MODEL: readEnv('GEMINI_ANALYSIS_MODEL', 'gemini-2.5-pro'),
  GEMINI_OCR_MODEL: readEnv('GEMINI_OCR_MODEL', 'gemini-2.5-pro-vision'),

  // AI Orchestrator Configuration
  AI_PRIMARY_PROVIDER: readEnv('AI_PRIMARY_PROVIDER', 'gemini'),       // gemini | openai
  AI_FALLBACK_PROVIDER: readEnv('AI_FALLBACK_PROVIDER', 'openai'),     // fallback if primary fails
  AI_TIMEOUT_MS: readEnv('AI_TIMEOUT_MS', '30000'),                    // timeout per request
  AI_MAX_RETRIES: readEnv('AI_MAX_RETRIES', '2'),                      // retries on failure
  AI_RETRY_DELAY_MS: readEnv('AI_RETRY_DELAY_MS', '500'),              // exponential backoff

  JWT_SECRET,
  JWT_ACCESS_EXPIRES_IN: readEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: readEnv('JWT_REFRESH_EXPIRES_IN', '30d'),
  GOOGLE_OAUTH_CLIENT_ID: readEnv('GOOGLE_OAUTH_CLIENT_ID'),
  GOOGLE_OAUTH_CLIENT_SECRET: readEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
  GOOGLE_OAUTH_REDIRECT_URI: readEnv('GOOGLE_OAUTH_REDIRECT_URI', 'http://localhost:3001/api/auth/oauth/google/callback'),
  OAUTH_STATE_TTL_SECONDS: readEnv('OAUTH_STATE_TTL_SECONDS', '600'),
  OAUTH_MOCK_MODE: readEnv('OAUTH_MOCK_MODE'),
  CLOUD_SYNC_STORE_DRIVER: readEnv('CLOUD_SYNC_STORE_DRIVER'),
  OPEN_FINANCE_STORE_DRIVER: readEnv('OPEN_FINANCE_STORE_DRIVER'),
  OPEN_FINANCE_POSTGRES_ENABLED: readEnv('OPEN_FINANCE_POSTGRES_ENABLED', 'false'),
  DATABASE_URL: readEnv('DATABASE_URL'),
  FIREBASE_PROJECT_ID: readEnv('FIREBASE_PROJECT_ID'),
  FIREBASE_CLIENT_EMAIL: readEnv('FIREBASE_CLIENT_EMAIL'),
  FIREBASE_PRIVATE_KEY: readEnv('FIREBASE_PRIVATE_KEY'),
  FIREBASE_DATABASE_URL: readEnv('FIREBASE_DATABASE_URL'),
  
  // CORS
  ALLOWED_ORIGINS: readEnv('ALLOWED_ORIGINS', readEnv('FRONTEND_URL')),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 min
  RATE_LIMIT_MAX_REQUESTS: parseNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  
  // (legacy) Gemini model name - only used if GEMINI_API_KEY present
  GEMINI_MODEL: readEnv('GEMINI_MODEL', 'gemini-2.5-flash'),

  // Pluggy (Open Finance)
  PLUGGY_BASE_URL: readEnv('PLUGGY_BASE_URL', 'https://api.pluggy.ai'),
  PLUGGY_CLIENT_ID: readEnv('PLUGGY_CLIENT_ID'),
  PLUGGY_CLIENT_SECRET: readEnv('PLUGGY_CLIENT_SECRET'),
  PLUGGY_BANK_CONNECTORS: readEnv('PLUGGY_BANK_CONNECTORS'),
  PLUGGY_DEFAULT_CREDENTIALS_JSON: readEnv('PLUGGY_DEFAULT_CREDENTIALS_JSON'),
  PLUGGY_WEBHOOK_SECRET: readEnv('PLUGGY_WEBHOOK_SECRET'),

  // Feature Flags (cost-optimization & future-ready)
  // Format: FEATURE_<NAME>=true/false
  // Defaults: expensive/experimental features OFF, core features ON (see FeatureFlagService.DEFAULTS)
  FEATURE_OPEN_FINANCE: readEnv('FEATURE_OPEN_FINANCE', 'false'),              // Expensive Open Finance/Pluggy (~R$1k+/month)
  FEATURE_AI_CHAT: readEnv('FEATURE_AI_CHAT', 'true'),                         // Lightweight chat model
  FEATURE_AI_ANALYSIS: readEnv('FEATURE_AI_ANALYSIS', 'true'),                 // Heavier analysis model
  FEATURE_AI_OCR: readEnv('FEATURE_AI_OCR', 'true'),                           // Receipt OCR scanning
  FEATURE_STRIPE_PAYMENTS: readEnv('FEATURE_STRIPE_PAYMENTS', 'true'),         // Payment processing
  FEATURE_SAAS_MULTI_TENANT: readEnv('FEATURE_SAAS_MULTI_TENANT', 'true'),     // SaaS multi-tenant
  FEATURE_SAAS_BILLING: readEnv('FEATURE_SAAS_BILLING', 'true'),               // Billing system
  FEATURE_SENTRY_INTEGRATION: readEnv('FEATURE_SENTRY_INTEGRATION', 'true'),   // Error tracking
  FEATURE_HEALTH_CHECKS: readEnv('FEATURE_HEALTH_CHECKS', 'true'),             // Health checks
  FEATURE_EXTERNAL_INTEGRATIONS: readEnv('FEATURE_EXTERNAL_INTEGRATIONS', 'true'), // External integrations
};

// Validate required environment variables
// require at least one AI key in production
if (!env.OPENAI_API_KEY && !env.GEMINI_API_KEY && env.NODE_ENV === 'production') {
  throw new Error('Either OPENAI_API_KEY or GEMINI_API_KEY environment variable is required in production');
}

if (env.OAUTH_MOCK_MODE && env.NODE_ENV === 'production') {
  throw new Error('OAUTH_MOCK_MODE must be disabled in production');
}

export default env;
