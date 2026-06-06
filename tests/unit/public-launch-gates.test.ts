import { describe, expect, it } from 'vitest';

import { isVerifiedEvidenceArtifact } from '../../scripts/check-public-launch-gates.mjs';

describe('check-public-launch-gates verified evidence', () => {
  it('accepts only verified manual evidence artifacts', () => {
    expect(isVerifiedEvidenceArtifact({ verified: true })).toBe(true);
    expect(isVerifiedEvidenceArtifact({ verified: false })).toBe(false);
    expect(isVerifiedEvidenceArtifact({ summary: 'missing verified flag' })).toBe(false);
    expect(isVerifiedEvidenceArtifact(null)).toBe(false);
  });
});
