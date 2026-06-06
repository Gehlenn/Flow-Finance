import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { clickWithRetry } from './helpers/resilientActions';

type PerformanceBaselineSnapshot = {
  capturedAt: string;
  route: string;
  projectName: string;
  metrics: {
    navigationDurationMs: number;
    domContentLoadedMs: number;
    loadEventMs: number;
    resourceCount: number;
  };
};

async function maybeWriteBaseline(snapshot: PerformanceBaselineSnapshot): Promise<void> {
  if (process.env.PERF_BASELINE_WRITE !== '1') {
    return;
  }

  const outputDir = path.join(process.cwd(), 'test-results', 'performance-baseline');
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, `${snapshot.projectName}-${snapshot.route}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );
}

test.describe('Performance Monitor', () => {
  test('should expose browser performance entries after app load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navToSettings = page.getByRole('button', { name: 'Ajustes' });
    if (await navToSettings.count()) {
      await clickWithRetry(() => navToSettings);
    }

    const performanceEntries = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    expect(performanceEntries).toBeGreaterThan(0);
  });

  test('captures dashboard performance baseline metrics without fixed latency claims', async ({ page }, testInfo) => {
    await page.goto('/?bench=dashboard');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return {
        navigationDurationMs: Math.round(navigation?.duration ?? 0),
        domContentLoadedMs: Math.round((navigation?.domContentLoadedEventEnd ?? 0) - (navigation?.startTime ?? 0)),
        loadEventMs: Math.round((navigation?.loadEventEnd ?? 0) - (navigation?.startTime ?? 0)),
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });

    expect(metrics.navigationDurationMs).toBeGreaterThan(0);
    expect(metrics.resourceCount).toBeGreaterThan(0);

    await maybeWriteBaseline({
      capturedAt: new Date().toISOString(),
      route: 'dashboard',
      projectName: testInfo.project.name.replace(/\s+/g, '-').toLowerCase(),
      metrics,
    });
  });
});
