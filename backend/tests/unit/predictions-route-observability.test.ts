import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const predictionMocks = vi.hoisted(() => ({
  predictCashFlow: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = 'user-1';
    next();
  },
}));

vi.mock('../../src/services/PredictionEngine', () => ({
  PredictionEngine: class {
    predictCashFlow = predictionMocks.predictCashFlow;
  },
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: predictionMocks.loggerWarn,
  },
}));

import predictionsRoutes from '../../src/routes/predictions';

function createApp(db: unknown) {
  const app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use('/api/predictions', predictionsRoutes);
  return app;
}

describe('predictions route observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data when refresh prediction fails', async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            orderBy: () => ({
              limit: () => ({
                get: async () => ({
                  docs: [
                    {
                      id: 'tx-1',
                      data: () => ({
                        amount: 100,
                        type: 'income',
                        category: 'Receita',
                        description: 'Recebimento',
                        date: { toDate: () => new Date('2026-05-01T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-2',
                      data: () => ({
                        amount: 50,
                        type: 'expense',
                        category: 'Despesa',
                        description: 'Conta',
                        date: { toDate: () => new Date('2026-05-02T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-3',
                      data: () => ({
                        amount: 75,
                        type: 'income',
                        category: 'Receita',
                        description: 'Recebimento 2',
                        date: { toDate: () => new Date('2026-05-03T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-4',
                      data: () => ({
                        amount: 10,
                        type: 'expense',
                        category: 'Despesa',
                        description: 'Taxa',
                        date: { toDate: () => new Date('2026-05-04T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-5',
                      data: () => ({
                        amount: 20,
                        type: 'expense',
                        category: 'Despesa',
                        description: 'Cafe',
                        date: { toDate: () => new Date('2026-05-05T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-6',
                      data: () => ({
                        amount: 80,
                        type: 'income',
                        category: 'Receita',
                        description: 'Recebimento 3',
                        date: { toDate: () => new Date('2026-05-06T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-7',
                      data: () => ({
                        amount: 15,
                        type: 'expense',
                        category: 'Despesa',
                        description: 'Frete',
                        date: { toDate: () => new Date('2026-05-07T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-8',
                      data: () => ({
                        amount: 40,
                        type: 'expense',
                        category: 'Despesa',
                        description: 'Internet',
                        date: { toDate: () => new Date('2026-05-08T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-9',
                      data: () => ({
                        amount: 60,
                        type: 'income',
                        category: 'Receita',
                        description: 'Recebimento 4',
                        date: { toDate: () => new Date('2026-05-09T00:00:00.000Z') },
                      }),
                    },
                    {
                      id: 'tx-10',
                      data: () => ({
                        amount: 25,
                        type: 'expense',
                        category: 'Despesa',
                        description: 'Lanche',
                        date: { toDate: () => new Date('2026-05-10T00:00:00.000Z') },
                      }),
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
    };

    predictionMocks.predictCashFlow.mockRejectedValueOnce(new Error('prediction engine offline'));

    const app = createApp(db);

    const response = await request(app)
      .post('/api/predictions/refresh')
      .send({ days: 30 });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
      expect(predictionMocks.loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          route: 'refresh',
          userId: 'user-1',
          days: 30,
          error: 'predictionEngine.clearCache is not a function',
        }),
        '[Predictions API] Refresh error',
      );
  });
});
