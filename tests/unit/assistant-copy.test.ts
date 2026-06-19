import { describe, expect, it } from 'vitest';
import { AI_CFO_COPY, ASSISTANT_COPY } from '../../src/app/assistantCopy';

describe('assistant microcopy alignment', () => {
  it('keeps AI CFO copy consultative and grounded', () => {
    expect(AI_CFO_COPY.headerTitle).toBe('Consultor de caixa');
    expect(AI_CFO_COPY.headerSubtitle.toLowerCase()).toContain('caixa');
    expect(AI_CFO_COPY.headerSubtitle.toLowerCase()).toContain('base usada');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('vencimentos');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('recebiveis');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('operacao');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).not.toContain('magico');
  });

  it('keeps assistant copy focused on operation and cash support', () => {
    expect(ASSISTANT_COPY.headerTitle).toBe('Consultor de caixa');
    expect(ASSISTANT_COPY.headerSubtitle.toLowerCase()).toContain('caixa');
    expect(ASSISTANT_COPY.headerSubtitle.toLowerCase()).toContain('resposta direta');
    expect(ASSISTANT_COPY.smartAlertsCta.toLowerCase()).toContain('caixa');
    expect(ASSISTANT_COPY.timelineTitle.toLowerCase()).toContain('caixa');
  });
});
