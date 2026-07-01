# Flow Finance

Aplicacao SaaS de gestao financeira com foco em fluxo de caixa, transacoes, receitas previstas e realizadas, e apoio consultivo por IA para empresas de servico.

## Estado atual

- Versao documental atual: `0.9.7`
- Data de atualizacao: `2026-06-25`
- Estado do ciclo: `em fechamento operacional`
- Suite global: `verde`
- Billing Stripe sandbox: `validado localmente`
- GitHub Actions e Vercel: ultimo checkpoint publicado estava verde antes desta rodada local; revalidar apos o proximo push.
- Evidencia offline atual: instrumentacao de recorrencia/ativacao validada por testes focados e matriz visual consolidada `PASS` com 46 screenshots.
- Fronteira comercial: habito duravel, conversao paga, churn, CAC, LTV e disposicao de pagamento continuam `SEM EVIDENCIA SUFICIENTE`.

## Links oficiais do projeto

- Frontend principal: [https://flow-finance-frontend-nine.vercel.app/](https://flow-finance-frontend-nine.vercel.app/)
- Backend principal: [https://flow-finance-backend.vercel.app/](https://flow-finance-backend.vercel.app/)
- Frontend alternativo: [https://flow-finance-xi.vercel.app/](https://flow-finance-xi.vercel.app/)

## Escopo do produto

O Flow Finance esta sendo simplificado para operar bem no nucleo de gestao financeira:

- fluxo de caixa
- transacoes
- receitas previstas e realizadas
- camada consultiva de IA
- operacao web e mobile como alvos de primeira classe

O caso da clinica odontologica continua sendo apenas cenario de validacao. Ele nao define a identidade do produto.

## Fonte de verdade documental

Use estes documentos como trilha principal antes de tomar decisoes de produto, arquitetura ou release:

- Indice da documentacao: [docs/README.md](./docs/README.md)
- Entrada rapida: [docs/COMECE_AQUI.md](./docs/COMECE_AQUI.md)
- Mapa operacional: [docs/OPERATIONS_README.md](./docs/OPERATIONS_README.md)
- Mapa historico: [docs/HISTORICAL_README.md](./docs/HISTORICAL_README.md)
- Roadmap consolidado: [docs/ROADMAP.md](./docs/ROADMAP.md)
- Changelog operacional: [docs/CHANGELOG.md](./docs/CHANGELOG.md)
- Status de deploy: [docs/DEPLOYMENT_STATUS.md](./docs/DEPLOYMENT_STATUS.md)
- Configuracao de Vercel e observabilidade: [docs/VERCEL_CONFIG.md](./docs/VERCEL_CONFIG.md)
- Checklist de recuperacao do Vercel: [docs/VERCEL_RECOVERY_CHECKLIST.md](./docs/VERCEL_RECOVERY_CHECKLIST.md)
- Evidencia operacional do Stripe sandbox: [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- Indice de auditorias e evidencias: [docs/AUDIT_AND_EVIDENCE_INDEX.md](./docs/AUDIT_AND_EVIDENCE_INDEX.md)

## Espelho no vault

O repositorio contem um vault auxiliar em `./obsidian-vault/`, mas o vault canonico do projeto fica fora do repositorio, em:

`E:\app e jogos criados\obsidian-vault\Projetos\`

Regras operacionais:

- documentacao de projeto (repo) e memoria operacional (vault) devem permanecer coerentes
- quando existir conflito entre documentacao e codigo, o codigo vence e a documentacao e atualizada na mesma passada

## Arquitetura resumida

### Frontend

- React + Vite
- suporte mobile via Capacitor
- fallback local controlado para desenvolvimento quando Firebase nao estiver configurado
- camadas de sessao, workspace e billing desacopladas

### Backend

- Node.js + Express
- autenticacao via JWT e cookies HttpOnly nos fluxos reais
- servicos de IA protegidos no backend
- endpoints de saude e versao com `requestId` e `routeScope`
- observabilidade com Sentry opcional e silenciosa quando o DSN estiver ausente

### Billing

- Stripe em sandbox validado localmente
- checkout, webhook e portal confirmados no backend
- fechamento no ambiente-alvo ainda depende da configuracao correta no Vercel e de acesso real ao deploy

## Execucao local

### Pre-requisitos

- Node.js `18+`
- npm `8+`
- dependencias instaladas com `npm ci`
- `backend/.env` preenchido para a trilha backend local

### Subir frontend

```bash
npm run dev
```

### Subir backend

```bash
cd backend
npm run dev
```

### Rodar checks principais

```bash
npm run lint
npm run test:coverage
npm run test:coverage:critical
npm run test:firestore:rules
npm run health:runtime
npm run health:runtime:mobile
```

## Smoke real de autenticacao

Antes de validar login real (Google/Microsoft), rode o checker de readiness local:

```bash
node scripts/check-local-auth-readiness.mjs
```

Checklist operacional completo:

- [docs/SMOKE_AUTH_REAL_CHECKLIST.md](./docs/SMOKE_AUTH_REAL_CHECKLIST.md)

## Estado de qualidade atual

Validacoes aprovadas no checkpoint atual:

- `npm run lint`
- `npm run test:coverage:critical`
- `npm run test:backend`
- `npm run build`
- `npm run health:vercel`
- `npm run type-check`
- `vitest run tests/unit/product-analytics.test.ts tests/unit/product-analytics-contract.test.ts tests/unit/app-shell-navigation.test.tsx tests/unit/workspace-session.test.ts tests/unit/import-transactions-session.test.tsx tests/unit/insights-plan-render.test.tsx tests/unit/dashboard-quick-actions.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/activation-retention-export.test.ts tests/unit/habit-proof-evidence.test.ts tests/unit/cohort-state-report.test.ts --exclude .tmp/**`
- `node scripts/capture-visual-regression.mjs --tabs=dashboard,history,flow,insights,cfo,settings,assistant,analytics,import,accounts,goals,workspaceadmin,workspaceaudit --surfaces=pricing,auth-gate,ai-input-modal,transaction-edit-modal,transaction-delete-modal,cashflow-share-modal,cashflow-strategy-modal,assistant-smart-alerts,settings-support,settings-legal --viewports=desktop,mobile`

Observacao operacional:

- `npm run test:coverage` nao executa `tests/firestore/**` inline.
- A validacao de rules continua obrigatoria, mas fica concentrada em `npm run test:firestore:rules`.

## O que ainda bloqueia fechamento do ciclo

1. Falta prova real multi-semana de habito recorrente no `health:habit-proof`.
2. Falta evidencia comercial real de conversao paga, retencao, churn, CAC, LTV e disposicao de pagamento.
3. Falta revalidar o pacote final apos push/deploy desta rodada local.

## Billing e observabilidade

### Stripe sandbox

O fluxo operacional local do Stripe foi validado com:

- checkout hospedado
- processamento de webhook com `200`
- promocao do workspace para plano `pro`
- persistencia de `billingCustomerId`
- abertura do Stripe Billing Portal

Evidencia detalhada:

- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)

### Observabilidade

O contrato minimo de observabilidade implementado hoje e:

- `GET /health` expoe `requestId`, `routeScope` e `checks.observability`
- `GET /api/health` expoe `requestId`, `routeScope` e `observability.sentryConfigured`
- `GET /api/version` expoe `requestId` e `routeScope`

O verificador de deploy pode ser executado com:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

## Prioridades imediatas

1. Consolidar a validacao externa de readiness no destino.
2. Manter `docs/` e vault coerentes em PT-BR, com separacao clara entre material vivo e historico.

## Regra de documentacao

Ao alterar comportamento, arquitetura, readiness, deploy ou operacao:

- atualizar os documentos relevantes em `docs/`
- atualizar o espelho equivalente no vault canonico (fora do repo) quando o assunto for estrutural
- evitar manter conteudo duplicado e contraditorio entre README, roadmap, changelog e vault
- tratar auditorias antigas e evidencias antigas como material historico, nao como fonte de verdade viva

## Observacao final

Este repositorio deve ser tratado como sistema financeiro com requisito alto de integridade. Em caso de conflito entre documentacao antiga e realidade do codigo, a realidade do codigo vence e a documentacao deve ser atualizada imediatamente.
