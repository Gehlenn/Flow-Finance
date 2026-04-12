# Revisao de Seguranca v0.9.2 - Integracao Clinica

## Resumo executivo

A integracao clinica apresentava uma base boa naquele corte: HMAC com timestamp, validacao por schema e feature flags com kill switch. O principal risco residual era operacional e de concorrencia, concentrado na deduplicacao nao atomica da camada de idempotencia.

## Escopo

- `POST /api/integrations/clinic/financial-events`
- middleware de autenticacao externa
- servico de automacao clinica e idempotencia
- limites e configuracoes de runtime do backend

## Arquitetura observada no corte

- entrada HTTP no Express com validacao via Zod
- autenticacao por chave de integracao + assinatura HMAC
- controles operacionais por feature flag
- idempotencia persistida em Redis com TTL
- observabilidade por logs estruturados

## Achados por severidade

### FF-SEC-001 - Alto

Idempotencia com janela de corrida.

- fluxo de leitura e depois escrita (`get -> setEx`) sem operacao atomica
- risco de processamento duplicado em requisicoes concorrentes
- recomendacao: `SET NX EX` ou script atomico no Redis

### FF-SEC-002 - Medio

Rate limit da rota clinica usando store em memoria local.

- risco de bypass em ambiente com multiplas instancias
- recomendacao: centralizar limiter em Redis

### FF-SEC-003 - Medio

Ordem de middlewares favorecendo custo de autenticacao antes do throttle.

- recomendacao: limiter de borda antes da autenticacao e limiter autenticado depois

### FF-SEC-004 - Medio

`externalEventId` sem restricao de formato e tamanho.

- risco de payloads com IDs excessivos e degradacao de recursos
- recomendacao: regex tecnica e limite maximo de tamanho

### FF-SEC-005 - Baixo

`trust proxy` fixo em `1` exigindo validacao da topologia real.

- recomendacao: tornar configuravel por ambiente

## Pontos positivos ja implementados naquele corte

- autenticacao HMAC com comparacao timing-safe
- schema discriminado para eventos permitidos
- kill switch e feature flags para contingencia

## Quick wins registrados

1. Validar `externalEventId` com tamanho maximo e formato tecnico.
2. Reordenar middlewares para throttle de borda antes de auth.
3. Criar alerta de duplicidade por `externalEventId`.
4. Reduzir limite de body especificamente na rota clinica.

## Checklist objetivo de producao daquele eixo

1. Segredos HMAC rotacionados e versionados.
2. Janela de timestamp revisada.
3. Idempotencia atomica habilitada.
4. Rate limit centralizado.
5. Limite de payload por rota.
6. Kill switch testado em staging.
7. Alertas para `401`, `429`, duplicidade, latencia e `5xx`.
8. Dashboard de ingestao por evento e tenant.
9. Runbook de incidente validado.
10. Teste de replay e burst antes de liberar mudancas.

## Leitura atual

Este documento e uma revisao de seguranca historica de um eixo especifico da integracao clinica. Nao substitui a revisao de seguranca atual do produto como um todo.
