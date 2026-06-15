#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  discoverExportBundles,
  summarizeHabitEvidence,
} from './check-habit-proof-evidence.mjs';

const RUNNER_NAME = 'Cohort state summary runner';
const DEFAULT_EXPORT_ROOT = path.resolve(process.cwd(), 'test-results/activation-retention-export');
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'test-results/cohort-state');
const DEFAULT_CANONICAL_SINCE = '2026-06-12T20:44:49.665Z';

const STAGE_ORDER = {
  nao_ativado: 0,
  bloqueado: 1,
  ativado_qualificado: 2,
  revisao_1_semana: 3,
  habito_minimo: 4,
};

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(filePath) {
  return normalizeSlashes(path.relative(process.cwd(), filePath));
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parsePositiveInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    for (const name of [
      'export-root',
      'output-dir',
      'canonical-since',
      'min-distinct-review-weeks',
      'min-observation-days',
      'min-cohorts',
    ]) {
      if (token === `--${name}`) {
        args[toCamel(name)] = argv[index + 1];
        index += 1;
        break;
      }
      if (token.startsWith(`--${name}=`)) {
        args[toCamel(name)] = token.slice(name.length + 3);
        break;
      }
    }
  }
  return args;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function classifyCohortState(cohort, thresholds) {
  if (!cohort || !cohort.activationEventCount) {
    return {
      stage: 'nao_ativado',
      blockers: ['no activation event was observed for this workspace/user cohort'],
    };
  }

  if (!cohort.activationQualifiedAt) {
    return {
      stage: 'bloqueado',
      blockers: ['activation was not qualified by dashboard usefulness or completed financial base'],
    };
  }

  const blockers = [];
  if (cohort.distinctReviewWeekCount < thresholds.minDistinctReviewWeeks) {
    blockers.push(`needs ${thresholds.minDistinctReviewWeeks} distinct review week(s) after qualified activation`);
  }
  if (cohort.observationDays < thresholds.minObservationDays) {
    blockers.push(`needs ${thresholds.minObservationDays} observation day(s) after qualified activation`);
  }

  if (blockers.length === 0) {
    return {
      stage: 'habito_minimo',
      blockers: [],
    };
  }

  if (cohort.distinctReviewWeekCount >= 1) {
    return {
      stage: 'revisao_1_semana',
      blockers,
    };
  }

  return {
    stage: 'ativado_qualificado',
    blockers,
  };
}

function summarizeWorkspaceStates(cohortSummaries, thresholds) {
  const grouped = new Map();

  for (const cohort of cohortSummaries) {
    const workspaceId = cohort.workspaceId || 'unknown_workspace';
    const state = classifyCohortState(cohort, thresholds);
    const item = {
      ...cohort,
      stage: state.stage,
      blockers: state.blockers,
    };
    const bucket = grouped.get(workspaceId) ?? [];
    bucket.push(item);
    grouped.set(workspaceId, bucket);
  }

  const workspaces = [];
  for (const [workspaceId, cohorts] of grouped.entries()) {
    cohorts.sort((left, right) => {
      const stageDelta = STAGE_ORDER[right.stage] - STAGE_ORDER[left.stage];
      if (stageDelta !== 0) return stageDelta;
      if (right.distinctReviewWeekCount !== left.distinctReviewWeekCount) {
        return right.distinctReviewWeekCount - left.distinctReviewWeekCount;
      }
      return right.observationDays - left.observationDays;
    });

    const best = cohorts[0];
    workspaces.push({
      workspaceId,
      stage: best.stage,
      cohortCount: cohorts.length,
      qualifiedCohortCount: cohorts.filter((cohort) => Boolean(cohort.activationQualifiedAt)).length,
      minimalHabitCohortCount: cohorts.filter((cohort) => cohort.stage === 'habito_minimo').length,
      bestCohortKey: best.cohortKey,
      blockers: best.blockers,
      cohorts,
    });
  }

  workspaces.sort((left, right) => {
    const stageDelta = STAGE_ORDER[right.stage] - STAGE_ORDER[left.stage];
    if (stageDelta !== 0) return stageDelta;
    return left.workspaceId.localeCompare(right.workspaceId);
  });

  return workspaces;
}

