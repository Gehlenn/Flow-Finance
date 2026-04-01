import type { FinanceCategory } from './transactionCategorizer';

export const categorizationRules: Record<string, FinanceCategory> = {
  // Transporte
  uber: 'transporte',
  'uber trip': 'transporte',
  'uber do brasil': 'transporte',
  'uber bv': 'transporte',
  '99': 'transporte',
  '99 tecnologia': 'transporte',
  '99app': 'transporte',
  '99 taxi': 'transporte',

  // Alimentação
  ifood: 'alimentacao',
  'ifood*pedido': 'alimentacao',
  rappi: 'alimentacao',
  'rappi br': 'alimentacao',
  'rappi*pedido': 'alimentacao',
  zaffari: 'alimentacao',
  mcdonalds: 'alimentacao',
  'burger king': 'alimentacao',

  // Assinaturas
  netflix: 'assinaturas',
  'netflix.com': 'assinaturas',
  'netflix br': 'assinaturas',
  'netflix servicos': 'assinaturas',
  spotify: 'assinaturas',
  'spotify ab': 'assinaturas',
  spotfy: 'assinaturas',
  spofity: 'assinaturas',
  sptofy: 'assinaturas',
  sptify: 'assinaturas',
  soptify: 'assinaturas',
  spoitfy: 'assinaturas',
  spootify: 'assinaturas',
  spootfy: 'assinaturas',
  spottify: 'assinaturas',
  spottfy: 'assinaturas',
  spofy: 'assinaturas',
  'deezer': 'assinaturas',
  'deezer s.a.': 'assinaturas',
  'prime video': 'assinaturas',
  'amazon prime': 'assinaturas',
  'amzn': 'assinaturas',
  amazn: 'assinaturas',
  'amzn mktplc': 'assinaturas',
  'apple.com/bill': 'assinaturas',
  'google play': 'assinaturas',
  'youtube premium': 'assinaturas',

  // Saúde
  farmacia: 'saude',

  // Combustível
  shell: 'combustivel',
  ipiranga: 'combustivel',

  // Outros populares
  'mercado livre': 'compras',
  'mercadolivre': 'compras',
  'magalu': 'compras',
  'americanas': 'compras',
  'google': 'servicos',
  'apple': 'servicos',
  'nubank': 'banco',
};
