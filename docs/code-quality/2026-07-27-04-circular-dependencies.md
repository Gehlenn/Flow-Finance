# Dependências circulares — assessment e correção

Data: 2026-07-27  
Escopo: grafo de imports da aplicação React/Vite e do backend Express, no estado combinado do worktree.

## Veredito

O baseline atual tinha 18 ciclos reportados pelo Madge:

- aplicação: 11;
- backend: 7.

Um ciclo era de runtime real: `src/config/sentry.ts` importava o logger, enquanto o logger reportava de volta ao Sentry. Os outros 17 eram ciclos type-only: um módulo principal importava um helper ou adapter em runtime, e esse helper voltava ao módulo principal apenas para obter tipos.

Todos os 18 ciclos foram removidos. O scan posterior reporta zero ciclos na aplicação e zero no backend. As APIs públicas dos módulos principais foram preservadas por reexports type-only.

## Comandos de pesquisa

Baseline da aplicação:

```powershell
npx --yes madge --circular --json --extensions ts,tsx,js,jsx --ts-config tsconfig.app.json App.tsx AppWithAnalytics.tsx index.tsx components hooks pages services src utils models
```

Baseline do backend:

```powershell
npx --yes madge --circular --json --extensions ts,js --ts-config backend/tsconfig.json backend/src backend/shared
```

Inspeção de arquivos ignorados:

```powershell
npx --yes madge --warning --extensions ts,tsx,js,jsx --ts-config tsconfig.app.json App.tsx AppWithAnalytics.tsx index.tsx components hooks pages services src utils models
npx --yes madge --warning --extensions ts,js --ts-config backend/tsconfig.json backend/src backend/shared
```

O scan da aplicação processou 281 arquivos no baseline. O scan posterior processou 287 arquivos porque passou a incluir seis contratos extraídos. O scan posterior do backend processou 159 arquivos.

## Assessment crítico

### Ciclo de runtime

| Ciclo | Causa | Correção |
| --- | --- | --- |
| `src/config/sentry.ts` ↔ `src/utils/logger.ts` | O logger enviava mensagens e breadcrumbs ao Sentry; o bootstrap do Sentry tentava registrar sua própria carga pelo logger. Isso criava inicialização recursiva e tornava a ordem de avaliação relevante. | O Sentry passou a emitir somente seus diagnósticos internos de bootstrap via `console`, enquanto o logger continua sendo o consumidor da API de observabilidade. |

O uso de `console` nesse ponto é intencional: o bootstrap da própria telemetria não pode depender do logger que reporta para essa telemetria.

### Ciclos type-only da aplicação

| Ciclo reportado | Natureza | Correção |
| --- | --- | --- |
| `aiMemory.ts` ↔ `aiMemoryHelpers.ts` | helper importava `AIMemory` do owner | `aiMemoryTypes.ts` |
| `signalEngine.ts` ↔ `signalEngineHelpers.ts` | helper importava `FinancialSignalKind` do owner | `signalEngineTypes.ts` |
| `salaryDetector.ts` ↔ `salaryDetectorCatalog.ts` | catálogo importava `IncomeType` do detector | catálogo passou a ser dono de `IncomeType`; detector mantém reexport |
| `localSyncService.ts` ↔ `localSyncGoalsHydrator.ts` | hydrator importava `SyncPullResult` do serviço | `localSyncTypes.ts` |
| `productAnalytics.ts` ↔ `productAnalyticsContract.ts` | contrato importava os tipos do emissor que o consumia | contrato passou a ser dono dos eventos/propriedades; emissor mantém reexports |
| `adaptiveAIEngine.ts` ↔ `adaptiveAIEnginePatternHelpers.ts` | helper importava `FinancialPattern` do engine | `adaptiveAIEngineTypes.ts` |
| `aiCategorizerFallback.ts` ↔ `transactionCategorizer.ts` | fallback importava `FinanceCategory` pelo entrypoint de runtime | import direto de `categoryTypes.ts` |
| `transactionCategorizer.ts` ↔ `categorizationRules.ts` | rules importava `FinanceCategory` pelo entrypoint de runtime | import direto de `categoryTypes.ts` |
| `auditLogService.ts` ↔ `auditLogPersistence.ts` | adapter importava contratos do serviço que o carregava | `auditLogTypes.ts` |
| `importService.ts` ↔ `importServiceHelpers.ts` | helpers importavam formatos do serviço que os carregava | `importServiceTypes.ts` |

Esses ciclos não chegavam ao bundle como dependências de valores quando o TypeScript removia imports type-only, mas ainda eram ciclos reais no grafo de módulos-fonte. Mantê-los prejudicava análise estática, ownership de contratos e refactors.

