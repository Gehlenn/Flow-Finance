# Curadoria do Worktree - 2026-04-02

## Objetivo

Este registro historico separa o worktree de 2 de abril de 2026 em blocos que estavam prontos para commit e blocos que exigiam limpeza adicional ou revisao dedicada.

## Blocos considerados prontos naquele corte

### Frontend e composicao principal

- Reorganizacao de `App.tsx`
- Consolidacao de hooks de autenticacao, sincronizacao e estado financeiro
- Ajustes em `src/app/financeService.ts`

### Admin de workspace, auditoria e permissoes

- Evolucao de `pages/WorkspaceAdmin.tsx` e `pages/WorkspaceAudit.tsx`
- Regras de permissao em `src/security/workspacePermissions.ts`
- Adaptadores e sessao de workspace no frontend
- Regras e configuracao Firebase relacionadas ao escopo de workspace

### SaaS, uso e persistencia de eventos

- Contratos e adaptadores SaaS no frontend
- Persistencia e rastreamento de uso
- Endpoints backend de SaaS e financas

### Sync, ownership e endurecimento de contrato

- Escopo de workspace no sync
- Validacao de schema
- Ajustes de CORS e documentacao de API

### Importacao, OCR e consolidacao de assinaturas

- Refino de importacao estruturada
- OCR de recibos
- Consolidacao de deteccao de assinaturas

### Baselines deterministicas

- `backend/data/saas-store.json`
- `backend/data/workspaces.json`

Naquele momento, esses arquivos ja estavam preparados para partir de estado limpo e deterministico, sem IDs ou timestamps locais espurios.

## Blocos que exigiam limpeza antes de commit

### Documentacao historica com drift de encoding

- `docs/archive/AUDITORIA_THOROUGH_2026-03-11.md`
- `docs/CHANGELOG.md`

Esses arquivos pediam uma passada exclusiva de documentacao, sem mistura com commit de codigo.

### Slice amplo de migracao e cutover backend

- Persistencia Postgres
- Store administrativa de workspace
- Store SaaS backend
- Scripts e plano de migracao

Esse bloco estava funcional, mas amplo o suficiente para justificar revisao de integracao separada.

## Agrupamento de commit recomendado no contexto original

1. Frontend principal, hooks, sync, importacao, OCR, workspace admin e testes.
2. Hardening da API backend, contratos HTTP e arquivos de suporte.
3. Cutover e migracao de persistencia.
4. Limpeza documental historica.

## Validacao usada na curadoria original

- `npm run lint`
- `npm run test:coverage:critical`
- Suites unitarias direcionadas para auth, sync, finance service, billing store, workspace admin, auditoria e regras do Firestore

## Leitura atual

Este documento deve ser tratado como evidencia historica de organizacao do worktree. Ele nao substitui o estado atual de release, roadmap ou source of truth operacional.
