/**
 * REDIS CONFIGURATION - Flow Finance Backend
 *
 * Redis client for caching and session storage
 */

import { createClient, RedisClientType } from 'redis';
import logger from './logger';

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '60000'),
    lazyConnect: true,
  },
  retry_strategy: (options: { error?: NodeJS.ErrnoException; total_retry_time: number; attempt: number }) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error({
        errorCode: options.error.code,
        attempt: options.attempt,
        totalRetryTime: options.total_retry_time,
        fallback: 'redis-connection-refused',
      }, 'Redis connection refused');
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error({
        attempt: options.attempt,
        totalRetryTime: options.total_retry_time,
        fallback: 'redis-retry-time-exhausted',
      }, 'Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error({
        attempt: options.attempt,
        totalRetryTime: options.total_retry_time,
        fallback: 'redis-max-retry-attempts',
      }, 'Redis max retry attempts reached');
      return new Error('Max retry attempts reached');
    }
    // Exponential backoff
    return Math.min(options.attempt * 100, 3000);
  },
};

// Create Redis client
export const redisClient: RedisClientType = createClient(redisConfig);

// Handle Redis events
redisClient.on('error', (err: Error) => {
  logger.error({
    error: err,
    fallback: 'redis-client-error',
  }, 'Redis client error');
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

// Connect to Redis
export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Redis connection established');
  } catch (error) {
    logger.error({
      error,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      fallback: 'redis-connect-failed',
    }, 'Failed to connect to Redis');
    throw error;
  }
};

// Disconnect from Redis
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error({
      error,
      fallback: 'redis-disconnect-failed',
    }, 'Error disconnecting from Redis');
  }
};

// Cache operations
export const cache = {
  async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error({
        error,
        key,
        fallback: 'redis-cache-get-failed',
      }, 'Cache get error');
      return null;
    }
  },

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await redisClient.setEx(key, ttl, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error({
        error,
        key,
        fallback: 'redis-cache-set-failed',
      }, 'Cache set error');
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error({
        error,
        key,
        fallback: 'redis-cache-delete-failed',
      }, 'Cache delete error');
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({
        error,
        key,
        fallback: 'redis-cache-exists-failed',
      }, 'Cache exists error');
      return false;
    }
  },

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await redisClient.expire(key, ttl);
    } catch (error) {
      logger.error({
        error,
        key,
        ttl,
        fallback: 'redis-cache-expire-failed',
      }, 'Cache expire error');
    }
  },
};

// Session operations
export const session = {
  async get(sessionId: string): Promise<Record<string, unknown> | null> {
    const data = await cache.get(`session:${sessionId}`);
    return data ? (JSON.parse(data) as Record<string, unknown>) : null;
  },

  async set(sessionId: string, data: Record<string, unknown>, ttl: number = 3600): Promise<void> {
    await cache.set(`session:${sessionId}`, JSON.stringify(data), ttl);
  },

  async destroy(sessionId: string): Promise<void> {
    await cache.del(`session:${sessionId}`);
  },
};

/**
 * Check Redis health status
 * Returns true if Redis is reachable and responding
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    // Test ping - will throw if not connected
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.warn({
      error,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      fallback: 'redis-healthcheck-failed',
    }, 'Redis health check failed');
    return false;
  }
}

// Initialize Redis connection if not lazy
export const initRedis = async (): Promise<void> => {
  if (process.env.REDIS_URL) {
    try {
      await connectRedis();
    } catch (error) {
      logger.warn({
        error,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        fallback: 'redis-init-failed',
      }, 'Redis initialization failed - will retry on demand');
    }
  }
};

export default redisClient;
