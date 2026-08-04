import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_CONFIG,
  QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE,
  apiRequest,
} from '../../src/config/api.config';

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getHeader(fetchMock: ReturnType<typeof vi.fn>, callIndex: number, name: string): string | null {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit;
  return new Headers(init.headers).get(name);
}

describe('apiRequest idempotency keys', () => {
  const originalRetryDelay = API_CONFIG.RETRY_DELAY;

  beforeEach(() => {
    API_CONFIG.RETRY_DELAY = 0;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    API_CONFIG.RETRY_DELAY = originalRetryDelay;
    vi.unstubAllGlobals();
  });

  it('reuses one generated key across retries', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ ok: boolean }>('/api/mutations', {
      method: 'POST',
      retries: 1,
    })).resolves.toEqual({ ok: true });

    const firstKey = getHeader(fetchMock, 0, 'Idempotency-Key');
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(getHeader(fetchMock, 1, 'Idempotency-Key')).toBe(firstKey);
  });

  it('uses a different generated key for each apiRequest invocation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/mutations', { method: 'PUT', retries: 0 });
    await apiRequest('/api/mutations', { method: 'PUT', retries: 0 });

    expect(getHeader(fetchMock, 0, 'Idempotency-Key')).not.toBe(getHeader(fetchMock, 1, 'Idempotency-Key'));
  });

  it('preserves an explicit caller idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/mutations', {
      method: 'PATCH',
      retries: 0,
      headers: { 'idempotency-key': 'caller-controlled-key' },
    });

    expect(getHeader(fetchMock, 0, 'Idempotency-Key')).toBe('caller-controlled-key');
  });

  it('does not require a random generator when the caller supplied the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', undefined);

    await expect(apiRequest('/api/mutations', {
      method: 'POST',
      retries: 0,
      headers: { 'Idempotency-Key': 'caller-controlled-key' },
    })).resolves.toEqual({ ok: true });

    expect(getHeader(fetchMock, 0, 'Idempotency-Key')).toBe('caller-controlled-key');
  });

  it('reuses the mutation key after workspace recovery without adding one to recovery GET', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: 'WorkspaceId obrigatorio' }, 400))
      .mockResolvedValueOnce(response({ workspaces: [{ workspaceId: 'ws-recovered' }] }))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ ok: boolean }>('/api/mutations', {
      method: 'DELETE',
      retries: 0,
    })).resolves.toEqual({ ok: true });

    const originalKey = getHeader(fetchMock, 0, 'Idempotency-Key');
    expect(getHeader(fetchMock, 1, 'Idempotency-Key')).toBeNull();
    expect(getHeader(fetchMock, 2, 'Idempotency-Key')).toBe(originalKey);
  });

  it('does not retry a quota persistence 503 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      error: QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE,
    }, 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/mutations', { retries: 2 })).rejects.toMatchObject({
      statusCode: 503,
      errorCode: QUOTA_PERSISTENCE_UNAVAILABLE_ERROR_CODE,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a generic 503 response and resolves the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: 'service_unavailable' }, 503))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ ok: boolean }>('/api/mutations', { retries: 1 }))
      .resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['GET', 'HEAD'])('does not add an idempotency key to %s requests', async (method) => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/queries', { method, retries: 0 });

    expect(getHeader(fetchMock, 0, 'Idempotency-Key')).toBeNull();
  });
});
