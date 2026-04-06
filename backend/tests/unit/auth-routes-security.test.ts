import { describe, it, expect } from 'vitest';

import authRouter from '../../src/routes/auth';

describe('auth routes security wiring', () => {
  it('wires refresh route with optional auth + dedicated limiter + controller', () => {
    const layer = (authRouter as any).stack.find((entry: any) => entry.route?.path === '/refresh');
    expect(layer).toBeDefined();

    const handlerStack = layer.route.stack;
    expect(handlerStack).toHaveLength(3);
    expect(handlerStack[0].name).toBe('optionalAuthMiddleware');
  });
});