### Ciclos type-only do backend

| Ciclo reportado | Natureza | Correção |
| --- | --- | --- |
| `postgresStateStore.ts` ↔ `postgresStateStoreQueryHelpers.ts` | helper importava rows/state do store | `postgresStateStoreTypes.ts` |
| `postgresStateStore.ts` ↔ `postgresStateStoreSaveHelpers.ts` | helper importava rows/state do store | `postgresStateStoreTypes.ts` |
| `saasStore.ts` ↔ `saasStoreHelpers.ts` | helper importava contratos do store | `saasStoreTypes.ts` |
| `eventStore.ts` ↔ `eventStoreFirestore.ts` | adapter importava `DomainEventRecord` do orchestrator | `eventStoreTypes.ts` |
| `ai.ts` ↔ `gemini.ts` | provider importava resposta do orchestrator | `aiTypes.ts` |
| `ai.ts` ↔ `openai.ts` | provider importava resposta do orchestrator | `aiTypes.ts` |
| `bankingConnectionStore.ts` ↔ `bankingConnectionStoreHelpers.ts` | helper importava contratos do store | `bankingConnectionStoreTypes.ts` |

### Barrels e falsos positivos

- Nenhum dos 18 ciclos dependia de barrel `index.ts`.
- O Madge inclui arestas `import type`; por isso 17 achados não eram ciclos de runtime, mas não eram achados inválidos.
- O único arquivo ignorado no scan da aplicação foi o import externo `tailwindcss` vindo da folha de estilos. Ele não representa módulo interno, alias quebrado ou ciclo.
- O scan do backend não reportou arquivo ignorado.

## Mudanças implementadas

- Extraídos contratos leaf, sem imports de volta aos módulos de runtime.
- Mantidos reexports nos entrypoints anteriores para não quebrar consumidores existentes.
- Corrigidas as duas importações de `FinanceCategory` para o contrato já existente `categoryTypes.ts`.
- O catálogo de salário passou a possuir `IncomeType`; keywords são readonly e `matchesKeywords` aceita coleções readonly.
- Diagnósticos internos do Sentry foram desacoplados do logger.
- Nenhuma dependência de auditoria foi adicionada aos manifests. Madge e Knip foram executados temporariamente por `npx`.

## Validação

### Grafo pós-correção

```text
Aplicação: Processed 287 files; No circular dependency found.
Backend:   Processed 159 files; No circular dependency found.
```

### Type-check

```text
npm run type-check:app      PASS
npm run type-check:backend  PASS
```

### Testes focados da aplicação

```text
13 arquivos; 64 testes; todos passando.
```

Cobertura focada: logger/Sentry, AI memory, signal engine, salary detector, local sync, product analytics, adaptive AI, categorização, audit log e import service.

### Testes focados do backend

```text
9 arquivos; 27 testes no conjunto.
26 passaram na primeira execução; 1 teste de event-store excedeu 5 s sob execução paralela.
Reexecução isolada de event-store: 3/3 testes passando em 1,91 s.
```

O timeout isolado não reproduziu e não houve falha de asserção. A evidência aponta contenção do runner paralelo, não regressão do event store.

### Orfandade e diff

```text
npx --yes knip --config knip.json --include files  PASS (nenhum arquivo sem consumidor)
git diff --check                                 PASS
```

O Knip emitiu somente hints de refinamento da configuração, sem arquivo órfão.

## Recomendações

1. Tratar módulos `*Types.ts` como folhas: eles podem depender de tipos de domínio inferiores, mas nunca de services/helpers de runtime.
2. Helpers e adapters devem importar contratos dessas folhas, não do entrypoint que os carrega.
3. Manter Madge como gate executável documentado antes de grandes extrações. Não há justificativa atual para adicionar a ferramenta como dependência permanente.
4. Se o gate for incorporado ao CI, fixar uma versão da ferramenta no comando ou adicioná-la como devDependency em uma mudança separada, com avaliação de custo/manutenção.
5. Não interpretar automaticamente todo ciclo Madge como risco de runtime; confirmar cada aresta como value, type-only, barrel ou import externo antes de editar.

## Riscos residuais

- Madge é análise estática: imports construídos dinamicamente por string podem não aparecer.
- O scan cobre os roots TypeScript/JavaScript ativos e os diretórios declarados; artefatos gerados e dependências externas não fazem parte do grafo interno.
- Os reexports preservam compatibilidade, mas novos módulos devem importar diretamente os contratos leaf para não recriar os ciclos.
- O worktree estava compartilhado com outras frentes de cleanup. As validações acima refletem o estado combinado no momento de execução.
