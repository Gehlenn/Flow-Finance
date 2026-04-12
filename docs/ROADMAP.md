# Flow Finance - Roadmap em Portugues

## Status do documento

- Ultima atualizacao: `2026-04-12` (curadoria documental — separacao trilha viva / historico)
- Versao de acompanhamento: `0.9.6.1v`
- Papel deste arquivo: visao estrategica e operacional consolidada

## Resumo executivo

O Flow Finance esta em fase de endurecimento operacional para sustentar um produto SaaS financeiro confiavel em web e mobile. O eixo principal ja nao e ampliar superficie, e sim consolidar:

- nucleo financeiro simples
- camada consultiva de IA
- sessao e workspace confiaveis
- billing real bem delimitado
- observabilidade e readiness de producao

No checkpoint atual:

- a suite global foi recuperada
- o billing Stripe sandbox foi provado localmente
- o contrato minimo de observabilidade ja existe em codigo
- o bloqueio remanescente esta concentrado no ambiente alvo do Vercel

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

- criacao de checkout session
- execucao de checkout Stripe sandbox
- webhook processado com `200`
- upgrade de plano para `pro`
- persistencia de `billingCustomerId`
- abertura de portal do Stripe

Ainda pendente para fechamento em ambiente alvo:

- configuracao consistente no Vercel
- validacao do contrato no deploy acessivel

### 4. Observabilidade

Estado: `fechada em codigo, pendente no ambiente alvo`

Ja implementado:

- bootstrap silencioso de Sentry sem DSN
- endpoints de saude e versao com `requestId` e `routeScope`
- verificacao automatizavel via `npm run health:vercel`

Ainda pendente:

- `VITE_SENTRY_DSN`
- `SENTRY_DSN`
- `VITE_APP_VERSION`
- `APP_VERSION`
- acesso liberado ao preview ou URL compartilhada

## Checkpoint 0.9.6.1v

### Validacoes aprovadas

- lint e type-check
- varredura de segredos
- auditoria de dependencias de producao sem vulnerabilidades
- health runtime web
- health runtime mobile
- cobertura critica acima da meta
- rules do Firestore no emulator
- suite global de cobertura

### Bloqueio atual

- ambiente alvo do Vercel ainda sem fechamento operacional completo

### Implicacao

O ciclo nao esta bloqueado por codigo de teste neste momento. O bloqueio honesto agora e de ambiente alvo e evidencia externa de readiness.

## Linha de evolucao

### Fase 0.6.x - Inteligencia financeira

Estado: `consolidada`

### Fase 0.7.x - Automacao financeira

Estado: `parcialmente incorporada`

Diretriz:

- manter apenas o que reforca o nucleo de decisao financeira

### Fase 0.8.x - Integracoes financeiras

Estado: `parcial, com partes em standby`

Mantido como capacidade util:

- importacao
- OCR
- categorizacao

Em standby estrategico:

- Open Finance dependente de custo operacional real

### Fase 0.9.x - Preparacao SaaS

Estado: `nucleo concluido, pendente fechamento de ambiente alvo`

Implementado e validado:

- autenticacao robusta com JWT e workspace scope
- isolamento por workspace em storage e backend
- administracao operacional e billing Stripe sandbox
- observabilidade em codigo (Sentry silencioso, endpoints de saude)
- suite E2E cross-browser/device executada
- integracao clinica com contrato estavel, idempotencia atomica e rate limit distribuido

Pendente apenas:

- configuracao de variaveis de ambiente no Vercel (`SENTRY_DSN`, `APP_VERSION` e equivalentes frontend)
- validacao dos endpoints de saude no ambiente alvo acessivel

## Foco imediato

### Prioridade 1 - Fechamento de ambiente Vercel

Entregas:

- preencher variaveis de ambiente de observabilidade e versao
- liberar ou compartilhar preview protegido
- rodar `npm run health:vercel`
- validar `/health`, `/api/health` e `/api/version` no destino real

### Prioridade 2 - Fechamento operacional do deploy

Entregas:

- confirmar resposta real da aplicacao no ambiente acessivel
- reconfirmar readiness minima de billing e observabilidade no destino
- atualizar evidencia operacional se houver diferenca entre local e deploy

### Prioridade 3 - Curadoria documental (concluida em 2026-04-12)

Executado:

- 8 documentos de ciclos encerrados movidos para `docs/archive/`
- `AUDIT_AND_EVIDENCE_INDEX.md` reestruturado com trilha viva e historica separadas
- status real dos quick wins de seguranca da clinica verificado e registrado no indice
- banners de estado adicionados em `MOBILE_TESTING_STATUS.md` e `ROBUSTNESS_OPERATIONAL_v0.9.2.md`

## Criterios para marcar o ciclo como aprovado

1. suite global sem regressao — `aprovado`
2. gates criticos aprovados novamente — `aprovado (cobertura critica 99.72%)`
3. deploy alvo validado com endpoints de saude acessiveis — `pendente (Vercel)`
4. observabilidade configurada no ambiente alvo — `pendente (variaveis de ambiente)`
5. documentacao principal e vault atualizados — `aprovado (curadoria 2026-04-12)`

## Referencias obrigatorias

- [README.md](E:\app e jogos criados\Flow-Finance\README.md)
- [docs/CHANGELOG.md](E:\app e jogos criados\Flow-Finance\docs\CHANGELOG.md)
- [docs/DEPLOYMENT_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT_STATUS.md)
- [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
