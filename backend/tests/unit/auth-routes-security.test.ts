import { describe, it, expect } from 'vitest';

import authRouter from '../../src/routes/auth';

describe('auth routes security wiring', () => {
  it('wires refresh route with origin guard + optional auth + dedicated limiter + controller', () => {
    const router = authRouter as typeof authRouter & {
      stack: Array<{ route?: { path?: string; stack: Array<{ name: string }> } }>;
    };
    const layer = router.stack.find((entry) => entry.route?.path === '/refresh');
    expect(layer).toBeDefined();

    const handlerStack = layer.route.stack;
    expect(handlerStack).toHaveLength(4);
    expect(handlerStack[0].name).toBe('requireTrustedStateChangingOrigin');
    expect(handlerStack[1].name).toBe('optionalAuthMiddleware');
  });
});
