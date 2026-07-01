import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildMarkdown,
  collectArtifact,
  determineEvidenceStatus,
  getPathValue,
  normalizeStatus,
} from '../../scripts/generate-audit-evidence-report.mjs';

describe('generate-audit-evidence-report', () => {
  it('reads nested status values from artifact payloads', () => {
    expect(getPathValue({
      result: {
        status: 'BLOCK',
        summary: 'SEM EVIDENCIA SUFICIENTE',
      },
    }, ['result', 'status'])).toBe('BLOCK');
  });

  it('reads top-level status values from activation checker payloads', () => {
    expect(getPathValue({
      status: 'PASS',
      gateText: 'EVIDENCIA SUFICIENTE',
    }, ['status'])).toBe('PASS');
    expect(getPathValue({
      status: 'PASS',
      gateText: 'EVIDENCIA SUFICIENTE',
    }, ['gateText'])).toBe('EVIDENCIA SUFICIENTE');
  });

  it('normalizes known status values', () => {
    expect(normalizeStatus('pass')).toBe('PASS');
    expect(normalizeStatus('OK')).toBe('PASS');
    expect(normalizeStatus('')).toBe('MISSING');
  });

  it('blocks when any required artifact is missing or blocked', () => {
    const result = determineEvidenceStatus([
      { title: 'Habit proof', status: 'BLOCK' },
      { title: 'Visual regression', status: 'PASS' },
      { title: 'Cohort state', status: 'MISSING' },
    ]);

    expect(result.status).toBe('BLOCK');
    expect(result.blockers).toEqual([
      'Habit proof: BLOCK',
      'Cohort state: MISSING',
    ]);
  });

  it('renders the report with explicit non-proof caveats', () => {
    const markdown = buildMarkdown({
      runnerName: 'test',
      timestamp: '2026-06-15T00:00:00.000Z',
      result: {
        status: 'BLOCK',
        summary: 'BLOCK',
        blockers: ['Habit proof: BLOCK'],
      },
      artifacts: [
        {
          title: 'Habit proof',
          status: 'BLOCK',
          artifactPath: 'test-results/habit/report.json',
          summary: 'SEM EVIDENCIA SUFICIENTE',
        },
      ],
    });

    expect(markdown).toContain('What this report does not prove');
    expect(markdown).toContain('It does not prove retention without multi-week real usage.');
  });

  it('prefers the most complete visual manifest over a later smoke capture', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-audit-evidence-'));
    const fullRun = path.join(root, '2026-06-26T14-10-53-868Z');
    const smokeRun = path.join(root, '2026-06-26T14-11-43-872Z');

    await fs.mkdir(fullRun, { recursive: true });
    await fs.mkdir(smokeRun, { recursive: true });
    await fs.writeFile(path.join(fullRun, 'manifest.json'), JSON.stringify({
      status: 'PASS',
      summary: {
        screenshots: 48,
        routeStateScreenshots: 22,
        routes: 13,
        routeStates: 11,
      },
    }), 'utf8');
    await fs.writeFile(path.join(smokeRun, 'manifest.json'), JSON.stringify({
      status: 'PASS',
      summary: {
        screenshots: 2,
        routeStateScreenshots: 0,
        routes: 1,
        routeStates: 0,
      },
    }), 'utf8');

    const artifact = await collectArtifact({
      id: 'visual_regression',
      title: 'Visual regression',
      root,
      file: 'manifest.json',
      statusPath: ['status'],
      summaryPath: ['summary'],
      preferMostComplete: true,
    });

    expect(artifact.runId).toBe('2026-06-26T14-10-53-868Z');
    expect(artifact.artifactPath).toContain('2026-06-26T14-10-53-868Z');
  });
});
