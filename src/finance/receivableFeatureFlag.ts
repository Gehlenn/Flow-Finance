function readBooleanEnv(value: unknown): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function isReceivablesSourceOfTruthEnabled(): boolean {
  return readBooleanEnv(import.meta.env.VITE_RECEIVABLES_AS_SOURCE_OF_TRUTH);
}
