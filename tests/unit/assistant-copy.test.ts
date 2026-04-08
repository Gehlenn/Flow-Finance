import { describe, expect, it } from 'vitest';
import { AI_CFO_COPY, ASSISTANT_COPY } from '../../src/app/assistantCopy';

describe('assistant microcopy alignment', () => {
  it('keeps AI CFO copy consultative and grounded', () => {
    expect(AI_CFO_COPY.headerTitle).toBe('Consultor IA');
    expect(AI_CFO_COPY.headerSubtitle.toLowerCase()).toContain('caixa');
    expect(AI_CFO_COPY.headerSubtitle.toLowerCase()).toContain('recebimentos');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('dados registrados');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('receitas previstas');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('receitas confirmadas');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).toContain('cobrancas pendentes');
    expect(AI_CFO_COPY.welcomeDescription.toLowerCase()).not.toContain('mágico');
  });

  it('keeps assistant copy focused on operation and cash support', () => {
    expect(ASSISTANT_COPY.headerSubtitle.toLowerCase()).toContain('operacao');
    expect(ASSISTANT_COPY.headerSubtitle.toLowerCase()).toContain('caixa');
    expect(ASSISTANT_COPY.smartAlertsCta.toLowerCase()).toContain('limites');
  });
});
