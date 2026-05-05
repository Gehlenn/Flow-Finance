import { describe, expect, it } from 'vitest';

import { formatMetricsSnapshotTime } from '../../components/MetricsViewer';

describe('MetricsViewer timestamp formatting', () => {
  it('falls back cleanly when the recorded snapshot timestamp is invalid', () => {
    expect(formatMetricsSnapshotTime('invalid-date')).toBe('Horário inválido');
    expect(formatMetricsSnapshotTime(undefined)).toBe('Horário inválido');
  });
});
