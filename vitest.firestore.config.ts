import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['tests/firestore/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/tests/integration/**'],
    passWithNoTests: false,
  },
});
