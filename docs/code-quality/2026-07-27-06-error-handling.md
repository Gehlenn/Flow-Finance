# Error handling, recovery and observability - assessment

Data: 2026-07-27  
Escopo: TypeScript/TSX de produção da aplicação React/Vite e do backend Express, no snapshot combinado do worktree.

## Veredito

O repositório não tinha um problema generalizado de catches decorativos. A maior
parte dos handlers está em fronteiras que realmente podem falhar: HTTP,
providers de IA, Firebase/Firestore, Redis/Postgres, `localStorage`, arquivos,
auth, billing e integrações.

Os problemas comprovados foram mais estreitos:

- um parser de PDF convertia rejeições reais em lista vazia;
- duas camadas de observabilidade capturavam de novo uma falha já capturada pelo
  owner de telemetria;
- três operações best-effort preservavam disponibilidade, mas escondiam a falha;
- seis catch bodies não tinham statements, embora cinco deles tivessem uma
  política de fallback recuperável e um fosse isolamento de evento auxiliar.

Resultado:

- handlers de erro: **323 -> 320**;
- `try` statements: **294 -> 291**;
- catch clauses: **288 -> 285**;
- `.catch(...)`: **35 -> 35**;
- `finally`: **36 -> 36**;
- catch bodies sem statements: **6 -> 0**;
- catches sem binding: **19 -> 17**;
- testes focados: **34/34 PASS**;
- type-check da aplicação: **PASS**;
- type-check do backend: **PASS**.

Não houve alteração em `tests/unit/observability-client.test.ts`.

## Método

1. Foram lidos `AGENTS.md`, as regras globais, o bundle canônico do vault, o
   GSD, o cleanup histórico, os relatórios `01` a `05`, manifests, configs e os
   roots de aplicação/backend.
2. O inventário usou AST do TypeScript sobre 433 arquivos de produção:
   `App.tsx`, `AppWithAnalytics.tsx`, `index.tsx`, `components`, `hooks`,
   `pages`, `services`, `src`, `utils`, `models`, `backend/api`,
   `backend/src` e `backend/shared`.
3. Testes, `dist`, `.tmp`, coverage e resultados gerados foram excluídos das
   métricas.
4. Cada candidato foi confrontado com callers e testes antes da edição.
5. Catches foram mantidos quando faziam pelo menos uma função específica:
   validação de input não confiável, fronteira externa, recuperação, isolamento,
   observabilidade, cleanup ou tradução para contrato HTTP/domínio.

`rtk` foi verificado, mas não está disponível no PowerShell ativo; os comandos
foram executados diretamente.

## Baseline quantitativo por domínio

Esta é uma classificação primária por ownership de arquivo. Ela soma 323
handlers e evita contar o mesmo catch em vários domínios.

| Domínio | Handlers |
| --- | ---: |
| Financeiro, banking, import e prediction | 74 |
| UI e fluxos de produto | 72 |
| IA e providers | 67 |
| Multi-tenancy, persistence e sync | 39 |
| Auth e security | 29 |
| Runtime e observability | 27 |
| Billing e SaaS | 15 |
| **Total** | **323** |

## Taxonomia funcional

Uma primeira classificação AST atribuiu um papel primário a cada handler. A
classe é uma triagem, não uma autorização automática para editar:

| Papel primário | App | Backend | Total |
| --- | ---: | ---: | ---: |
| Input/storage não confiável | 44 | 15 | 59 |
| Fronteira externa com recuperação | 43 | 31 | 74 |
| Recovery/fallback de domínio ou UI | 80 | 17 | 97 |
| Tradução ou propagação | 13 | 62 | 75 |
| Isolamento com observabilidade | 10 | 3 | 13 |
| Outliers para revisão manual | 5 | 0 | 5 |
| **Total** | **195** | **128** | **323** |

Correções manuais importantes na leitura da heurística:

- `asyncHandler(...).catch(next)` é tradução padrão do Express, não silêncio;
- catches que atualizam erro visível em React são recuperação de UI mesmo sem
  logger;
- o health check traduz exceções de Redis/DB para `unhealthy`, que é um contrato
  `Result` explícito;
- um `return false` durante recuperação de workspace é consumido pelo retry e
  pelo handler externo, não uma confirmação falsa de sucesso.

## Assessment crítico

### 1. O risco relevante era erro escondido, não quantidade

`323` handlers parece alto isoladamente, mas auth, providers, persistence e
ingestão financeira exigem tratamento explícito. Remover catches em massa
eliminaria rollback, fallback de provider, respostas HTTP tipadas e tolerância a
dados legados.

O achado real foi semântico: um catch era ruim quando transformava uma rejeição
em sucesso aparente, duplicava a captura do owner ou mantinha disponibilidade
sem diagnóstico.

### 2. Logging em toda camada também é erro handling ruim

