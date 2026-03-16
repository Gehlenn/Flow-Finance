import { config } from 'dotenv';

config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  OPEN_FINANCE_PROVIDER: process.env.OPEN_FINANCE_PROVIDER || 'mock',
  
  // API Keys
  // AI provider keys (backend only)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',            // optional, used only if explicitly chosen
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',            // GPT-4 via GPT Go subscription
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4',
  OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS || '4096',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  OPEN_FINANCE_STORE_DRIVER: process.env.OPEN_FINANCE_STORE_DRIVER || '',
  OPEN_FINANCE_POSTGRES_ENABLED: process.env.OPEN_FINANCE_POSTGRES_ENABLED || 'false',
  DATABASE_URL: process.env.DATABASE_URL || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || '',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  // (legacy) Gemini model name - only used if GEMINI_API_KEY present
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Pluggy (Open Finance)
  PLUGGY_BASE_URL: process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai',
  PLUGGY_CLIENT_ID: process.env.PLUGGY_CLIENT_ID || '',
  PLUGGY_CLIENT_SECRET: process.env.PLUGGY_CLIENT_SECRET || '',
  PLUGGY_BANK_CONNECTORS: process.env.PLUGGY_BANK_CONNECTORS || '',
  PLUGGY_DEFAULT_CREDENTIALS_JSON: process.env.PLUGGY_DEFAULT_CREDENTIALS_JSON || '',
  PLUGGY_WEBHOOK_SECRET: process.env.PLUGGY_WEBHOOK_SECRET || '',
};

// Validate required environment variables
// require at least one AI key in production
if (!env.OPENAI_API_KEY && !env.GEMINI_API_KEY && env.NODE_ENV === 'production') {
  throw new Error('Either OPENAI_API_KEY or GEMINI_API_KEY environment variable is required in production');
}

if (!env.JWT_SECRET && env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

export default env;
