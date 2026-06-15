import { describe, expect, it } from 'vitest';

import {
  buildMarkdown,
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
});
