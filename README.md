# Flow Finance

Aplicacao SaaS de gestao financeira com foco em fluxo de caixa, transacoes, receitas previstas e realizadas, e apoio consultivo por IA para empresas de servico.

## Estado atual

- Versao documental atual: `0.9.6.1v`
- Data de atualizacao: `2026-04-12`
- Estado do ciclo: `bloqueado`
- Suite global: `verde`
- Billing Stripe sandbox: `validado localmente`
- Bloqueio principal remanescente: ambiente alvo do Vercel ainda incompleto para fechamento honesto de observabilidade e validacao externa

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

- Indice da documentacao: [docs/README.md](E:\app e jogos criados\Flow-Finance\docs\README.md)
- Entrada rapida: [docs/COMECE_AQUI.md](E:\app e jogos criados\Flow-Finance\docs\COMECE_AQUI.md)
- Mapa operacional: [docs/OPERATIONS_README.md](E:\app e jogos criados\Flow-Finance\docs\OPERATIONS_README.md)
- Mapa historico: [docs/HISTORICAL_README.md](E:\app e jogos criados\Flow-Finance\docs\HISTORICAL_README.md)
- Roadmap consolidado: [docs/ROADMAP.md](E:\app e jogos criados\Flow-Finance\docs\ROADMAP.md)
- Changelog operacional: [docs/CHANGELOG.md](E:\app e jogos criados\Flow-Finance\docs\CHANGELOG.md)
- Status de deploy: [docs/DEPLOYMENT_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT_STATUS.md)
- Configuracao de Vercel e observabilidade: [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- Evidencia operacional do Stripe sandbox: [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- Indice de auditorias e evidencias: [docs/AUDIT_AND_EVIDENCE_INDEX.md](E:\app e jogos criados\Flow-Finance\docs\AUDIT_AND_EVIDENCE_INDEX.md)

## Espelho no vault

O vault em `obsidian-vault/Flow/` deve concentrar o espelho resumido da operacao e da memoria util:

- Regras do projeto: [obsidian-vault/Flow/Project Rules.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Project Rules.md)
- Plano de produto: [obsidian-vault/Flow/Product Plan.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Product Plan.md)
- Tarefas de codigo: [obsidian-vault/Flow/Code Tasks.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Code Tasks.md)
- Guia de stack: [obsidian-vault/Flow/Project Stack Guide.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Project Stack Guide.md)
- Plano de 30 dias: [obsidian-vault/Flow/30-Day Plan.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\30-Day Plan.md)
- Mapa da documentacao: [obsidian-vault/Flow/Documentation Map.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Documentation Map.md)
- Contexto operacional: [obsidian-vault/Flow/Operational Context.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Operational Context.md)
- Status de release: [obsidian-vault/Flow/Release Status.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Release Status.md)
- Checklist de ambiente: [obsidian-vault/Flow/Environment Checklist.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Environment Checklist.md)
- Mapa operacional: [obsidian-vault/Flow/Operations Map.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Operations Map.md)
- Mapa historico: [obsidian-vault/Flow/Historical Map.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Historical Map.md)
- Mapa de auditorias e evidencias: [obsidian-vault/Flow/Audit and Evidence Map.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Audit and Evidence Map.md)

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
- fechamento no ambiente alvo ainda depende da configuracao correta no Vercel e de acesso real ao deploy

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

## Estado de qualidade atual

Validacoes aprovadas no checkpoint `2026-04-12`:

- `npm run lint`
- `npm run security:scan-secrets`
- `npm audit --omit=dev`
- `npm run health:io`
- `npm run health:runtime`
- `npm run health:runtime:mobile`
- `npm run test:coverage`
- `npm run test:coverage:critical`
- `npm run test:firestore:rules`

Observacao operacional:

- `npm run test:coverage` nao executa `tests/firestore/**` inline.
- A validacao de rules continua obrigatoria, mas fica concentrada em `npm run test:firestore:rules`, que sobe o emulator no formato suportado pelo projeto.

## O que ainda bloqueia fechamento do ciclo

1. Preview ou ambiente alvo do Vercel ainda protegido ou indisponivel para validacao externa completa.
2. Variaveis de ambiente do destino ainda precisam de fechamento consistente:
   - `VITE_SENTRY_DSN`
   - `SENTRY_DSN`
   - `VITE_APP_VERSION`
   - `APP_VERSION`
3. Falta provar `/health`, `/api/health` e `/api/version` no deploy acessivel.

## Billing e observabilidade

### Stripe sandbox

O fluxo operacional local do Stripe foi validado com:

- checkout hospedado
- processamento de webhook com `200`
- promocao do workspace para plano `pro`
- persistencia de `billingCustomerId`
- abertura do Stripe Billing Portal

Evidencia detalhada:

- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)

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

1. Fechar configuracao de ambiente do Vercel para observabilidade e versao.
2. Liberar ou compartilhar o preview protegido para validar os endpoints reais.
3. Consolidar a validacao externa de readiness no destino.
4. Manter `docs/` e vault coerentes em PT-BR, com separacao clara entre material vivo e historico.

## Regra de documentacao

Ao alterar comportamento, arquitetura, readiness, deploy ou operacao:

- atualizar os documentos relevantes em `docs/`
- atualizar os documentos equivalentes em `obsidian-vault/Flow/` quando o assunto for estrutural
- evitar manter conteudo duplicado e contraditorio entre README, roadmap, changelog e vault
- tratar auditorias antigas e evidencias antigas como material historico, nao como fonte de verdade viva

## Observacao final

Este repositorio deve ser tratado como sistema financeiro com requisito alto de integridade. Em caso de conflito entre documentacao antiga e realidade do codigo, a realidade do codigo vence e a documentacao deve ser atualizada imediatamente.
