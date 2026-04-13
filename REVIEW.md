---
phase: repository-architecture-review
reviewed: 2026-04-12T20:30:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - App.tsx
  - index.tsx
  - hooks/useAuthAndWorkspace.ts
  - hooks/useFinancialState.ts
  - hooks/useNavigationTabs.tsx
  - hooks/useSyncEngine.ts
  - src/app/financeService.ts
  - src/services/firestoreWorkspaceStore.ts
  - src/services/sync/cloudSyncClient.ts
  - src/services/workspaceSession.ts
  - src/config/api.config.ts
  - components/Login.tsx
  - components/TransactionList.tsx
  - components/Logo.tsx
  - pages/DashboardPage.tsx
  - backend/src/index.ts
  - backend/src/controllers/authController.ts
  - backend/src/middleware/workspaceContext.ts
  - backend/src/routes/sync.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase repository-architecture-review: Code Review Report

**Reviewed:** 2026-04-12T20:30:00Z  
**Depth:** standard  
**Files Reviewed:** 19  
**Status:** issues_found

## Summary

A base tem uma direção arquitetural melhor do que a média do histórico do projeto: existe separação entre frontend, domínio, sync, workspace e backend, o backend aplica contexto de workspace nas rotas sensíveis e os gates de validação atuais estão verdes (`npm run lint` e `npm run test:coverage:critical`).

O problema principal não é ausência de estrutura, e sim inconsistência entre a arquitetura declarada e alguns caminhos reais de execução. Há um risco concreto de integridade de escopo no caminho cliente → store Firestore, há auth local inseguro habilitável por ambiente, e ainda existe dívida estrutural/residual de produto congelado no shell principal.

## Critical Issues

### CR-01: Updates permitem preservar ou reintroduzir escopo indevido no caminho direto para Firestore

**File:** `src/app/financeService.ts:139` / `src/app/financeService.ts:209` / `src/app/financeService.ts:281` / `src/app/financeService.ts:379`  
**Issue:** As rotinas de update (`updateTransaction`, `updateAccount`, `updateGoal`, `updateReminder`) não revalidam ownership/escopo antes de persistir. Isso por si só já é frágil. O problema fica crítico porque o caminho de sync do frontend usa `src/services/sync/cloudSyncClient.ts`, que delega para `replaceWorkspaceEntityCollection`, e `stampEntityContext` em `src/services/firestoreWorkspaceStore.ts:721-729` preserva `user_id`, `tenant_id` e `workspace_id` recebidos do objeto quando eles já existem. Resultado: um objeto alterado no cliente pode ser salvo mantendo ids de escopo divergentes do contexto ativo.

**Fix:**
```ts
function forceEntityScope<T extends Record<string, unknown>>(
  entity: T,
  context: { userId: string; tenantId: string; workspaceId: string },
): T {
  return {
    ...entity,
    user_id: context.userId,
    tenant_id: context.tenantId,
    workspace_id: context.workspaceId,
  } as T;
}
```
Aplicar essa normalização em `stampEntityContext` e, antes de persistir updates no `financeService`, validar que a entidade original pertence ao contexto ativo e reescrever o escopo no objeto final.

## Warnings

### WR-01: Login local inseguro continua operacional por padrão em `development` e `test`

**File:** `backend/src/controllers/authController.ts:29` / `backend/src/controllers/authController.ts:48`  
**Issue:** `isInsecureLocalLoginAllowed()` retorna `true` por padrão em `development` e `test`, e `loginController` emite token apenas com `email` e `password` presentes, sem validação real de credencial. Isso pode ser aceitável como escape local, mas é um risco operacional relevante para staging mal configurado, ambientes compartilhados ou uso indevido de variáveis de ambiente.

**Fix:** Restringir esse fluxo a um flag explícito opt-in (`AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true`) e nunca habilitar implicitamente por `NODE_ENV`. O comportamento padrão deveria ser bloqueado, inclusive em `development`.

### WR-02: Shell principal ainda carrega Open Banking congelado no código de navegação

**File:** `hooks/useNavigationTabs.tsx:38`  
**Issue:** O produto atual documenta Open Finance/Pluggy como escopo congelado e fora da navegação principal, mas o shell ainda mantém lazy import, tab e fluxo de renderização para `OpenBankingPage`. Isso não quebra sozinho, mas mantém acoplamento desnecessário no runtime e aumenta custo de manutenção de um eixo que o produto já decidiu esconder.

**Fix:** Extrair o fluxo de Open Banking para um módulo opcional/dev-only isolado, removendo o import do hook principal de navegação e deixando o acesso apenas por rota/lab explícito.

### WR-03: `TransactionList` deriva identidade por `localStorage` em vez do contexto autenticado

**File:** `components/TransactionList.tsx:238` / `components/TransactionList.tsx:258`  
**Issue:** A tela usa `localStorage.getItem('flow_userId') || 'local'` para operações de sugestão/aprendizado de categoria. Isso contorna o contexto real de auth/workspace e pode associar aprendizado de IA ao usuário errado ou a um fallback genérico, produzindo comportamento inconsistente entre sessões/workspaces.

**Fix:** Passar `userId`, `tenantId` e `workspaceId` pelo contexto de navegação/props e remover a leitura direta de `localStorage` da camada de UI.

### WR-04: Existe rota/página de dashboard placeholder sem integração com a shell real

**File:** `pages/DashboardPage.tsx:4`  
**Issue:** O arquivo existe como página nominal de dashboard, mas é apenas um placeholder com TODO enquanto o app real continua usando `components/Dashboard`. Isso indica fragmentação de estrutura e aumenta o risco de manutenção paralela ou migração incompleta.

**Fix:** Ou remover o placeholder para evitar ambiguidade, ou concluir a extração e tornar a página a implementação única da dashboard.

## Info

### IN-01: Fallback fatal de bootstrap ainda injeta HTML manualmente no `document.body`

**File:** `index.tsx:113`  
**Issue:** Em falha fatal de inicialização, o app substitui o body inteiro por `document.body.innerHTML`. Aqui o conteúdo é estático e não há XSS imediata, mas o padrão contorna React/ErrorBoundary e dificulta consistência visual, telemetria e acessibilidade.

**Fix:** Renderizar uma tela fatal via React root dedicado ou componente de bootstrap error.

### IN-02: `Logo` injeta CSS inline com `dangerouslySetInnerHTML`

**File:** `components/Logo.tsx:98`  
**Issue:** O uso atual é estático e baixo risco, mas desnecessário para um componente recorrente. Isso amplia superfície de manutenção e foge do restante da estratégia de styling.

**Fix:** Mover animações para CSS/Tailwind global ou módulo de estilos.

### IN-03: Arquitetura geral está melhor do que a dívida residual sugere

**File:** `backend/src/index.ts` / `backend/src/routes/sync.ts` / `backend/src/middleware/workspaceContext.ts`  
**Issue:** Não é defeito, mas merece registro: o backend já faz um trabalho correto de autenticação, contexto de workspace e sobrescrita de escopo no sync HTTP. O principal problema é a existência paralela de caminhos diretos no frontend que não seguem o mesmo rigor.

**Fix:** Consolidar uma única fronteira de persistência sensível, preferencialmente backend-first para operações multi-tenant e fluxos financeiros.

---

_Reviewed: 2026-04-12T20:30:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
