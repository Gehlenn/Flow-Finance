import { ApiRequestError } from '../../src/config/api.config';

interface ErrorLike {
  message?: unknown;
  requestId?: unknown;
  statusCode?: unknown;
}

function getApiErrorStatus(error: unknown): number | null {
  const statusFromObject = (error as ErrorLike)?.statusCode;
  if (typeof statusFromObject === 'number') {
    return statusFromObject;
  }

  const message: string = typeof (error as ErrorLike)?.message === 'string'
    ? String((error as ErrorLike).message)
    : String((error as ErrorLike)?.message ?? '');
  const match = message.match(/API Error\s+(\d{3})/);
  return match ? Number(match[1]) : null;
}

function extractRequestId(error: unknown): string | null {
  if (error instanceof ApiRequestError && error.requestId) {
    return error.requestId;
  }

  const fromObject = (error as ErrorLike)?.requestId;
  return typeof fromObject === 'string' && fromObject.trim() ? fromObject.trim() : null;
}

function collectErrorTokens(error: unknown, seen = new Set<unknown>()): string[] {
  if (error == null) return [];
  if (typeof error === 'string') return [error];
  if (typeof error !== 'object') return [String(error)];
  if (seen.has(error)) return [];
  seen.add(error);

  const tokens: string[] = [];
  const obj = error as Record<string, unknown>;

  for (const key of ['message', 'code', 'error', 'type']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      tokens.push(value);
    }
  }

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' || typeof value === 'string') {
      tokens.push(...collectErrorTokens(value, seen));
    }
  }

  return tokens;
}

export function mapPluggyConnectErrorMessage(error: unknown): string {
  const merged = collectErrorTokens(error).join(' ').toUpperCase();
  const requestId = extractRequestId(error);
  const suffix = requestId ? ` (requestId: ${requestId})` : '';

  if (merged.includes('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED')) {
    return `Sua credencial Pluggy esta em modo de teste. Use um conector sandbox ou solicite habilitacao de contas reais no painel da Pluggy.${suffix}`;
  }

  if (merged.includes('INVALID_CONNECT_TOKEN') || merged.includes('CONNECT_TOKEN')) {
    return `Token de conexao da Pluggy expirou ou e invalido. Atualize a tela e tente novamente.${suffix}`;
  }

  return `Conexao Pluggy cancelada ou invalida. Tente novamente.${suffix}`;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function shouldUseLocalMockFallback(
  error: unknown,
  options: { isProduction: boolean; localFallbackEnabled: boolean },
): boolean {
  if (!options.localFallbackEnabled) {
    return false;
  }

  if (options.isProduction) {
    return false;
  }

  const status = getApiErrorStatus(error);
  if (status !== null && status >= 400 && status < 500) {
    return false;
  }

  return true;
}

