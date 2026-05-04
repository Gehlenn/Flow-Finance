import { describe, expect, it } from 'vitest';

import { createDefaultSimulationScenario } from '../../pages/AIControlPanel';

describe('AIControlPanel simulation scenario defaults', () => {
  it('resets extra spending scenario to the canonical defaults', () => {
    expect(createDefaultSimulationScenario('extra_spending')).toEqual({
      type: 'extra_spending',
      amount: 500,
      description: 'uma viagem de fim de semana',
    });
  });

  it('resets monthly savings scenario to the canonical defaults', () => {
    expect(createDefaultSimulationScenario('monthly_savings')).toEqual({
      type: 'monthly_savings',
      amount: 500,
      description: 'uma viagem de fim de semana',
    });
  });

  it('resets months scenario to the canonical defaults', () => {
    expect(createDefaultSimulationScenario('months')).toEqual({
      type: 'months',
      months: 3,
      description: 'uma viagem de fim de semana',
    });
  });
});
