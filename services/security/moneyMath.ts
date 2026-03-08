/**
 * SECURE MONEY MATH — Cálculos financeiros seguros
 *
 * Usa decimal.js para evitar erros de ponto flutuante em cálculos monetários.
 */

import Decimal from 'decimal.js';

Decimal.set({ precision: 10, rounding: 4 });

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