`IntegrationTelemetry.executeWithTelemetry()` já classifica status, registra o
evento e captura a exceção no Sentry. O decorator e o wrapper de IA capturavam ou
logavam novamente antes de propagar. Isso multiplica eventos para uma única
falha e degrada a utilidade da observabilidade.

A correção preserva um owner único. Camadas superiores continuam livres para
traduzir o erro ou adicionar metadados quando houver contrato distinto.

### 3. Best-effort precisa declarar o custo da falha

Audit log, cache Redis e emissão de evento pós-importação são best-effort em
seus fluxos atuais. Falhar a persistência não deve derrubar login/importação, mas
o fallback precisa ser auditável:

- audit log permanece no buffer em memória;
- invalidação Redis depende do TTL quando `DEL` falha;
- importação conclui mesmo se o evento auxiliar não for emitido.

Essas decisões agora aparecem em logs estruturados com contexto e chave
`fallback`.

## Mudanças high confidence implementadas

### H1. Parser PDF não esconde mais rejeições

Arquivo: `src/finance/importServiceHelpers.ts`.

O helper retornava `[]` para qualquer falha de `File.text()` ou do parser. O
caller `runImportPipeline()` já possui a fronteira correta para traduzir a falha
em `ImportResult.errors`, enquanto o export direto deve rejeitar.

Mudança: removido o catch local. Falhas reais agora chegam ao owner do pipeline.

### H2. Decorator de integração não captura duas vezes

Arquivo: `backend/src/services/observability/IntegrationTelemetry.ts`.

`instrument()` chamava `executeWithTelemetry()`, capturava novamente a exceção e
propagava. O catch externo foi removido; `executeWithTelemetry()` segue como
owner de log/status/Sentry.

### H3. Wrapper de IA não duplica log da telemetria

Arquivo: `backend/src/services/observability/IntegrationMonitor.ts`.

`executeAICall()` registrava outro `logger.error` após
`executeWithTelemetry()` já ter observado a falha. O catch foi removido. Sucesso
continua chamando `recordSuccess`; falha propaga sem segundo log do wrapper.

### H4. Falha de persistência do audit log é observável

Arquivo: `backend/src/services/admin/auditLog.ts`.

`insertAuditEvent()` continua best-effort para preservar o buffer e não quebrar
auth/security flows, mas agora registra `eventId`, action, status, tenant,
workspace e o fallback `audit-log-postgres-write-failed`.

### H5. Falha ao invalidar prediction cache é observável

Arquivo: `backend/src/services/PredictionEngine.ts`.

`clearCache(userId)` continua síncrono e não bloqueia o caller, mas a rejeição do
Redis `DEL` agora registra user, key e que a expiração por TTL permanece ativa.

### H6. Falha de evento pós-importação não fica invisível

Arquivo: `pages/ImportTransactions.tsx`.

A importação continua concluindo porque o evento é auxiliar, mas o catch agora
registra erro, formato, quantidade e
`import-transactions-event-emission-failed`.

### H7. Catch bodies estruturalmente vazios foram eliminados

- `App.tsx`: falha de `localStorage` deixa explicitamente a dica
  `daysSinceLastVisit` como `null`; analytics não bloqueia o shell.
- `components/TransactionList.tsx`: sort persistido inválido retorna
  explicitamente o default.
- `src/app/productAnalytics.ts`: falha ao marcar dedupe termina explicitamente
  a operação auxiliar.
- `src/config/api.config.ts`: falha do bridge Capacitor retorna explicitamente
  plataforma `web`.
- `src/services/firestoreWorkspaceEntityHelpers.ts`: seed E2E inválido registra
  diagnóstico antes de seguir para o seed determinístico.
- `pages/ImportTransactions.tsx`: o catch vazio virou isolamento observável,
  descrito em H6.

## Tratamentos mantidos e razões

### Auth, security e multi-tenancy

- controllers de auth traduzem provider/JWT/Firebase failures para `AppError` e
  registram audit events;
- middleware global do Express é o owner final de resposta e correlação;
- workspace stores restauram state anterior antes de rejeitar uma escrita
  durável;
- Firestore helpers validam contexto antes de formar paths multi-tenant.

Esses catches não foram removidos nem simplificados.

### Billing e Stripe

- parsing de webhook trata body externo não confiável;
- checkout/portal registram evento de produto e propagam a falha;
- plan catalog local só é fallback para classes de erro explicitamente
  permitidas.

O contrato financeiro/comercial não foi alterado.

### Financeiro, import e Open Banking

- localStorage/arquivo/provider são boundaries não confiáveis;
- full sync pode isolar a etapa de contas e continuar transações, com warning;
- classificação por IA pode cair para mapping básico sem perder o import;
- erros financeiros visíveis continuam sendo enviados à UI.

### Providers de IA

- falha do primary ativa fallback apenas nas condições definidas;
- falha do fallback propaga;
- categoria de falha, provider, requestId, timeout e fallback continuam
  observáveis.

### Runtime e background

