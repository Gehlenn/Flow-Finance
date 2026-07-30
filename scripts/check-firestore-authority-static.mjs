#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT } from '../backend/scripts/firestore-ai-usage-backfill-contract.mjs';

export const FIRESTORE_AI_USAGE_AUTHORITY_ENV_KEY = 'FIRESTORE_AI_USAGE_AUTHORITY_ENABLED';
export const FIRESTORE_RULES_BEHAVIORAL_TEST_COMMAND = 'npm run test:firestore:rules';
export const AUTHORITY_ENV_TEMPLATE_PATHS = ['.env.example', 'backend/.env.example'];

function parseEnvAssignments(raw) {
  const assignments = new Map();

  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    assignments.set(key, value);
  }

  return assignments;
}

function hasRequiredEventsIndex(indexes) {
  if (!Array.isArray(indexes)) return false;

  return indexes.some((index) => (
    index?.collectionGroup === 'events' &&
    index.queryScope === 'COLLECTION' &&
    Array.isArray(index.fields) &&
    index.fields.length === 2 &&
    index.fields[0]?.fieldPath === 'outcome' &&
    index.fields[0]?.order === 'ASCENDING' &&
    index.fields[1]?.fieldPath === 'createdAt' &&
    index.fields[1]?.order === 'DESCENDING'
  ));
}

function hasFirestoreRulesTestStep(workflow) {
  const lines = String(workflow).split(/\r?\n/);
  return lines.some((line) => line.trim() === `run: ${FIRESTORE_RULES_BEHAVIORAL_TEST_COMMAND}`);
}

export function evaluateFirestoreAuthorityStaticReadiness({
  envExamples,
  firebaseConfig,
  firestoreIndexes,
  backfillContract,
  firestoreRulesWorkflow,
}) {
  const checks = {
    authorityDisabledByDefault: AUTHORITY_ENV_TEMPLATE_PATHS.every((templatePath) => (
      parseEnvAssignments(envExamples?.[templatePath]).get(FIRESTORE_AI_USAGE_AUTHORITY_ENV_KEY) === 'false'
    )),
    firebaseConfigPinsFirestoreArtifacts: (
      firebaseConfig?.firestore?.rules === 'firestore.rules' &&
      firebaseConfig?.firestore?.indexes === 'firestore.indexes.json'
    ),
    requiredEventsIndexVersioned: hasRequiredEventsIndex(firestoreIndexes?.indexes),
    backfillDryRunContract: (
      backfillContract?.defaultMode === 'dry-run' &&
      backfillContract?.applyFlag === '--apply' &&
      backfillContract?.requiresExplicitApply === true
    ),
    behavioralRulesProofVersioned: hasFirestoreRulesTestStep(firestoreRulesWorkflow),
  };

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
    productionActivation: {
      ready: false,
      blockers: [
        'Static configuration cannot prove the Firestore index is deployed.',
        'Static configuration cannot prove the runtime principal has effective IAM.',
        'Static configuration cannot prove a quiescent successful backfill.',
        'FIRESTORE_AI_USAGE_AUTHORITY_ENABLED must remain disabled until those operational checks are complete.',
      ],
    },
  };
}

export function loadFirestoreAuthorityStaticInputs(repoRoot = process.cwd()) {
  const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const readJson = (relativePath) => JSON.parse(readText(relativePath));

  return {
    envExamples: Object.fromEntries(
      AUTHORITY_ENV_TEMPLATE_PATHS.map((templatePath) => [templatePath, readText(templatePath)]),
    ),
    firebaseConfig: readJson('firebase.json'),
    firestoreIndexes: readJson('firestore.indexes.json'),
    backfillContract: FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT,
    firestoreRulesWorkflow: readText('.github/workflows/firestore-rules.yml'),
  };
}

export function runFirestoreAuthorityStaticGate(repoRoot = process.cwd()) {
  return evaluateFirestoreAuthorityStaticReadiness(loadFirestoreAuthorityStaticInputs(repoRoot));
}

function printReport(result) {
  process.stdout.write('Flow Finance - Firestore Authority Static Gate\n');
  process.stdout.write('===============================================\n');

  for (const [name, passed] of Object.entries(result.checks)) {
    process.stdout.write(`${passed ? 'PASS' : 'FAIL'}: ${name}\n`);
  }

  process.stdout.write(`\nstaticConfig: ${result.ready ? 'PASS' : 'FAIL'}\n`);
  process.stdout.write('productionActivation: BLOCKED (this gate does not prove deployed index, effective IAM, or a quiescent successful backfill).\n');
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  try {
    const result = runFirestoreAuthorityStaticGate();
    printReport(result);
    process.exitCode = result.ready ? 0 : 1;
  } catch (error) {
    process.stderr.write(`[firestore-authority-static] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
