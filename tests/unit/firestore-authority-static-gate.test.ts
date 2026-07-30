import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  evaluateFirestoreAuthorityStaticReadiness,
  loadFirestoreAuthorityStaticInputs,
  runFirestoreAuthorityStaticGate,
} from '../../scripts/check-firestore-authority-static.mjs';
import {
  FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT,
  parseFirestoreAiUsageBackfillMode,
} from '../../backend/scripts/firestore-ai-usage-backfill-contract.mjs';

const repoRoot = process.cwd();

function currentInputs() {
  return loadFirestoreAuthorityStaticInputs(repoRoot);
}

describe('Firestore authority static gate', () => {
  it('keeps dry-run as the default and accepts apply only explicitly', () => {
    expect(FIRESTORE_AI_USAGE_BACKFILL_CLI_CONTRACT).toMatchObject({
      defaultMode: 'dry-run',
      applyFlag: '--apply',
      requiresExplicitApply: true,
    });
    expect(parseFirestoreAiUsageBackfillMode([])).toBe('dry-run');
    expect(parseFirestoreAiUsageBackfillMode(['--apply'])).toBe('apply');
    expect(() => parseFirestoreAiUsageBackfillMode(['--dry-run'])).toThrow(/Usage:/);
  });

  it('accepts the versioned authority prerequisites', () => {
    expect(runFirestoreAuthorityStaticGate(repoRoot)).toEqual({
      ready: true,
      checks: {
        authorityDisabledByDefault: true,
        firebaseConfigPinsFirestoreArtifacts: true,
        requiredEventsIndexVersioned: true,
        backfillDryRunContract: true,
        behavioralRulesProofVersioned: true,
      },
      productionActivation: {
        ready: false,
        blockers: expect.arrayContaining([
          expect.stringContaining('cannot prove the Firestore index is deployed'),
          expect.stringContaining('cannot prove the runtime principal has effective IAM'),
          expect.stringContaining('cannot prove a quiescent successful backfill'),
        ]),
      },
    });
  });

  it('fails when the staged authority default is enabled', () => {
    const inputs = currentInputs();
    const result = evaluateFirestoreAuthorityStaticReadiness({
      ...inputs,
      envExamples: {
        ...inputs.envExamples,
        'backend/.env.example': inputs.envExamples['backend/.env.example'].replace(
          'FIRESTORE_AI_USAGE_AUTHORITY_ENABLED=false',
          'FIRESTORE_AI_USAGE_AUTHORITY_ENABLED=true',
        ),
      },
    });

    expect(result.ready).toBe(false);
    expect(result.checks.authorityDisabledByDefault).toBe(false);
  });

  it('fails when the exact composite index is absent', () => {
    const inputs = currentInputs();
    const result = evaluateFirestoreAuthorityStaticReadiness({
      ...inputs,
      firestoreIndexes: { indexes: [] },
    });

    expect(result.ready).toBe(false);
    expect(result.checks.requiredEventsIndexVersioned).toBe(false);
  });

  it('fails when the composite index direction or firebase rules path changes', () => {
    const inputs = currentInputs();
    const result = evaluateFirestoreAuthorityStaticReadiness({
      ...inputs,
      firebaseConfig: {
        ...inputs.firebaseConfig,
        firestore: { ...inputs.firebaseConfig.firestore, rules: 'other.rules' },
      },
      firestoreIndexes: {
        indexes: [{
          collectionGroup: 'events',
          queryScope: 'COLLECTION',
          fields: [
            { fieldPath: 'outcome', order: 'DESCENDING' },
            { fieldPath: 'createdAt', order: 'DESCENDING' },
          ],
        }],
      },
    });

    expect(result.ready).toBe(false);
    expect(result.checks.firebaseConfigPinsFirestoreArtifacts).toBe(false);
    expect(result.checks.requiredEventsIndexVersioned).toBe(false);
  });

  it('fails if the backfill contract stops requiring explicit apply mode', () => {
    const inputs = currentInputs();
    const result = evaluateFirestoreAuthorityStaticReadiness({
      ...inputs,
      backfillContract: {
        defaultMode: 'dry-run',
        applyFlag: '--apply',
        requiresExplicitApply: false,
      },
    });

    expect(result.ready).toBe(false);
    expect(result.checks.backfillDryRunContract).toBe(false);
  });

  it('keeps the package entry point and behavioral Rules proof versioned', () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const inputs = currentInputs();

    expect(packageJson.scripts?.['health:firestore-authority:static'])
      .toBe('node scripts/check-firestore-authority-static.mjs');

    const result = evaluateFirestoreAuthorityStaticReadiness({
      ...inputs,
      firestoreRulesWorkflow: inputs.firestoreRulesWorkflow.replace(
        'run: npm run test:firestore:rules',
        'run: npm run test:unit',
      ),
    });

    expect(result.ready).toBe(false);
    expect(result.checks.behavioralRulesProofVersioned).toBe(false);
  });
});