- runtime guards, service worker, filas e listeners são isolados para não
  impedir o bootstrap inteiro;
- Error Boundary continua como isolamento final da árvore React;
- analytics/dedupe continuam non-critical por contrato.

### Fallback de normalização comprovado por teste

`src/ai/receiptScanner.ts` foi considerado como candidato, mas
`tests/unit/receipt-scanner.test.ts` força `String.prototype.normalize()` a
falhar e prova que o parser deve continuar sem acentos normalizados. O catch foi
mantido. Essa evidência impediu uma remoção estética incorreta.

## Testes

Novos ou ampliados:

- `tests/unit/import-service.test.ts`
  - `parsePDF()` propaga rejeição de leitura.
- `tests/unit/import-transactions-session.test.tsx`
  - falha de emissão do evento auxiliar é registrada e a importação conclui.
- `backend/tests/unit/prediction-engine-observability.test.ts`
  - falha de Redis `DEL` registra contexto.
- `backend/tests/unit/integration-telemetry-observability.test.ts`
  - falha instrumentada chega uma vez ao Sentry owner.
- `backend/tests/unit/integration-monitor-health-observability.test.ts`
  - wrapper de IA não duplica log de falha do owner.
- `backend/tests/unit/audit-log-persistence-observability.test.ts`
  - evento permanece disponível e falha Postgres é registrada.

Execuções:

```text
npx vitest run tests/unit/receipt-scanner.test.ts \
  tests/unit/import-service.test.ts \
  tests/unit/import-transactions-session.test.tsx \
  --exclude .tmp/** --pool=threads --maxWorkers=1

3 arquivos; 25 testes; PASS

npx vitest run backend/tests/unit/prediction-engine-observability.test.ts \
  backend/tests/unit/audit-log-persistence-observability.test.ts \
  backend/tests/unit/integration-telemetry-observability.test.ts \
  backend/tests/unit/integration-monitor-health-observability.test.ts \
  --exclude .tmp/** --pool=threads --maxWorkers=1

4 arquivos; 9 testes; PASS

npm run type-check:app
PASS

npm run type-check:backend
PASS
```

## Deferidos

1. `cloudSyncClient` ainda precisa de validators por entidade antes de estreitar
   casts ou transformar respostas de boundary em Result tipado.
2. `safeJsonParse<T>()` e loaders genéricos do backend ainda deixam validação no
   caller. Migrar exige schemas e testes por consumidor.
3. Alguns controllers e providers registram contexto antes de traduzir para
   `AppError`; isso pode parecer duplicação junto ao middleware global, mas as
   camadas hoje carregam metadados diferentes. Só consolidar após definir uma
   política de deduplicação por `requestId`/fingerprint.
4. Health checks convertem falhas em `unhealthy` sem expor a exception. Antes de
   adicionar reason/log, definir redaction e sampling para evitar segredo em
   probe e ruído operacional.
5. Fallbacks de Open Banking e sync local são políticas de produto já cobertas;
   mudar tolerância, propagação ou UI exige uma rodada específica.

## Recomendações

1. Adotar owner único de captura: provider/service adiciona contexto de domínio;
   middleware ou telemetry captura uma vez.
2. Para best-effort, documentar sempre: dado preservado, dado perdido, mecanismo
   de recuperação e chave de observabilidade.
3. Preferir validators/Result em boundaries de JSON, Firestore e HTTP, sem
   substituir `unknown` por casts otimistas.
4. Se o inventário virar gate, medir separadamente:
   - catch body sem statements;
   - `.catch(() => undefined)` e equivalentes;
   - log + rethrow sem tradução;
   - retorno default em boundary sem diagnóstico;
   - catches em auth/billing/tenant sem teste.
5. Não usar contagem bruta de catches como meta de redução. O gate deve falhar
   em handlers sem papel demonstrável, não em tratamento defensivo necessário.

## Arquivos alterados por esta frente

Produção:

- `App.tsx`
- `components/TransactionList.tsx`
- `pages/ImportTransactions.tsx`
- `src/app/productAnalytics.ts`
- `src/config/api.config.ts`
- `src/finance/importServiceHelpers.ts`
- `src/services/firestoreWorkspaceEntityHelpers.ts`
- `backend/src/services/PredictionEngine.ts`
- `backend/src/services/admin/auditLog.ts`
- `backend/src/services/observability/IntegrationMonitor.ts`
- `backend/src/services/observability/IntegrationTelemetry.ts`

Testes:

- `tests/unit/import-service.test.ts`
- `tests/unit/import-transactions-session.test.tsx`
- `backend/tests/unit/prediction-engine-observability.test.ts`
- `backend/tests/unit/integration-monitor-health-observability.test.ts`
- `backend/tests/unit/integration-telemetry-observability.test.ts`
- `backend/tests/unit/audit-log-persistence-observability.test.ts`

Documentação:

- `docs/code-quality/2026-07-27-06-error-handling.md`

Nenhum commit ou push foi feito.
