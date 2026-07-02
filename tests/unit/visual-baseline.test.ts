import { describe, expect, it } from 'vitest';

import {
  captureKey,
  evaluateVisualBaseline,
  manifestCaptures,
  parseArgs,
} from '../../scripts/check-visual-baseline.mjs';

const baseline = {
  name: 'test baseline',
  policy: {
    blockOnConsoleIssues: true,
    blockOnPageErrors: true,
    blockOnMissingCapture: true,
    blockOnViewportMismatch: true,
    blockOnResponseStatusMismatch: true,
    blockOnScreenshotTooSmall: true,
    blockOnHashChange: false,
  },
  expectedSummary: {
    minScreenshots: 2,
    minRoutes: 1,
    minViewportCount: 2,
    maxConsoleIssues: 0,
    maxPageErrors: 0,
  },
  captures: [
    {
      key: 'tab:dashboard:desktop',
      captureType: 'tab',
      surface: 'dashboard',
      viewport: 'desktop',
      width: 1440,
      height: 900,
      responseStatus: 200,
      minScreenshotBytes: 100,
      referenceSha256: 'aaa',
    },
    {
      key: 'tab:dashboard:mobile',
      captureType: 'tab',
      surface: 'dashboard',
      viewport: 'mobile',
      width: 390,
      height: 844,
      responseStatus: 200,
      minScreenshotBytes: 100,
      referenceSha256: 'bbb',
    },
  ],
};

const manifest = {
  runId: 'run-1',
  status: 'PASS',
  summary: {
    screenshots: 2,
    routes: 1,
    viewportCount: 2,
    consoleIssues: 0,
    pageErrors: 0,
  },
  tabCaptures: [
    {
      captureType: 'tab',
      tab: 'dashboard',
      viewport: 'desktop',
      width: 1440,
      height: 900,
      responseStatus: 200,
      screenshot: {
        size: 150,
        sha256: 'aaa',
      },
    },
    {
      captureType: 'tab',
      tab: 'dashboard',
      viewport: 'mobile',
      width: 390,
      height: 844,
      responseStatus: 200,
      screenshot: {
        size: 150,
        sha256: 'changed',
      },
    },
  ],
};

describe('check-visual-baseline', () => {
  it('builds stable capture keys from manifest captures', () => {
    expect(captureKey(manifest.tabCaptures[0])).toBe('tab:dashboard:desktop');
    expect(manifestCaptures(manifest)).toHaveLength(2);
  });

  it('passes when required captures and runtime health match the baseline', () => {
    const result = evaluateVisualBaseline({ baseline, manifest });

    expect(result.status).toBe('PASS');
    expect(result.issues).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe('capture.sha256');
  });

  it('blocks missing captures and console issues', () => {
    const result = evaluateVisualBaseline({
      baseline,
      manifest: {
        ...manifest,
        summary: {
          ...manifest.summary,
          screenshots: 1,
          consoleIssues: 1,
        },
        tabCaptures: [manifest.tabCaptures[0]],
      },
    });

    expect(result.status).toBe('BLOCK');
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'summary.screenshots',
      'summary.consoleIssues',
      'capture.missing',
    ]);
  });

  it('can promote hash drift to a blocking issue for strict runs', () => {
    const result = evaluateVisualBaseline({ baseline, manifest, strictHash: true });

    expect(result.status).toBe('BLOCK');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('capture.sha256');
  });

  it('parses runner arguments', () => {
    expect(parseArgs([
      '--manifest=out/manifest.json',
      '--baseline=baseline.json',
      '--output-root=out',
      '--strict-hash',
    ])).toEqual({
      baseline: 'baseline.json',
      manifest: 'out/manifest.json',
      outputRoot: 'out',
      strictHash: true,
    });
  });
});
