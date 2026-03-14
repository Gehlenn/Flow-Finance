import type { FinanceCategory } from './transactionCategorizer';

export const categorizationRules: Record<string, FinanceCategory> = {
  uber: 'transporte',
  '99': 'transporte',
  ifood: 'alimentacao',
  zaffari: 'alimentacao',
  netflix: 'assinaturas',
  spotify: 'assinaturas',
  farmacia: 'saude',
  shell: 'combustivel',
  ipiranga: 'combustivel',
};
