import { Money } from '../valueObjects/Money';

export type AccountKind = 'checking' | 'credit_card' | 'savings' | 'investment';

export class Account {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly kind: AccountKind,
    private balance: Money
  ) {}

  getBalance(): Money {
    return this.balance;
  }

  isCreditCard(): boolean {
    return this.kind === 'credit_card';
  }

  isInvestment(): boolean {
    return this.kind === 'investment';
  }

  applyCredit(value: Money): Account {
    return new Account(this.id, this.userId, this.name, this.kind, this.balance.add(value));
  }

  applyDebit(value: Money): Account {
    return new Account(this.id, this.userId, this.name, this.kind, this.balance.subtract(value));
  }
}
