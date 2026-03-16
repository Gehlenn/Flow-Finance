import { describe, expect, it } from 'vitest';
import { getE2EAuthBootstrap } from '../../src/utils/e2eAuthBootstrap';

describe('getE2EAuthBootstrap', () => {
  it('retorna null quando o modo nao esta habilitado', () => {
    expect(getE2EAuthBootstrap('?e2eAuth=1', undefined, false)).toBeNull();
  });

  it('usa query params quando presentes', () => {
    const result = getE2EAuthBootstrap('?e2eAuth=1&userId=u-1&userEmail=teste%40flow.dev&userName=QA&token=jwt-1', undefined, true);

    expect(result).toEqual({
      userId: 'u-1',
      userEmail: 'teste@flow.dev',
      userName: 'QA',
      token: 'jwt-1',
    });
  });

  it('usa storage e defaults como fallback', () => {
    const storage = {
      getItem: (key: string) => ({
        flow_e2e_auth: '1',
        flow_e2e_user_email: 'storage@flow.dev',
      } as Record<string, string | undefined>)[key] || null,
    };

    const result = getE2EAuthBootstrap('', storage, true);

    expect(result).toEqual({
      userId: 'e2e-user',
      userEmail: 'storage@flow.dev',
      userName: 'E2E Flow',
      token: 'e2e-token',
    });
  });
});