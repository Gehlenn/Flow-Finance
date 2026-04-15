import { describe, expect, it } from 'vitest';
import { buildE2EAuthUrl } from '../../tests/e2e/helpers/appBootstrap';

describe('buildE2EAuthUrl', () => {
  it('inclui bench=1 para desabilitar service worker durante E2E', () => {
    const url = buildE2EAuthUrl({ userId: 'u-1', userEmail: 'qa@flow.dev', userName: 'QA', token: 'jwt-1' });
    const params = new URLSearchParams(url.slice(2));

    expect(params.get('e2eAuth')).toBe('1');
    expect(params.get('bench')).toBe('1');
    expect(params.get('userId')).toBe('u-1');
    expect(params.get('userEmail')).toBe('qa@flow.dev');
    expect(params.get('userName')).toBe('QA');
    expect(params.get('token')).toBe('jwt-1');
  });
});
