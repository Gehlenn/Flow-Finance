export type AccountType =
  | "bank"
  | "cash"
  | "credit_card"
  | "investment";

export interface Account {
  id: string;
  user_id: string;

  name: string;
  type: AccountType;

  balance: number;

  currency: string;

  created_at: string;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Conta Bancária",
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  investment: "Investimento",
};

export const DEFAULT_ACCOUNT: Omit<Account, "id" | "user_id" | "created_at"> = {
  name: "Carteira",
  type: "cash",
  balance: 0,
  currency: "BRL",
};
