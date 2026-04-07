/**
 * DATABASE CONFIGURATION - Flow Finance Backend
 *
 * PostgreSQL connection and configuration
 */

import { Pool } from 'pg';
import logger from './logger';

function parseBooleanLike(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

export function hasDatabaseConfig(params?: {
  databaseUrl?: string;
  dbHost?: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
}): boolean {
  return Boolean(
    params?.databaseUrl
    || params?.dbHost
    || params?.dbName
    || params?.dbUser
    || params?.dbPassword
    || process.env.DATABASE_URL
    || process.env.DB_HOST
    || process.env.DB_NAME
    || process.env.DB_USER
    || process.env.DB_PASSWORD,
  );
}

export function resolveDatabaseSslConfig(params?: {
  nodeEnv?: string;
  dbSslEnabled?: string;
  dbSslRejectUnauthorized?: string;
  dbSslCa?: string;
}): false | { rejectUnauthorized: boolean; ca?: string } {
  const isProduction = String(params?.nodeEnv || process.env.NODE_ENV || 'development') === 'production';
  const sslEnabled = parseBooleanLike(params?.dbSslEnabled || process.env.DB_SSL_ENABLED, isProduction);

  if (!sslEnabled) {
    return false;
  }

  const rejectUnauthorized = parseBooleanLike(
    params?.dbSslRejectUnauthorized || process.env.DB_SSL_REJECT_UNAUTHORIZED,
    true,
  );

  const rawCa = String(params?.dbSslCa || process.env.DB_SSL_CA || '').trim();
  const ca = rawCa.length > 0 ? rawCa.replace(/\\n/g, '\n') : undefined;

  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

const sslConfig = resolveDatabaseSslConfig();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const dbConfig = hasDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
      ssl: sslConfig,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'flowfinance',
      user: process.env.DB_USER || 'flowfinance',
      password: process.env.DB_PASSWORD || 'flowfinance_password',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
      ssl: sslConfig,
    };

// Create connection pool
export const pool = new Pool(dbConfig);

// Handle pool events
pool.on('connect', () => {
  logger.debug('New client connected to database');
});

pool.on('error', (err: Error) => {
  logger.error({ error: err }, 'Unexpected error on idle client');
});

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    return false;
  }
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  await pool.end();
  logger.info('Database pool closed');
};

// Query helper with error handling
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: res.rowCount }, 'Executed query');
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({ error, text, duration }, 'Query failed');
    throw error;
  }
};

/**
 * Check database health status
 * Returns true if database is reachable and responding
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as health');
    client.release();
    return result.rows.length > 0;
  } catch (error) {
    logger.warn({ error }, 'Database health check failed');
    return false;
  }
}

export default pool;