import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  convertCurrency,
  formatCurrency,
  getFromStorage,
  getMonthTransactions,
  makeId,
} from '../../src/utils/helpers';

const logWarnMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    logWarnMock.mockReset();
  });

  it('makeId returns strings with requested length', () => {
    const id = makeId(12);
    expect(id).toHaveLength(12);
  });

  it('formatCurrency renders BRL formatted value', () => {
    const value = formatCurrency(1234.5);
    expect(value).toContain('1.234,50');
  });

  it('convertCurrency converts amount between different currencies', () => {
    const rates = {
      BRL: 1,
      USD: 0.2,
      EUR: 0.18,
    };

    const converted = convertCurrency(100, 'BRL', 'USD', rates);
    expect(converted).toBe(20);
  });

  it('convertCurrency returns original amount for same currency', () => {
    const rates = { BRL: 1 };
    expect(convertCurrency(50, 'BRL', 'BRL', rates)).toBe(50);
  });

  it('convertCurrency throws when rate is missing', () => {
    const rates = { BRL: 1 };
    expect(() => convertCurrency(50, 'BRL', 'USD', rates)).toThrow(/Missing exchange rate/i);
  });

  it('convertCurrency identifies missing source rate correctly', () => {
    const rates = { USD: 0.2 };
    expect(() => convertCurrency(50, 'BRL', 'USD', rates)).toThrow(/BRL/i);
  });

  it('convertCurrency throws when amount is not finite', () => {
    expect(() => convertCurrency(Number.NaN, 'BRL', 'USD', { BRL: 1, USD: 0.2 })).toThrow(/finite number/i);
  });

  it('getMonthTransactions filters by month and year', () => {
    const transactions = [
      { date: '2026-03-10T12:00:00.000Z' },
      { date: '2026-03-20T12:00:00.000Z' },
      { date: '2026-02-10T12:00:00.000Z' },
    ];

    const result = getMonthTransactions(transactions, new Date('2026-03-25T00:00:00.000Z'));
    expect(result).toHaveLength(2);
  });

  it('getMonthTransactions ignora o mesmo mes em outro ano', () => {
    const transactions = [
      { date: '2025-03-10' },
      { date: '2026-03-15' },
      { date: '2026-04-01' },
    ];

    const result = getMonthTransactions(transactions, new Date('2026-03-25T00:00:00.000Z'));
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-15');
  });

  it('getMonthTransactions ignora datas invalidadas mesmo quando parecem date-only', () => {
    const transactions = [
      { date: '2026-03-10' },
      { date: '2026-02-31' },
      { date: 'not-a-date' },
    ];

    const result = getMonthTransactions(transactions, new Date('2026-03-25T00:00:00.000Z'));
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-10');
  });

  it('getFromStorage returns default value for missing and invalid JSON', () => {
    const fallback = { ok: false };
    expect(getFromStorage('missing', fallback)).toEqual(fallback);

    localStorage.setItem('empty', '');
    expect(getFromStorage('empty', fallback)).toEqual(fallback);

    localStorage.setItem('invalid', '{nope');
    expect(getFromStorage('invalid', fallback)).toEqual(fallback);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[Helpers] Failed to parse storage entry; returning default value',
      expect.objectContaining({
        key: 'invalid',
        error: expect.any(Error),
      }),
    );
  });

  it('getFromStorage returns parsed JSON for valid entry', () => {
    const payload = { ok: true, amount: 10 };
    localStorage.setItem('valid', JSON.stringify(payload));

    expect(getFromStorage('valid', { ok: false, amount: 0 })).toEqual(payload);
  });
});
