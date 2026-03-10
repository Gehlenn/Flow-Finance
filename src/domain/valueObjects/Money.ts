import Decimal from 'decimal.js';

export class Money {
  private readonly value: Decimal;

  constructor(amount: number | string | Decimal) {
    this.value = new Decimal(amount);
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  multiply(multiplier: number): Money {
    return new Money(this.value.times(multiplier));
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  toString(): string {
    return this.value.toFixed(2);
  }
}
