/**
 * DATABASE CONFIGURATION - Flow Finance Backend
 *
 * PostgreSQL connection and configuration
 */

import { Pool } from 'pg';
import logger from './logger';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'flowfinance',
  user: process.env.DB_USER || 'flowfinance',
  password: process.env.DB_PASSWORD || 'flowfinance_password',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create connection pool
export const pool = new Pool(dbConfig);

// Handle pool events
pool.on('connect', (client) => {
  logger.debug('New client connected to database');
});

pool.on('error', (err, client) => {
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

export default pool;