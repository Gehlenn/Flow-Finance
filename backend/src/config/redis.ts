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
  retry_strategy: (options: any) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused');
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('Redis max retry attempts reached');
      return new Error('Max retry attempts reached');
    }
    // Exponential backoff
    return Math.min(options.attempt * 100, 3000);
  },
};

// Create Redis client
export const redisClient: RedisClientType = createClient(redisConfig);

// Handle Redis events
redisClient.on('error', (err) => {
  logger.error({ error: err }, 'Redis client error');
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
    logger.error({ error }, 'Failed to connect to Redis');
    throw error;
  }
};

// Disconnect from Redis
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from Redis');
  }
};

// Cache operations
export const cache = {
  async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
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
      logger.error({ error, key }, 'Cache set error');
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Cache exists error');
      return false;
    }
  },

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await redisClient.expire(key, ttl);
    } catch (error) {
      logger.error({ error, key, ttl }, 'Cache expire error');
    }
  },
};

// Session operations
export const session = {
  async get(sessionId: string): Promise<any> {
    const data = await cache.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  async set(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    await cache.set(`session:${sessionId}`, JSON.stringify(data), ttl);
  },

  async destroy(sessionId: string): Promise<void> {
    await cache.del(`session:${sessionId}`);
  },
};

export default redisClient;