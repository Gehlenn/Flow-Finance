import { describe, expect, it } from 'vitest';

import {
  evaluateAuthReadiness,
  parseEnvFileContent,
} from '../../scripts/check-local-auth-readiness.mjs';

describe('check-local-auth-readiness', () => {
  it('parses dotenv lines and ignores comments', () => {
    const env = parseEnvFileContent(`
# comment
VITE_BACKEND_URL=https://api.example.com
VITE_FIREBASE_API_KEY=abc
VITE_FIREBASE_AUTH_DOMAIN=myapp.firebaseapp.com
`);

    expect(env.VITE_BACKEND_URL).toBe('https://api.example.com');
    expect(env.VITE_FIREBASE_API_KEY).toBe('abc');
    expect(env.VITE_FIREBASE_AUTH_DOMAIN).toBe('myapp.firebaseapp.com');
  });

  it('is ready when backend and firebase keys are present', () => {
    const result = evaluateAuthReadiness({
      VITE_API_PROD_URL: 'https://backend.example.com',
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'auth',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app',
    });

    expect(result.ready).toBe(true);
    expect(result.missingFirebase).toEqual([]);
  });

  it('is not ready when firebase keys are missing', () => {
    const result = evaluateAuthReadiness({
      VITE_BACKEND_URL: 'https://backend.example.com',
      VITE_FIREBASE_API_KEY: 'key',
    });

    expect(result.ready).toBe(false);
    expect(result.hasBackend).toBe(true);
    expect(result.missingFirebase).toContain('VITE_FIREBASE_AUTH_DOMAIN');
    expect(result.missingFirebase).toContain('VITE_FIREBASE_PROJECT_ID');
    expect(result.missingFirebase).toContain('VITE_FIREBASE_APP_ID');
  });
});
