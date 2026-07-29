export type IncomeType =
  | 'salary'
  | 'freelance'
  | 'pro_labore'
  | 'pension'
  | 'rent_income'
  | 'investment'
  | 'other_recurring';

export const SALARY_KEYWORDS: ReadonlyArray<{
  keywords: readonly string[];
  type: IncomeType;
  weight: number;
}> = [
  { keywords: ['salário', 'salario', 'folha pagamento', 'folha de pagamento', 'holerite', 'remuneração', 'remuneracao', 'vencimento'], type: 'salary', weight: 1.0 },
  { keywords: ['pro labore', 'pró labore', 'pro-labore', 'pró-labore', 'honorários', 'honorarios', 'prolabore'], type: 'pro_labore', weight: 0.9 },
  { keywords: ['freelance', 'free lance', 'autônomo', 'autonomo', 'pagamento serviços', 'pagamento de serviços', 'prestação serviços'], type: 'freelance', weight: 0.85 },
  { keywords: ['aposentadoria', 'pensão', 'pensao', 'benefício inss', 'beneficio inss', 'inss', 'previdência', 'previdencia'], type: 'pension', weight: 0.95 },
  { keywords: ['aluguel recebido', 'locação recebida', 'locacao recebida', 'aluguel', 'renda aluguel'], type: 'rent_income', weight: 0.8 },
  { keywords: ['rendimento', 'dividendo', 'jcp', 'juros sobre capital', 'renda fixa', 'cdb', 'lci', 'lca', 'tesouro', 'resgat'], type: 'investment', weight: 0.7 },
  { keywords: ['pagamento recebido', 'pix recebido', 'transferência recebida', 'ted recebida', 'doc recebido', 'crédito em conta'], type: 'other_recurring', weight: 0.5 },
];
