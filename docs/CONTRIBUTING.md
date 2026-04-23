# Contribuição e Manutenção (PT-BR)

Este documento define como contribuir no Flow Finance sem degradar integridade financeira, qualidade de código e rastreabilidade operacional.

## Regras de ouro

- se não está documentado, não existe (para efeitos de operação e auditoria)
- não declarar tarefa concluída se testes relevantes falharam ou se a lógica do fluxo principal está quebrada
- tratar como superfícies de alto risco: autenticação, billing, Firestore rules, dados financeiros, multi-tenancy e integrações externas
- manter a documentação do projeto em PT-BR (a trilha viva)

## Quando atualizar documentação

Você deve atualizar a documentação na mesma passada quando houver:

- mudança de fluxo de autenticação, sessão, workspace ou escopo de permissões
- mudança em endpoints, contratos de request/response, headers obrigatórios (ex.: `x-workspace-id`)
- mudança em billing (Stripe), webhooks, planos ou portal
- mudança em observabilidade (Sentry), health endpoints, versionamento
- mudança estrutural relevante (pastas, scripts, comandos de validação)

## Onde documentar

Trilha viva (repo):

- visão geral: `../README.md`
- mapa de docs: `./README.md`
- estado operacional: `./OPERATIONS_README.md`
- status de deploy: `./DEPLOYMENT_STATUS.md`
- roadmap operacional: `./ROADMAP.md`
- setup: `./SETUP_GUIDE.md`

Evidências e auditorias:

- índice: `./AUDIT_AND_EVIDENCE_INDEX.md`
- evidência operacional Stripe sandbox: `./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`

Memória operacional (vault canônico, fora do repo):

- `E:\app e jogos criados\obsidian-vault\Projetos\`

Regra prática:

- se o repo muda, o vault também deve receber o resumo útil (decisões, estado, próximos passos)

## Qualidade mínima antes de subir mudanças

Quando o change impacta runtime, auth, billing, storage ou UI crítica, rode:

```bash
npm run lint
npm run test:coverage:critical
npm run health:runtime
npm run health:runtime:mobile
```

Quando o change impacta rules do Firestore:

```bash
npm run test:firestore:rules
```

## Padrões de escrita

- texto direto, técnico e auditável
- usar datas concretas (YYYY-MM-DD) ao registrar evidências
- evitar caminhos absolutos do Windows em links Markdown; preferir links relativos portáveis

