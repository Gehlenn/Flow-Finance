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
  OPENAI_API_KEY: readEnv('OPENAI_API_KEY'),            // GPT-4 via GPT Go subscription
  OPENAI_MODEL: readEnv('OPENAI_MODEL', 'gpt-4'),
  OPENAI_MAX_TOKENS: readEnv('OPENAI_MAX_TOKENS', '4096'),
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
