type ErrorLike = {
  code?: string;
  message?: string;
};

function normalizeCode(rawCode: string | undefined): string {
  if (!rawCode) return '';
  return rawCode.toLowerCase().replace('firestore/', '');
}

export function isSyncPermissionError(error: unknown): boolean {
  const err = (error ?? {}) as ErrorLike;
  const code = normalizeCode(err.code);
  const message = String(err.message ?? '').toLowerCase();

  if (code === 'permission-denied' || code === 'unauthenticated') {
    return true;
  }

  return message.includes('missing or insufficient permissions');
}

export function shouldDisplaySyncConnectionError(error: unknown): boolean {
  return !isSyncPermissionError(error);
}