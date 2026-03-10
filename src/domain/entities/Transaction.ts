import { Category } from '../valueObjects/Category';
import { Money } from '../valueObjects/Money';

export class Transaction {
  constructor(
    public readonly id: string,
    public readonly amount: Money,
    public readonly category: Category,
    public readonly date: Date,
    public readonly description: string = ''
  ) {}

  isExpense(): boolean {
    return this.amount.isNegative();
  }

  isIncome(): boolean {
    return !this.isExpense();
  }
}
