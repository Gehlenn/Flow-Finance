export const VALID_CATEGORIES = ['Pessoal', 'Trabalho', 'Negócio', 'Investimento'] as const;

export type CategoryType = (typeof VALID_CATEGORIES)[number];

export class Category {
  constructor(private readonly value: string) {
    if (!VALID_CATEGORIES.includes(value as CategoryType)) {
      throw new Error(`Invalid category: ${value}`);
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: Category): boolean {
    return this.value === other.value;
  }
}
