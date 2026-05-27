/**
 * SECURE MONEY MATH — Cálculos financeiros seguros
 *
 * Usa decimal.js para evitar erros de ponto flutuante em cálculos monetários.
 */

import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: 4 });

export function roundMoney(n: number, decimals = 2): number {
  return new Decimal(n).toDecimalPlaces(decimals).toNumber();
}

export function toCents(n: number): number {
  return new Decimal(n).mul(100).toDecimalPlaces(0).toNumber();
}

export function fromCents(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

export function addMoney(a: number, b: number): number {
  return new Decimal(a).add(new Decimal(b)).toNumber();
}

export function subtractMoney(a: number, b: number): number {
  return new Decimal(a).sub(new Decimal(b)).toNumber();
}

export function multiplyMoney(a: number, b: number): number {
  return new Decimal(a).mul(new Decimal(b)).toNumber();
}

export function divideMoney(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return new Decimal(a).div(new Decimal(b)).toNumber();
}

export function sumTransactions(amounts: number[]): number {
  return amounts.reduce((sum, amt) => addMoney(sum, amt), 0);
}

export function compareMoney(a: number, b: number): number {
  return new Decimal(a).comparedTo(new Decimal(b));
}
