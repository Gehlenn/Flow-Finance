# Flow Finance

Aplicação SaaS de gestão financeira com foco em fluxo de caixa, transações, receitas previstas e realizadas, e apoio consultivo por IA para empresas de serviço.

## Estado atual

- Versão documental atual: `0.9.6.1v`
- Data de atualização: `2026-04-12`
- Estado do ciclo: `bloqueado`
- Suíte global: `verde`
- Billing Stripe sandbox: `validado localmente`
- Bloqueio principal remanescente: ambiente-alvo do Vercel ainda incompleto para fechamento honesto de observabilidade e validação externa

## Links oficiais do projeto

- Frontend principal: [https://flow-finance-frontend-nine.vercel.app/](https://flow-finance-frontend-nine.vercel.app/)
- Backend principal: [https://flow-finance-backend.vercel.app/](https://flow-finance-backend.vercel.app/)
- Frontend alternativo: [https://flow-finance-xi.vercel.app/](https://flow-finance-xi.vercel.app/)

## Escopo do produto

O Flow Finance está sendo simplificado para operar bem no núcleo de gestão financeira:

- fluxo de caixa
- transações
- receitas previstas e realizadas
- camada consultiva de IA
- operação web e mobile como alvos de primeira classe

O caso da clínica odontológica continua sendo apenas cenário de validação. Ele não define a identidade do produto.

## Fonte de verdade documental

Use estes documentos como trilha principal antes de tomar decisões de produto, arquitetura ou release:

- Índice da documentação: [docs/README.md](./docs/README.md)
- Entrada rápida: [docs/COMECE_AQUI.md](./docs/COMECE_AQUI.md)
- Mapa operacional: [docs/OPERATIONS_README.md](./docs/OPERATIONS_README.md)
- Mapa histórico: [docs/HISTORICAL_README.md](./docs/HISTORICAL_README.md)
- Roadmap consolidado: [docs/ROADMAP.md](./docs/ROADMAP.md)
- Changelog operacional: [docs/CHANGELOG.md](./docs/CHANGELOG.md)
- Status de deploy: [docs/DEPLOYMENT_STATUS.md](./docs/DEPLOYMENT_STATUS.md)
- Configuração de Vercel e observabilidade: [docs/VERCEL_CONFIG.md](./docs/VERCEL_CONFIG.md)
- Evidência operacional do Stripe sandbox: [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- Índice de auditorias e evidências: [docs/AUDIT_AND_EVIDENCE_INDEX.md](./docs/AUDIT_AND_EVIDENCE_INDEX.md)

## Espelho no vault

O repositório contém um vault auxiliar em `./obsidian-vault/`, mas o **vault canônico do projeto** fica fora do repositório, em:

`E:\app e jogos criados\obsidian-vault\Projetos\`

Regras operacionais:

- documentação de projeto (repo) e memória operacional (vault) devem permanecer coerentes
- quando existir conflito entre documentação e código, o código vence e a documentação é atualizada na mesma passada

## Arquitetura resumida

### Frontend

- React + Vite
- suporte mobile via Capacitor
- fallback local controlado para desenvolvimento quando Firebase não estiver configurado
- camadas de sessão, workspace e billing desacopladas

### Backend

- Node.js + Express
- autenticação via JWT e cookies HttpOnly nos fluxos reais
- serviços de IA protegidos no backend
- endpoints de saúde e versão com `requestId` e `routeScope`
- observabilidade com Sentry opcional e silenciosa quando o DSN estiver ausente

### Billing

- Stripe em sandbox validado localmente
- checkout, webhook e portal confirmados no backend
- fechamento no ambiente-alvo ainda depende da configuração correta no Vercel e de acesso real ao deploy

## Execução local

### Pre-requisitos

- Node.js `18+`
- npm `8+`
- dependências instaladas com `npm ci`
- `backend/.env` preenchido para a trilha backend local

### Nota de segurança mobile (temporária)

- O script `resources:generate` foi removido por risco de supply chain na cadeia `cordova-res -> sharp`.
- Enquanto não houver versão segura upstream, a geração de ícones/splash deve ser feita por ferramentas nativas:
   - Android Studio (Image Asset)
   - Xcode (Assets.xcassets)
- Essa medida reduz superfície de ataque no ambiente de desenvolvimento e CI.

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
   - `VITE_SENTRY_DSN` (preferencial no frontend)
   - `SENTRY_DSN` (backend e fallback legado do frontend no build)
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

1. Fechar configuracao de ambiente do Vercel para observabilidade e versao.
2. Liberar ou compartilhar o preview protegido para validar os endpoints reais.
3. Consolidar a validacao externa de readiness no destino.
4. Manter `docs/` e vault coerentes em PT-BR, com separacao clara entre material vivo e historico.

## Regra de documentacao

Ao alterar comportamento, arquitetura, readiness, deploy ou operacao:

- atualizar os documentos relevantes em `docs/`
- atualizar o espelho equivalente no vault canônico (fora do repo) quando o assunto for estrutural
- evitar manter conteudo duplicado e contraditorio entre README, roadmap, changelog e vault
- tratar auditorias antigas e evidencias antigas como material historico, nao como fonte de verdade viva

## Observacao final

Este repositorio deve ser tratado como sistema financeiro com requisito alto de integridade. Em caso de conflito entre documentacao antiga e realidade do codigo, a realidade do codigo vence e a documentacao deve ser atualizada imediatamente.




