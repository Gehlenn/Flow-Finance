// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  isPluggyProviderEnabled,
  isSupportedOpenFinanceProvider,
} from '../../backend/src/services/openFinance/providerMode';

describe('open finance provider mode', () => {
  it('habilita Pluggy apenas quando provider e pluggy', () => {
    expect(isPluggyProviderEnabled('pluggy')).toBe(true);
    expect(isPluggyProviderEnabled('PLUGGY')).toBe(true);
    expect(isPluggyProviderEnabled(' mock ')).toBe(false);
    expect(isPluggyProviderEnabled('luggy')).toBe(false);
  });

  it('marca apenas mock e pluggy como providers suportados', () => {
    expect(isSupportedOpenFinanceProvider('mock')).toBe(true);
    expect(isSupportedOpenFinanceProvider('pluggy')).toBe(true);
    expect(isSupportedOpenFinanceProvider('luggy')).toBe(false);
    expect(isSupportedOpenFinanceProvider('unknown')).toBe(false);
  });
});
