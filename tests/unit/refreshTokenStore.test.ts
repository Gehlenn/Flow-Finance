import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeUserRefreshTokens, getRefreshStoreSize, resetRefreshStoreForTests } from '../../backend/src/services/auth/refreshTokenStore';

describe('refreshTokenStore', () => {
  beforeEach(() => {
    resetRefreshStoreForTests();
  });

  it('emite e rotaciona refresh token corretamente', () => {
    const userId = 'user1';
    const email = 'user1@flow.test';
    const { refreshToken, expiresIn } = issueRefreshToken(userId, email);
    expect(typeof refreshToken).toBe('string');
    expect(expiresIn).toBeGreaterThan(0);
    expect(getRefreshStoreSize()).toBe(1);

    const rotated = rotateRefreshToken(refreshToken);
    expect(rotated.userId).toBe(userId);
    expect(rotated.email).toBe(email);
    expect(typeof rotated.refreshToken).toBe('string');
    expect(rotated.refreshExpiresIn).toBeGreaterThan(0);
    expect(getRefreshStoreSize()).toBe(1);
  });

  it('revoga refresh token individual', () => {
    const userId = 'user2';
    const email = 'user2@flow.test';
    const { refreshToken } = issueRefreshToken(userId, email);
    expect(getRefreshStoreSize()).toBe(1);
    revokeRefreshToken(refreshToken);
    expect(getRefreshStoreSize()).toBe(0);
  });

  it('revoga todos os tokens de um usuario', () => {
    const userId = 'user3';
    const email = 'user3@flow.test';
    issueRefreshToken(userId, email);
    issueRefreshToken(userId, email);
    expect(getRefreshStoreSize()).toBe(2);
    const revoked = revokeUserRefreshTokens(userId);
    expect(revoked).toBe(2);
    expect(getRefreshStoreSize()).toBe(0);
  });
});
