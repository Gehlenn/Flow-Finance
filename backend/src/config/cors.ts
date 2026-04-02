import type { CorsOptions } from 'cors';
import logger from './logger';

function parseOriginList(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol.startsWith('http')
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export function resolveAllowedOrigins(params?: {
  nodeEnv?: string;
  allowedOrigins?: string;
  frontendUrl?: string;
}): string[] {
  const nodeEnv = params?.nodeEnv || process.env.NODE_ENV || 'development';
  const configuredOrigins = [
    ...parseOriginList(params?.allowedOrigins),
    ...parseOriginList(params?.frontendUrl),
  ];

  return Array.from(new Set(
    configuredOrigins.filter((origin) => (
      nodeEnv === 'production' ? !isLoopbackOrigin(origin) : true
    )),
  ));
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[], nodeEnv: string): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (nodeEnv !== 'production' && isLoopbackOrigin(origin)) {
    return true;
  }

  return false;
}

export function createCorsOptions(params?: {
  nodeEnv?: string;
  allowedOrigins?: string;
  frontendUrl?: string;
}): CorsOptions {
  const nodeEnv = params?.nodeEnv || process.env.NODE_ENV || 'development';
  const allowedOrigins = resolveAllowedOrigins(params);

  logger.info({ allowedOrigins, environment: nodeEnv }, 'CORS allowed origins configured');

  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins, nodeEnv)) {
        callback(null, true);
        return;
      }

      logger.warn({ origin, environment: nodeEnv }, 'CORS request rejected');
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Client-Platform', 'X-Workspace-Id'],
  };
}
