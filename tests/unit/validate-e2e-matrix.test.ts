import { describe, expect, it } from 'vitest';
import { hasAnyProjectFlag, parseArgs } from '../../scripts/validate-e2e-matrix.mjs';

describe('validate-e2e-matrix parser', () => {
  it('normalizes --project= values so Playwright receives safe arguments', () => {
    const parsed = parseArgs(['--project=Mobile Chrome']);

    expect(parsed.dryRun).toBe(false);
    expect(parsed.args).toEqual(['--project', 'Mobile Chrome']);
    expect(hasAnyProjectFlag(parsed.args)).toBe(true);
  });

  it('keeps dry-run mode and strips the dry-run flag from forwarded args', () => {
    const parsed = parseArgs(['--dry-run', '--project=chromium']);

    expect(parsed.dryRun).toBe(true);
    expect(parsed.args).toEqual(['--project', 'chromium']);
  });
});
