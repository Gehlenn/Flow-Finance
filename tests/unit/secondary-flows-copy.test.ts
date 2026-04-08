import { describe, expect, it } from 'vitest';
import { SECONDARY_FLOWS_COPY } from '../../src/app/secondaryFlowsCopy';

describe('secondary flows copy alignment', () => {
  it('keeps goals copy grounded in planning and cash support', () => {
    expect(SECONDARY_FLOWS_COPY.goals.subtitle.toLowerCase()).toContain('caixa');
    expect(SECONDARY_FLOWS_COPY.goals.emptyDescription.toLowerCase()).toContain('planejamento');
  });

  it('keeps import copy focused on review before saving', () => {
    expect(SECONDARY_FLOWS_COPY.import.subtitle.toLowerCase()).toContain('revisao');
    expect(SECONDARY_FLOWS_COPY.import.dropzoneFormats.toLowerCase()).not.toContain('ia');
  });

  it('keeps scanner copy focused on extraction with review', () => {
    expect(SECONDARY_FLOWS_COPY.scanner.subtitle.toLowerCase()).toContain('revisao');
    expect(SECONDARY_FLOWS_COPY.scanner.scanCta.toLowerCase()).toContain('extrair');
  });
});
