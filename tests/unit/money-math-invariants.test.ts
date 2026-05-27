import { describe, expect, it } from 'vitest';
import {
  addMoney,
  fromCents,
  subtractMoney,
  sumTransactions,
  toCents,
} from '../../src/security/moneyMath';

function createDeterministicAmounts(count: number): number[] {
  let seed = 123456789;

  return Array.from({ length: count }, () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    const cents = (seed % 99999) + 1;
    return cents / 100;
  });
}

describe('moneyMath invariants', () => {
  it('sums decimal fractions exactly', () => {
    expect(sumTransactions([0.1, 0.2])).toBe(0.3);
  });

  it('matches integer-cent aggregation across many monetary values', () => {
    const amounts = createDeterministicAmounts(1000);
    const total = sumTransactions(amounts);
    const centsTotal = amounts.reduce((sum, amount) => sum + toCents(amount), 0);
    const centsAsMoney = fromCents(centsTotal);

    expect(Math.abs(total - centsAsMoney)).toBeLessThanOrEqual(0.005);
  });

  it('adds money without float drift', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it('subtracts money without float drift', () => {
    expect(subtractMoney(1.0, 0.1)).toBe(0.9);
  });
});
