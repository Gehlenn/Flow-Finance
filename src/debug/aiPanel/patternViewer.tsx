import React from 'react';
import { financialPatternDetector } from '../../engines/finance/patternDetector/financialPatternDetector';

export function PatternViewer() {
  const patterns = financialPatternDetector.getPatterns();

  return (
    <section>
      <h2>Detected Patterns</h2>
      <pre>{JSON.stringify(patterns, null, 2)}</pre>
    </section>
  );
}
