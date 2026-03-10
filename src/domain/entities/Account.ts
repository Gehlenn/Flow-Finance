import { Money } from '../valueObjects/Money';

export class Account {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: 'bank' | 'cash' | 'credit_card' | 'investment',
    private balance: Money
  ) {}

  getBalance(): Money {
    return this.balance;
  }

  applyCredit(value: Money): Account {
    return new Account(this.id, this.name, this.type, this.balance.add(value));
  }

  applyDebit(value: Money): Account {
    return new Account(this.id, this.name, this.type, this.balance.subtract(value));
  }
}
