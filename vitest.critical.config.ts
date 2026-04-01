import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    include: [
      'tests/unit/helpers.test.ts',
      'tests/unit/user-context.test.ts',
      'tests/unit/cashflow-predictor.test.ts',
      'tests/unit/cfo-advisor.test.ts',
      'tests/unit/open-banking-service.test.ts',
      'tests/unit/open-banking-service-extended.test.ts',
      'tests/unit/open-finance-firebase-store.test.ts',
      'tests/unit/storage-provider.test.ts',
      'tests/health/io-integrations.health.test.ts',
    ],
    coverage: {
      provider: 'v8',
      enabled: true,
      include: [
        'src/utils/helpers.ts',
        'src/context/UserContext.ts',
        'src/context/UserContext/UserContext.ts',
        'src/finance/cashflowPredictor.ts',
        'src/agents/cfo/CFOAdvisor.ts',
        'services/integrations/openBankingService.ts',
        'src/storage/StorageProvider.ts',
      ],
      thresholds: {
        lines: 98,
        functions: 98,
        statements: 98,
        branches: 98,
      },
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});