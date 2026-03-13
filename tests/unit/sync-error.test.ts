import { describe, expect, it } from 'vitest';
import { isSyncPermissionError, shouldDisplaySyncConnectionError } from '../../src/utils/syncError';

describe('syncError', () => {
  it('identifica erro de permissao por code', () => {
    expect(isSyncPermissionError({ code: 'permission-denied' })).toBe(true);
    expect(isSyncPermissionError({ code: 'firestore/permission-denied' })).toBe(true);
  });

  it('identifica erro de permissao por mensagem', () => {
    expect(
      isSyncPermissionError({ message: 'FirebaseError: Missing or insufficient permissions.' })
    ).toBe(true);
  });

  it('nao marca falha de rede como erro de permissao', () => {
    expect(isSyncPermissionError(new Error('Network request failed'))).toBe(false);
  });

  it('nao exibe erro de conexao para permission-denied', () => {
    expect(shouldDisplaySyncConnectionError({ code: 'permission-denied' })).toBe(false);
    expect(shouldDisplaySyncConnectionError({ code: 'firestore/permission-denied' })).toBe(false);
  });

  it('nao exibe erro de conexao para unauthenticated', () => {
    expect(shouldDisplaySyncConnectionError({ code: 'unauthenticated' })).toBe(false);
  });

  it('nao exibe erro de conexao quando a mensagem indica falta de permissao', () => {
    expect(
      shouldDisplaySyncConnectionError({ message: 'FirebaseError: Missing or insufficient permissions.' })
    ).toBe(false);
  });

  it('exibe erro para falhas de rede genericas', () => {
    expect(shouldDisplaySyncConnectionError(new Error('Network request failed'))).toBe(true);
  });
});