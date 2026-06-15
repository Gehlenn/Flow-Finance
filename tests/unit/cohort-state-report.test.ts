import { describe, expect, it } from 'vitest';

import {
  classifyCohortState,
  determineOverallStatus,
  parseArgs,
  summarizeWorkspaceStates,
} from '../../scripts/summarize-cohort-state.mjs';

describe('summarize-cohort-state', () => {
  const thresholds = {
    minDistinctReviewWeeks: 2,
    minObservationDays: 7,
    minCohorts: 1,
  };

  it('parses inline CLI arguments', () => {
    const args = parseArgs([
      '--export-root=test-results/custom-export',
      '--output-dir', 'test-results/custom-cohorts',
      '--canonical-since=2026-06-12T20:44:49.665Z',
      '--min-distinct-review-weeks', '3',
      '--min-observation-days=14',
      '--min-cohorts', '2',
    ]);

    expect(args.exportRoot).toBe('test-results/custom-export');
    expect(args.outputDir).toBe('test-results/custom-cohorts');
    expect(args.canonicalSince).toBe('2026-06-12T20:44:49.665Z');
    expect(args.minDistinctReviewWeeks).toBe('3');
    expect(args.minObservationDays).toBe('14');
    expect(args.minCohorts).toBe('2');
  });

  it('blocks isolated activation events that are not qualified', () => {
    const state = classifyCohortState({
      activationEventCount: 1,
      activationQualifiedAt: '',
      distinctReviewWeekCount: 1,
      observationDays: 8,
    }, thresholds);

    expect(state.stage).toBe('bloqueado');
    expect(state.blockers[0]).toMatch(/not qualified/i);
  });

  it('classifies qualified one-week review before minimal habit', () => {
    const state = classifyCohortState({
      activationEventCount: 2,
      activationQualifiedAt: '2026-06-12T20:43:44.420Z',
      distinctReviewWeekCount: 1,
      observationDays: 0,
    }, thresholds);

    expect(state.stage).toBe('revisao_1_semana');
    expect(state.blockers).toEqual([
      'needs 2 distinct review week(s) after qualified activation',
      'needs 7 observation day(s) after qualified activation',
    ]);
  });

  it('classifies minimal habit when declared thresholds are satisfied', () => {
    const state = classifyCohortState({
      activationEventCount: 2,
      activationQualifiedAt: '2026-06-12T20:43:44.420Z',
      distinctReviewWeekCount: 2,
      observationDays: 7,
    }, thresholds);

    expect(state.stage).toBe('habito_minimo');
    expect(state.blockers).toEqual([]);
  });

  it('summarizes the best workspace state across cohorts', () => {
    const workspaces = summarizeWorkspaceStates([
      {
        cohortKey: 'ws-1::user-a',
        workspaceId: 'ws-1',
        activationEventCount: 1,
        activationQualifiedAt: '',
        distinctReviewWeekCount: 0,
        observationDays: 0,
      },
      {
        cohortKey: 'ws-1::user-b',
        workspaceId: 'ws-1',
        activationEventCount: 2,
        activationQualifiedAt: '2026-06-12T20:43:44.420Z',
        distinctReviewWeekCount: 2,
        observationDays: 9,
      },
    ], thresholds);

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({
      workspaceId: 'ws-1',
      stage: 'habito_minimo',
      bestCohortKey: 'ws-1::user-b',
      minimalHabitCohortCount: 1,
    });
  });

  it('blocks the overall result when no workspace reaches minimal habit', () => {
    const result = determineOverallStatus([
      {
        workspaceId: 'ws-1',
        stage: 'revisao_1_semana',
      },
    ], thresholds);

    expect(result.status).toBe('BLOCK');
    expect(result.summary).toContain('SEM EVIDENCIA SUFICIENTE');
  });
});
