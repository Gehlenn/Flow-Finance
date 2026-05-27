# Flow Finance - Roadmap em Portugues (PT-BR)

## Status do documento

- Ultima atualizacao: `2026-05-26` (revalidacao do estado de deploy, registro do polimento visual concluido e fechamento do acabamento final)
- Versao de acompanhamento: `0.9.7`
- Papel deste arquivo: visao estrategica e operacional consolidada (produto + operacao)

## Resumo executivo

O Flow Finance esta em fase de endurecimento operacional para sustentar um produto SaaS financeiro confiavel em web e mobile. O eixo principal nao e ampliar superficie, e sim consolidar:

- nucleo financeiro simples
- camada consultiva de IA
- sessao e workspace confiaveis
- billing real bem delimitado
- observabilidade e readiness de producao

No checkpoint atual:

- a suite global foi recuperada
- o billing Stripe sandbox foi provado localmente
- o contrato minimo de observabilidade existe em codigo e os envs criticos de producao ja estao provisionados no Vercel
- o backend oficial voltou a responder `/health`, `/api/health` e `/api/version` na revalidacao de `2026-05-25`
- o backend oficial foi redeployado e agora expoe `0.9.7` em `/api/version`
- as telas legadas de Autopilot, Open Banking e Scanner sairam do bundle ativo para concentrar o produto no nucleo de caixa e no Consultor IA
- o polimento visual principal das superfices ativas foi fechado sem alterar contratos funcionais
- a ultima passada de acabamento confirmou a entrada do app em desktop e mobile, com acentos intencionais preservados apenas em acoes primarias e estados semanticos

## Estado atual por eixo

### 1. Nucleo de produto

Estado: `ativo e prioritario`

Escopo que define o produto:

- fluxo de caixa
- transacoes
- receitas previstas
- receitas realizadas
- sinais acionaveis por IA
- operacao para empresas de servico

### 2. Web e mobile

Estado: `primeira classe`

Diretriz permanente:

- nao otimizar web degradando mobile
- nao otimizar mobile degradando web
- toda decisao de navegacao, sessao e fluxo principal precisa preservar ambos

### 3. Billing

Estado: `backend validado localmente`

Ja comprovado:

- criacao de Checkout Session
- execucao de Checkout Stripe sandbox
- webhook processado com `200`
- upgrade de plano para `pro`
- persistencia de `billingCustomerId`
- abertura de portal do Stripe

Pendencia operacional atual para o ambiente-alvo:

- configuracao consistente no Vercel
- validacao do contrato no deploy acessivel

### 4. Observabilidade

Estado: `fechada em codigo e validada no contrato minimo em producao`

Ja implementado:

- bootstrap silencioso de Sentry sem DSN
- endpoints de saude e versao com `requestId` e `routeScope`
- verificacao automatizavel via `npm run health:vercel`

Pendencia operacional atual:

- acesso liberado ao preview quando necessario
- consolidar evidencia operacional final de observabilidade e readiness

Revalidacao atual:

- `https://flow-finance-frontend-nine.vercel.app/` responde `200`
- `https://flow-finance-backend.vercel.app/` responde `404` na raiz (esperado para API-only)
- `https://flow-finance-backend.vercel.app/health` responde `200`
- `https://flow-finance-backend.vercel.app/api/health` responde `200`
- `https://flow-finance-backend.vercel.app/api/version` responde `200` com `version = 0.9.7`
- os envs criticos de frontend e backend ja aparecem provisionados no Vercel em producao

## Foco imediato

### Prioridade 1 - Fechamento de evidencias Vercel

Entregas:

- manter `npm run health:vercel` como validacao apos cada novo deploy publicado
- manter `GET /api/version` alinhado com a versao esperada do repo
- preservar a trilha de evidencia operacional do ambiente alvo

### Prioridade 2 - Fechamento operacional do deploy

Entregas:

- confirmar resposta real do frontend e do backend no ambiente acessivel
- reconfirmar readiness minima de billing e observabilidade no destino
- atualizar evidencias se houver diferenca entre local e deploy

### Prioridade 3 - Acabamento fino residual

Entregas:

- revisar apenas detalhes cosmeticos restantes, sem mexer em estados semanticos ou fluxos
- manter a estrutura funcional estavel enquanto a interface termina de convergir visualmente

## Criterios para marcar o ciclo como aprovado

1. suite global sem regressao - `aprovado`
2. gates criticos aprovados novamente - `aprovado`
3. deploy-alvo validado com endpoints de saude acessiveis - `aprovado no contrato minimo em 2026-05-25`
4. observabilidade configurada no ambiente-alvo - `em fechamento operacional`
5. documentacao principal e vault atualizados - `em andamento`

## Referencias obrigatorias

- [README.md](../README.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
