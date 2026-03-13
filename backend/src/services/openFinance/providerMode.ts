export type OpenFinanceProviderMode = 'mock' | 'pluggy';

function normalizeProvider(rawProvider: string | undefined): string {
  return String(rawProvider || 'mock').trim().toLowerCase();
}

export function isSupportedOpenFinanceProvider(rawProvider: string | undefined): boolean {
  const provider = normalizeProvider(rawProvider);
  return provider === 'mock' || provider === 'pluggy';
}

export function isPluggyProviderEnabled(rawProvider: string | undefined): boolean {
  return normalizeProvider(rawProvider) === 'pluggy';
}
