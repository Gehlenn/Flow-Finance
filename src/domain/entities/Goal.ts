import { Money } from '../valueObjects/Money';

export class Goal {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly targetAmount: Money,
    public readonly currentAmount: Money
  ) {}

  progress(): number {
    const target = this.targetAmount.toNumber();
    if (target <= 0) return 0;
    return Math.min(100, (this.currentAmount.toNumber() / target) * 100);
  }

  isCompleted(): boolean {
    return this.currentAmount.toNumber() >= this.targetAmount.toNumber();
  }
}
