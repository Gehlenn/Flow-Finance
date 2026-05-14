# Flow Finance - Roadmap em Português (PT-BR)

## Status do documento

- Última atualização: `2026-05-08` (revalidação do estado de deploy + alinhamento com a versão atual)
- Versão de acompanhamento: `0.9.7`
- Papel deste arquivo: visão estratégica e operacional consolidada (produto + operação)

## Resumo executivo

O Flow Finance está em fase de endurecimento operacional para sustentar um produto SaaS financeiro confiável em web e mobile. O eixo principal não é ampliar superfície, e sim consolidar:

- núcleo financeiro simples
- camada consultiva de IA
- sessão e workspace confiáveis
- billing real bem delimitado
- observabilidade e readiness de produção

No checkpoint atual:

- a suíte global foi recuperada
- o billing Stripe sandbox foi provado localmente (evidência operacional)
- o contrato mínimo de observabilidade existe em código
- o backend alvo do Vercel está desalinhado: o domínio responde na raiz, mas `/health`, `/api/health` e `/api/version` voltaram `404` na revalidação de `2026-05-08`

## Estado atual por eixo

### 1. Núcleo de produto

Estado: `ativo e prioritário`

Escopo que define o produto:

- fluxo de caixa
- transações
- receitas previstas
- receitas realizadas
- sinais acionáveis por IA
- operação para empresas de serviço

### 2. Web e mobile

Estado: `primeira classe`

Diretriz permanente:

- não otimizar web degradando mobile
- não otimizar mobile degradando web
- toda decisão de navegação, sessão e fluxo principal precisa preservar ambos

### 3. Billing

Estado: `backend validado localmente`

Já comprovado:

- criação de Checkout Session
- execução de Checkout Stripe sandbox
- webhook processado com `200`
- upgrade de plano para `pro`
- persistência de `billingCustomerId`
- abertura de portal do Stripe

Ainda pendente para fechamento no ambiente-alvo:

- configuração consistente no Vercel
- validação do contrato no deploy acessível

### 4. Observabilidade

Estado: `fechada em código, desalinhada no ambiente-alvo`

Já implementado:

- bootstrap silencioso de Sentry sem DSN (não quebra runtime)
- endpoints de saúde e versão com `requestId` e `routeScope`
- verificação automatizável via `npm run health:vercel` (com `VERCEL_TARGET_URL`)

Ainda pendente:

- variáveis no destino: `VITE_SENTRY_DSN`, `SENTRY_DSN`, `VITE_APP_VERSION`, `APP_VERSION`
- acesso liberado ao preview (sem Vercel Authentication bloqueando o verificador)
- restaurar o contrato real do backend no domínio alvo para que `/health`, `/api/health` e `/api/version` voltem a responder

Revalidação atual:

- `https://flow-finance-frontend-nine.vercel.app/` responde `200`
- `https://flow-finance-backend.vercel.app/` responde `200` na raiz, mas `404` em `/health`, `/api/health` e `/api/version`

## Foco imediato

### Prioridade 1 - Fechamento de ambiente Vercel

Entregas:

- preencher variáveis de ambiente de observabilidade e versão
- liberar ou compartilhar preview protegido
- executar `npm run health:vercel` apontando para um destino acessível
- validar resposta real de:
  - `/health`
  - `/api/health`
  - `/api/version`

### Prioridade 2 - Fechamento operacional do deploy

Entregas:

- confirmar resposta real do frontend e do backend no ambiente acessível
- reconfirmar readiness mínima de billing e observabilidade no destino
- atualizar evidências se houver diferença entre local e deploy

## Critérios para marcar o ciclo como aprovado

1. suíte global sem regressão - `aprovado`
2. gates críticos aprovados novamente - `aprovado (cobertura crítica 99.72%)`
3. deploy-alvo validado com endpoints de saúde acessíveis - `pendente (backend atual responde HTML na raiz e 404 em /health e /api/*)`
4. observabilidade configurada no ambiente-alvo - `pendente (depende de variáveis, acesso ao destino e contrato do backend)`
5. documentação principal e vault atualizados - `em andamento (PT-BR + links relativos no repo; espelho no vault canônico deve acompanhar)`

## Referências obrigatórias

- [README.md](../README.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)

