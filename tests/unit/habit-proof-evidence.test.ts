import { describe, expect, it } from 'vitest';

import {
  determineResult,
  isoWeekKey,
  parseArgs,
  parseRunIdTimestamp,
  summarizeHabitEvidence,
} from '../../scripts/check-habit-proof-evidence.mjs';

describe('check-habit-proof-evidence', () => {
  it('parses inline CLI arguments', () => {
    const args = parseArgs([
      '--export-root=test-results/custom-export',
      '--output-dir', 'test-results/custom-habit',
      '--canonical-since', '2026-06-12T20:44:49.665Z',
      '--min-distinct-review-weeks=3',
      '--min-observation-days', '14',
      '--min-cohorts', '2',
    ]);

    expect(args.exportRoot).toBe('test-results/custom-export');
    expect(args.outputDir).toBe('test-results/custom-habit');
    expect(args.canonicalSince).toBe('2026-06-12T20:44:49.665Z');
    expect(args.minDistinctReviewWeeks).toBe('3');
    expect(args.minObservationDays).toBe('14');
    expect(args.minCohorts).toBe('2');
  });

  it('parses export run ids into timestamps', () => {
    const parsed = parseRunIdTimestamp('2026-06-12T20-44-52-284Z');
    expect(parsed).toBe(Date.parse('2026-06-12T20:44:52.284Z'));
  });

  it('groups weekly reviews by iso week', () => {
    expect(isoWeekKey(Date.parse('2026-06-12T20:43:48.309Z'))).toBe('2026-W24');
    expect(isoWeekKey(Date.parse('2026-06-19T20:43:48.309Z'))).toBe('2026-W25');
  });

  it('summarizes repeated weekly reviews after activation', () => {
    const summary = summarizeHabitEvidence([
      {
        runId: '2026-06-12T20-44-52-284Z',
        snapshotMs: Date.parse('2026-06-12T20:44:52.284Z'),
        snapshotIso: '2026-06-12T20:44:52.284Z',
        reportPath: 'report-1',
        rowsPath: 'rows-1',
        rows: [
          {
            eventName: 'activation_first_transaction',
            workspaceId: 'ws-1',
            userId: 'user-1',
            occurredAtMs: Date.parse('2026-06-12T20:43:44.408Z'),
            occurredAt: '2026-06-12T20:43:44.408Z',
          },
          {
            eventName: 'activation_first_dashboard_useful',
            workspaceId: 'ws-1',
            userId: 'user-1',
            occurredAtMs: Date.parse('2026-06-12T20:43:45.408Z'),
            occurredAt: '2026-06-12T20:43:45.408Z',
          },
          {
            eventName: 'weekly_cash_review_completed',
            workspaceId: 'ws-1',
            userId: 'user-1',
            occurredAtMs: Date.parse('2026-06-12T20:43:48.309Z'),
            occurredAt: '2026-06-12T20:43:48.309Z',
          },
        ],
      },
      {
        runId: '2026-06-19T20-44-52-284Z',
        snapshotMs: Date.parse('2026-06-19T20:44:52.284Z'),
        snapshotIso: '2026-06-19T20:44:52.284Z',
        reportPath: 'report-2',
        rowsPath: 'rows-2',
        rows: [
          {
            eventName: 'weekly_cash_review_completed',
            workspaceId: 'ws-1',
            userId: 'user-1',
            occurredAtMs: Date.parse('2026-06-19T20:43:48.309Z'),
            occurredAt: '2026-06-19T20:43:48.309Z',
          },
        ],
      },
    ]);

    expect(summary.canonicalBundleCount).toBe(2);
    expect(summary.cohortCount).toBe(1);
    expect(summary.cohortSummaries[0]).toMatchObject({
      cohortKey: 'ws-1::user-1',
      distinctReviewWeekCount: 2,
      reviewEventCountAfterActivation: 2,
      exportBundleCount: 2,
      activationQualifiedBy: 'activation_first_dashboard_useful',
    });
  });

  it('does not qualify habit cohorts from an isolated first transaction', () => {
    const summary = summarizeHabitEvidence([
      {
        runId: '2026-06-12T20-44-52-284Z',
        snapshotMs: Date.parse('2026-06-12T20:44:52.284Z'),
        snapshotIso: '2026-06-12T20:44:52.284Z',
        reportPath: 'report-1',
        rowsPath: 'rows-1',
        rows: [
          {
            eventName: 'activation_first_transaction',
            workspaceId: 'ws-1',
            userId: 'user-1',
            occurredAtMs: Date.parse('2026-06-12T20:43:44.408Z'),
            occurredAt: '2026-06-12T20:43:44.408Z',
          },
          {
            eventName: 'weekly_cash_review_completed',
            workspaceId: 'ws-1',
            userId: 'user-1',
            occurredAtMs: Date.parse('2026-06-19T20:43:48.309Z'),
            occurredAt: '2026-06-19T20:43:48.309Z',
          },
        ],
      },
    ]);
    const result = determineResult(summary, {
      minDistinctReviewWeeks: 1,
      minObservationDays: 1,
      minCohorts: 1,
    });

    expect(summary.cohortSummaries[0]).toMatchObject({
      activationQualifiedAt: '',
      distinctReviewWeekCount: 0,
    });
    expect(result.status).toBe('BLOCK');
    expect(result.reasons).toContain(
      'no cohort reached qualified activation with dashboard usefulness or completed financial base',
    );
  });

  it('blocks without explicit thresholds even when observed evidence exists', () => {
    const result = determineResult(
      {
        canonicalBundleCount: 1,
        totalRelevantRows: 2,
        cohortCount: 1,
        cohortSummaries: [
          {
            cohortKey: 'ws-1::user-1',
            activationQualifiedAt: '2026-06-12T20:43:45.408Z',
            distinctReviewWeekCount: 1,
            observationDays: 1,
          },
        ],
      },
      {
        minDistinctReviewWeeks: null,
        minObservationDays: null,
        minCohorts: null,
      },
    );

    expect(result.status).toBe('BLOCK');
    expect(result.summary).toContain('SEM EVIDENCIA SUFICIENTE');
    expect(result.reasons).toContain(
      'missing explicit habit thresholds; set --min-distinct-review-weeks, --min-observation-days, or --min-cohorts',
    );
  });

  it('passes when the declared thresholds are satisfied', () => {
    const result = determineResult(
      {
        canonicalBundleCount: 2,
        totalRelevantRows: 3,
        cohortCount: 1,
        cohortSummaries: [
          {
            cohortKey: 'ws-1::user-1',
            activationQualifiedAt: '2026-06-12T20:43:45.408Z',
            distinctReviewWeekCount: 2,
            observationDays: 7,
          },
        ],
      },
      {
        minDistinctReviewWeeks: 2,
        minObservationDays: 7,
        minCohorts: 1,
      },
    );

    expect(result.status).toBe('PASS');
    expect(result.passingCohorts).toHaveLength(1);
    expect(result.passingCohorts[0].cohortKey).toBe('ws-1::user-1');
  });
});