function determineOverallStatus(workspaces, thresholds) {
  const minimalHabitWorkspaces = workspaces.filter((workspace) => workspace.stage === 'habito_minimo');
  const status = minimalHabitWorkspaces.length >= thresholds.minCohorts ? 'PASS' : 'BLOCK';
  const reasons = [];

  if (workspaces.length === 0) {
    reasons.push('no workspace cohorts were observed in canonical export bundles');
  }
  if (minimalHabitWorkspaces.length < thresholds.minCohorts) {
    reasons.push(`only ${minimalHabitWorkspaces.length} workspace(s) reached minimal habit; ${thresholds.minCohorts} required`);
  }

  return {
    status,
    summary: status === 'PASS'
      ? 'PASS: workspace cohort state reached the declared minimal habit threshold'
      : 'BLOCK: SEM EVIDENCIA SUFICIENTE para declarar habito minimo por workspace',
    reasons,
  };
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function buildMarkdown(payload) {
  const lines = [
    '# Flow Finance - cohort state by workspace',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- canonical bundles considered: ${payload.summary.canonicalBundleCount}`,
    `- workspace count: ${payload.summary.workspaceCount}`,
    '',
    '## Thresholds',
    '',
    `- min distinct review weeks: ${payload.inputs.minDistinctReviewWeeks}`,
    `- min observation days: ${payload.inputs.minObservationDays}`,
    `- min cohorts: ${payload.inputs.minCohorts}`,
  ];

  if (payload.result.reasons.length > 0) {
    lines.push('', '## Blockers', '');
    for (const reason of payload.result.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  lines.push('', '## Workspace states', '');
  if (payload.summary.workspaces.length === 0) {
    lines.push('- none');
  } else {
    for (const workspace of payload.summary.workspaces) {
      lines.push(`- workspace: ${workspace.workspaceId}`);
      lines.push(`  - stage: ${workspace.stage}`);
      lines.push(`  - best cohort: ${workspace.bestCohortKey}`);
      lines.push(`  - qualified cohorts: ${workspace.qualifiedCohortCount}/${workspace.cohortCount}`);
      lines.push(`  - minimal habit cohorts: ${workspace.minimalHabitCohortCount}`);
      if (workspace.blockers.length > 0) {
        lines.push(`  - blockers: ${workspace.blockers.join('; ')}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

async function writeArtifact(outputRoot, payload) {
  await fs.mkdir(outputRoot, { recursive: true });
  const runDir = path.join(outputRoot, formatTimestamp(new Date()));
  await fs.mkdir(runDir, { recursive: true });
  const jsonPath = path.join(runDir, 'report.json');
  const mdPath = path.join(runDir, 'report.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, buildMarkdown(payload), 'utf8');
  return { jsonPath, mdPath };
}

function printHelp() {
  process.stdout.write([
    'Flow Finance cohort state summary runner',
    '',
    'Usage:',
    '  node scripts/summarize-cohort-state.mjs [--export-root <dir>] [--output-dir <dir>]',
    '    [--canonical-since <iso-date>] [--min-distinct-review-weeks <n>]',
    '    [--min-observation-days <n>] [--min-cohorts <n>]',
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const exportRoot = path.resolve(process.cwd(), args.exportRoot || readEnv('COHORT_STATE_EXPORT_ROOT') || DEFAULT_EXPORT_ROOT);
  const outputRoot = path.resolve(process.cwd(), args.outputDir || readEnv('COHORT_STATE_OUTPUT_DIR') || DEFAULT_OUTPUT_ROOT);
  const canonicalSince = args.canonicalSince || readEnv('COHORT_STATE_CANONICAL_SINCE') || DEFAULT_CANONICAL_SINCE;
  const canonicalSinceMs = parseTimestamp(canonicalSince);
  if (canonicalSinceMs === null) {
    throw new Error(`invalid canonical cutoff: ${canonicalSince}`);
  }

  const thresholds = {
    minDistinctReviewWeeks: parsePositiveInteger(args.minDistinctReviewWeeks ?? readEnv('COHORT_STATE_MIN_DISTINCT_REVIEW_WEEKS'), 2),
    minObservationDays: parsePositiveInteger(args.minObservationDays ?? readEnv('COHORT_STATE_MIN_OBSERVATION_DAYS'), 7),
    minCohorts: parsePositiveInteger(args.minCohorts ?? readEnv('COHORT_STATE_MIN_COHORTS'), 1),
  };

  const discovery = await discoverExportBundles(exportRoot, canonicalSinceMs);
  const habitSummary = summarizeHabitEvidence(discovery.bundles);
  const workspaces = summarizeWorkspaceStates(habitSummary.cohortSummaries, thresholds);
  const result = determineOverallStatus(workspaces, thresholds);
  const timestamp = new Date().toISOString();

  const payload = {
    runnerName: RUNNER_NAME,
    timestamp,
    inputs: {
      exportRoot: rel(exportRoot),
      outputRoot: rel(outputRoot),
      canonicalSince,
      ...thresholds,
    },
    discovery: {
      ignored: discovery.ignored,
      bundleRunIds: discovery.bundles.map((bundle) => bundle.runId),
    },
    summary: {
      canonicalBundleCount: habitSummary.canonicalBundleCount,
      cohortCount: habitSummary.cohortCount,
      workspaceCount: workspaces.length,
      workspaces,
    },
    result,
  };

  const artifacts = await writeArtifact(outputRoot, payload);

  process.stdout.write('Flow Finance - cohort state by workspace\n');
  process.stdout.write('=========================================\n');
  process.stdout.write(`Result: ${payload.result.status}\n`);
  process.stdout.write(`Summary: ${payload.result.summary}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);
  process.stdout.write(`Workspaces: ${workspaces.length}\n`);
  for (const workspace of workspaces) {
    process.stdout.write(`- ${workspace.workspaceId}: ${workspace.stage}\n`);
  }
  if (payload.result.reasons.length > 0) {
    for (const reason of payload.result.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
  }

  process.exitCode = payload.result.status === 'PASS' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  classifyCohortState,
  determineOverallStatus,
  parseArgs,
  summarizeWorkspaceStates,
};
