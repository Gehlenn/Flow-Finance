import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const backendRoot = path.resolve(__dirname, '../..');

describe('banking route gate placement', () => {
  it('mounts the router once and keeps operational endpoints outside the feature gate', () => {
    const indexSource = fs.readFileSync(
      path.join(backendRoot, 'src/index.ts'),
      'utf8',
    );
    const routerSource = fs.readFileSync(
      path.join(backendRoot, 'src/routes/banking.ts'),
      'utf8',
    );

    expect(indexSource).toContain("app.use('/api/banking', bankingRoutes);");
    expect(indexSource).not.toContain(
      "app.use('/api/banking', featureGateOpenFinance",
    );

    const healthRouteIndex = routerSource.indexOf("router.get('/health'");
    const webhookRouteIndex = routerSource.indexOf(
      "router.post('/webhooks/pluggy'",
    );
    const featureGateIndex = routerSource.indexOf(
      'router.use(featureGateOpenFinance())',
    );

    expect(healthRouteIndex).toBeGreaterThan(-1);
    expect(webhookRouteIndex).toBeGreaterThan(healthRouteIndex);
    expect(featureGateIndex).toBeGreaterThan(webhookRouteIndex);
  });
});
