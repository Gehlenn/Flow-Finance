type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogPayload {
  message: string;
  data?: unknown;
  ts: string;
}

function write(level: LogLevel, message: string, data?: unknown): void {
  const payload: LogPayload = {
    message,
    data,
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

export function logInfo(message: string, data?: unknown): void {
  write('INFO', message, data);
}

export function logWarn(message: string, data?: unknown): void {
  write('WARN', message, data);
}

export function logError(message: string, error?: unknown): void {
  write('ERROR', message, error);
}

export function logDebug(message: string, data?: unknown): void {
  write('DEBUG', message, data);
}
