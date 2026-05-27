import { generateAccessToken } from '../../src/middleware/auth';

export function createTestAccessToken(userId = 'test-user', email = `${userId}@local.test`): string {
  return generateAccessToken(userId, email);
}

export function createTestAuthorizationHeader(userId = 'test-user', email = `${userId}@local.test`): string {
  return `Bearer ${createTestAccessToken(userId, email)}`;
}
