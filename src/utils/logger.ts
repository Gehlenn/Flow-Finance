type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|token|authorization|secret|api[-_]?key|access[-_]?key)/i;

export interface LogMeta {
  correlationId?: string;
  scope?: string;
  [key: string]: unknown;
}

interface LogPayload {
  level: LogLevel;
  message: string;
  data?: unknown;
  meta?: LogMeta;
  ts: string;
}

function sanitizeData(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeData(item));
  }

  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = REDACTED_VALUE;
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }

  return input;
}

function write(level: LogLevel, message: string, data?: unknown, meta?: LogMeta): void {
  const payload: LogPayload = {
    level,
    message,
    data: sanitizeData(data),
    meta: sanitizeData(meta) as LogMeta | undefined,
    ts: new Date().toISOString(),
  };

  if (level === 'ERROR') {
    console.error(`[${level}]`, payload);
    return;
  }

  if (level === 'WARN') {
    console.warn(`[${level}]`, payload);
    return;
  }

  if (level === 'DEBUG') {
    console.debug(`[${level}]`, payload);
    return;
  }

  console.log(`[${level}]`, payload);
}

export function logInfo(message: string, data?: unknown, meta?: LogMeta): void {
  write('INFO', message, data, meta);
}

export function logWarn(message: string, data?: unknown, meta?: LogMeta): void {
  write('WARN', message, data, meta);
}

export function logError(message: string, error?: unknown, meta?: LogMeta): void {
  write('ERROR', message, error, meta);
}

export function logDebug(message: string, data?: unknown, meta?: LogMeta): void {
  write('DEBUG', message, data, meta);
}
