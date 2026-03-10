export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string
  ) {}

  firstName(): string {
    return this.name.split(' ')[0] || this.name;
  }
}
