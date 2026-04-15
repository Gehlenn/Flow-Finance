import { describe, expect, it } from 'vitest';
import { AI_CFO_COPY, ASSISTANT_COPY } from '../../src/app/assistantCopy';

describe('assistant microcopy alignment', () => {
  it('keeps AI CFO copy consultative and grounded', () => {
    expect(AI_CFO_COPY.headerTitle).toBe('Apoio Financeiro');
    expect(AI_CFO_COPY.headerSubtitle.toLowerCase()).toContain('caixa');
    expect(AI_CFO_COPY.headerSubtitle.toLowerCase()).toContain('dados');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('dados reais');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('historico');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('pendencias');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).not.toContain('magico');
  });

  it('keeps assistant copy focused on operation and cash support', () => {
    expect(ASSISTANT_COPY.headerTitle).toBe('Assistente Financeiro');
    expect(ASSISTANT_COPY.headerSubtitle.toLowerCase()).toContain('caixa');
    expect(ASSISTANT_COPY.headerSubtitle.toLowerCase()).toContain('rotina');
    expect(ASSISTANT_COPY.smartAlertsCta.toLowerCase()).toContain('limite');
  });
});
