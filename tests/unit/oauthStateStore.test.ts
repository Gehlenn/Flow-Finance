import { issueOAuthState, consumeOAuthState, getOAuthStateStoreSize, resetOAuthStateStoreForTests } from '../../backend/src/services/auth/oauthStateStore';

describe('oauthStateStore', () => {
  beforeEach(() => {
    resetOAuthStateStoreForTests();
  });

  it('emite e consome estado OAuth', () => {
    const { state, expiresIn } = issueOAuthState('google', 'http://localhost/callback');
    expect(typeof state).toBe('string');
    expect(expiresIn).toBeGreaterThan(0);
    expect(getOAuthStateStoreSize()).toBe(1);
    const record = consumeOAuthState(state, 'google');
    expect(record).not.toBeNull();
    expect(record?.provider).toBe('google');
    expect(getOAuthStateStoreSize()).toBe(0);
  });

  it('retorna null para estado inexistente', () => {
    expect(consumeOAuthState('invalido', 'google')).toBeNull();
  });
});
