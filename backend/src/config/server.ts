export type TrustProxySetting = boolean | number | string;

function parseBooleanLike(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function parseNumberLike(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return null;
}

/**
 * Resolve o valor de "trust proxy" do Express.
 *
 * Ordem de prioridade:
 * 1) TRUST_PROXY explícito (boolean, número ou nome de subnet)
 * 2) fallback para 1 (compatibilidade com comportamento anterior)
 */
export function resolveTrustProxySetting(params?: {
  trustProxy?: string;
  nodeEnv?: string;
  vercel?: string;
}): TrustProxySetting {
  const configured = String(params?.trustProxy || '').trim();

  if (configured.length > 0) {
    const asBoolean = parseBooleanLike(configured);
    if (asBoolean !== null) {
      return asBoolean;
    }

    const asNumber = parseNumberLike(configured);
    if (asNumber !== null) {
      return asNumber;
    }

    return configured;
  }

  // Mantem compatibilidade da API atual.
  return 1;
}
