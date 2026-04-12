# Plano de Lancamento em 10 Dias - Flow Finance

Data base: 2026-04-12
Status atual: bloqueado por paridade de ambiente e contratos de health/version no deploy
Escopo: deixar o produto util e lancavel sem abrir novas frentes grandes

## Diagnostico objetivo (evidencia de hoje)

### Comandos executados
- `VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app/ npm run health:vercel`
- `VERCEL_TARGET_URL=https://flow-finance-frontend-nine.vercel.app/ npm run health:vercel`

### Resultado
- Backend: falha de contrato em `/health` sem `requestId/routeScope`.
- Frontend: `/health`, `/api/health` e `/api/version` retornando `404`.

Implicacao:
- O bloqueio de lancamento nao esta no nucleo de testes locais.
- O bloqueio esta na publicacao/alinhamento de ambiente alvo e contrato de observabilidade.

## Definicao de pronto para lancamento

Para marcar GO:
1. `npm run lint` verde.
2. `npm test` verde.
3. `npm run test:coverage:critical` com branches >= 98%.
4. `npm run test:firestore:rules` verde.
5. `npm run health:vercel` verde no backend oficial.
6. Endpoints validos no alvo:
   - `/health`
   - `/api/health`
   - `/api/version`
7. Fluxo principal de utilidade validado (adicionar transacao, ver caixa, ver previsto/realizado, receber orientacao consultiva).
8. Evidencia final registrada em docs.

## Plano de execucao (10 dias)

### Dia 1 - Contrato de deploy como fonte de verdade
Objetivo:
- Congelar o contrato esperado de health/version no deploy.

Entregas:
- Confirmar payload esperado de `/health`, `/api/health`, `/api/version`.
- Ajustar validador `health:vercel` para refletir contrato real alvo (sem afrouxar requisito).
- Atualizar status no documento de deploy.

Validacao:
- Comando de health reproduzivel localmente contra URL publica.

### Dia 2 - Backend Vercel em conformidade
Objetivo:
- Fazer backend publico responder o contrato de observabilidade.

Entregas:
- Ajustes de ambiente e/ou roteamento no deploy backend.
- Confirmacao de `requestId` e `routeScope` no endpoint de saude.

Validacao:
- `VERCEL_TARGET_URL=<backend> npm run health:vercel` verde.

### Dia 3 - Frontend e backend sem ambiguidades
Objetivo:
- Eliminar confusao entre dominio de frontend e dominio de backend para probes.

Entregas:
- Documentar claramente qual URL e usada para health de backend.
- Garantir que runbooks nao usem frontend como alvo para `/api/*` quando nao houver proxy.

Validacao:
- Runbook com comando unico e esperado.

### Dia 4 - Fluxo de utilidade real (produto)
Objetivo:
- Garantir valor no primeiro uso.

Entregas:
- Revisar e reduzir friccao no fluxo:
  - adicionar transacao
  - leitura de saldo
  - previsto vs realizado
  - acao orientada no apoio IA

Validacao:
- Teste E2E dedicado do fluxo principal.

### Dia 5 - Hardening de experiencia
Objetivo:
- Reduzir ruido visual e operacional sem criar novas features.

Entregas:
- Revisao de copy e CTA de dashboard/assistente/ajustes.
- Ajustes de estados vazios e mensagens de erro acionaveis.

Validacao:
- Testes unitarios de copy/fluxo e smoke E2E.

### Dia 6 - Fechamento de riscos tecnicos conhecidos
Objetivo:
- Enderecar pendencias que afetam confianca de release.

Entregas:
- Tratar TODOs criticos em trilhas IA/admin que afetam operacao.
- Revisar e limpar testes skipados obsoletos.

Validacao:
- `npm test` sem regressao.

### Dia 7 - Regressao dirigida web + mobile web
Objetivo:
- Confirmar que simplificacao nao quebrou jornadas importantes.

Entregas:
- Rodar regressao principal em Chromium e mobile web.

Validacao:
- `npm run health:runtime`
- `npm run health:runtime:mobile`

### Dia 8 - Preparacao de release package
Objetivo:
- Consolidar o pacote de decisao de lancamento.

Entregas:
- Atualizar changelog e status de deploy.
- Consolidar evidencias em documento unico.

Validacao:
- Checklist de pronto completo.

### Dia 9 - Go/No-Go tecnico
Objetivo:
- Executar gate final sem excecao silenciosa.

Entregas:
- Executar todos os comandos obrigatorios.
- Registrar qualquer desvio com risco explicito.

Validacao:
- Gate final assinado por evidencias (logs + docs).

### Dia 10 - Lancamento controlado
Objetivo:
- Publicar com monitoramento e plano de rollback.

Entregas:
- Janela de release.
- Monitoramento inicial.
- Verificacao pos-lancamento.

Validacao:
- Endpoints de health/version funcionando apos release.

## Checklist diario (execucao rapida)

- [ ] Ambiente alvo definido (backend correto)
- [ ] Comandos obrigatorios executados
- [ ] Evidencia registrada no docs
- [ ] Riscos novos classificados
- [ ] Decisao do dia: segue, bloqueia ou replaneja

## Registro de riscos e resposta

1. Risco: divergencia entre contrato esperado e resposta real de health.
- Resposta: alinhar contrato e deploy no Dia 1 e Dia 2.

2. Risco: confusao de alvo (frontend x backend) nas validacoes.
- Resposta: runbook unico no Dia 3.

3. Risco: utilidade percebida baixa no primeiro uso.
- Resposta: fluxo principal priorizado no Dia 4 e Dia 5.

4. Risco: regressao em trilhas secundarias.
- Resposta: regressao dirigida no Dia 7.

## Proximo passo imediato (hoje)

1. Ajustar contrato de validacao de health/version ao deploy oficial.
2. Corrigir backend no Vercel para satisfazer `health:vercel`.
3. Reexecutar validacao e atualizar `docs/DEPLOYMENT_STATUS.md` com resultado da rodada.
