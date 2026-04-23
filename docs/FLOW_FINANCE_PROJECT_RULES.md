# Flow Finance - Regras do Projeto (Fonte Canônica)

Este documento consolida as regras de operação e execução do Flow Finance.

## Princípios

- Flow Finance é um sistema financeiro: integridade e rastreabilidade vêm antes de velocidade.
- Web e mobile são alvos de primeira classe.
- Quando houver conflito entre documentação e código, o código vence e a documentação deve ser atualizada na mesma passada.

## Superfícies de alto risco

Qualquer mudança nestas áreas exige revisão extra, testes e evidência:

- autenticação e sessão
- billing (Stripe), webhooks e portal
- multi-tenancy (escopo por workspace)
- Firestore rules e persistência
- dados financeiros (transações, categorias, valores, projeções)
- integração com provedores externos (IA, Open Finance, OCR)

## Qualidade mínima (gates)

Para mudanças com impacto em produção:

```bash
npm run lint
npm run test:coverage:critical
npm run health:runtime
npm run health:runtime:mobile
```

Quando houver impacto em Firestore rules:

```bash
npm run test:firestore:rules
```

## Regras de documentação

- a trilha viva do repositório deve permanecer em PT-BR
- evitar links Markdown com caminho absoluto do Windows (`E:\...`); preferir links relativos
- evidências operacionais devem registrar data, ambiente, comandos e resultados objetivos

## Fontes relacionadas

- visão geral: [../README.md](../README.md)
- mapa operacional: [OPERATIONS_README.md](./OPERATIONS_README.md)
- status de deploy: [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- índice de auditorias/evidências: [AUDIT_AND_EVIDENCE_INDEX.md](./AUDIT_AND_EVIDENCE_INDEX.md)

