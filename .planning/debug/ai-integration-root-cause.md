---
status: investigating
trigger: "Diagnosticar o problema de \"nenhuma IA funcionando\" como uma falha de integração end-to-end e ambiente."
created: 2026-04-25T00:00:00.000Z
updated: 2026-04-25T00:00:00.000Z
---

## Current Focus

hypothesis: Um gate sistÃªmico (workspaceId obrigatÃ³rio, authz `ai:use`, ou quota `aiQueries`) estÃ¡ bloqueando todas as rotas `/api/ai/*`; o frontend usa `silent: true`/try-catch e retorna fallback vazio, gerando a percepÃ§Ã£o de "IA offline".
test: Validar 2 classes de causa com evidÃªncia local: (A) gates (workspaceId/authz/quota) e (B) provider nÃ£o configurado no backend (ausÃªncia de `OPENAI_API_KEY`/`GEMINI_API_KEY` em `backend/.env*`).
expecting: Se (B) for verdade, `backend/src/config/ai.ts` sempre falha e o frontend cai em fallback silencioso; se (A) for verdade, os endpoints falham com 400/401/403/429 e o frontend tambÃ©m faz fallback.
next_action: Checar (sem vazar segredo) se `OPENAI_API_KEY`/`GEMINI_API_KEY` estÃ£o configuradas em `backend/.env` / `backend/.env.local`.

## Symptoms

expected: Endpoints de IA (interpret/insights/ocr/cfo) retornam respostas Ãºteis ao chamar via frontend (proxy backend).
actual: "Nenhuma IA funcionando" (frontend aparenta IA offline; possÃ­vel retorno vazio/fallback).
errors: (nÃ£o fornecido)
reproduction: Usar UI que chama `API_ENDPOINTS.AI.*` (interpret/insights/scan-receipt/cfo) e observar resposta vazia/fallback.
started: (nÃ£o fornecido)

## Eliminated

- hypothesis: Feature flags `AI_CHAT/AI_ANALYSIS/AI_OCR` desligadas estÃ£o bloqueando `/api/ai/*`
  evidence: `backend/src/routes/ai.ts` nÃ£o consulta `FeatureFlagService`; o gate do router Ã© `authMiddleware` + `workspaceContextMiddleware` + `authz` + `quotaMiddleware`.
  timestamp: 2026-04-25T00:00:00.000Z

## Evidence

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/src/routes/ai.ts
  found: Todas rotas `/api/ai/*` passam por `authMiddleware`, `workspaceContextMiddleware`, `authz('ai:use')` e `quotaMiddleware('aiQueries')` (exceto token-count sem quota).
  implication: Qualquer falha de auth/workspace/permissÃ£o/quota bloqueia IA antes do provider; efeito pode parecer "IA offline".

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/src/middleware/workspaceContext.ts
  found: Exige `x-workspace-id` (header/param/query/body) e valida pertencimento do usuÃ¡rio; sem header retorna `400 { error: 'WorkspaceId obrigatorio' }`.
  implication: Se o frontend nÃ£o enviar workspaceId, todas as rotas protegidas falham com 400 (e o frontend pode cair em fallback silencioso).

- timestamp: 2026-04-25T00:00:00.000Z
  checked: src/config/api.config.ts
  found: `apiRequest()` inclui `Authorization: Bearer ...` e adiciona `x-workspace-id` somente se `active_workspace_id` existir; tenta auto-recuperar workspace chamando `GET /api/workspace` quando recebe 400/403/404 de contexto.
  implication: Falhas de workspace podem ser "autocuradas" se o endpoint `/api/workspace` funcionar; se auth falhar (401), nÃ£o hÃ¡ recovery.

- timestamp: 2026-04-25T00:00:00.000Z
  checked: services/geminiService.ts
  found: Chamadas de IA usam `silent: true` e `retries: 0` em pontos crÃ­ticos; em catch retornam `[]`/`null`/`{ answer: '' }` sem propagar erro.
  implication: Erros 400/401/403/429/5xx podem virar "resposta vazia" no app, parecendo IA offline.

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/src/controllers/aiController.ts
  found: `interpretController` e `generateInsightsController` fazem catch e retornam fallback vazio (`data: []`, `insights: []`) com log em nÃ­vel warn; outras rotas geralmente retornam 500 em erro.
  implication: Uma falha sistÃªmica (auth/quota/provider) pode degradar para respostas vazias sem erro visÃ­vel no UI (dependendo do endpoint), reforÃ§ando a percepÃ§Ã£o de "IA offline".

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/src/services/featureFlags/featureFlagService.ts e backend/src/routes/ai.ts
  found: Existem flags `Feature.AI_CHAT/AI_ANALYSIS/AI_OCR`, mas as rotas `/api/ai/*` nÃ£o consultam `FeatureFlagService` (o gate real Ã© `authz/quota/workspace`); o uso de flags aparece principalmente em `AIServiceFactory` (nÃ£o referenciado pela rota atual).
  implication: "feature flag desligada" Ã© pouco provÃ¡vel como causa direta de "nenhuma IA funcionando" no caminho atual, a menos que exista outro wiring fora dos arquivos inspecionados.

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/src/config/ai.ts
  found: Se `OPENAI_API_KEY` e `GEMINI_API_KEY` estiverem ausentes, lanÃ§a erro ("No AI provider configured..."); em erros de provider tenta fallback conforme categoria.
  implication: AusÃªncia/invalidade de provider pode derrubar IA; parte das rotas (interpret/insights) no controller aplica fallback e nÃ£o retorna erro.

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/.env e backend/.env.local (sem expor valores)
  found: `OPENAI_API_KEY` e `GEMINI_API_KEY` estÃ£o presentes (valores nÃ£o vazados), `AI_PRIMARY_PROVIDER`/`AI_FALLBACK_PROVIDER` nÃ£o estÃ£o presentes (defaults aplicam).
  implication: Em ambiente local do repo, "ausÃªncia total de provider" nÃ£o Ã© a explicaÃ§Ã£o mais provÃ¡vel; restam gates/auth/URL/quota/keys invÃ¡lidas no ambiente real.

- timestamp: 2026-04-25T00:00:00.000Z
  checked: backend/shared/policyEngine.ts e backend/src/middleware/authz.ts
  found: PermissÃ£o `ai:use` existe para role `member` (e `owner`/`admin` via wildcard/heranÃ§a). Role `viewer` nÃ£o tem `ai:use`.
  implication: Se o usuÃ¡rio estiver como `viewer`, o app pode ter leitura de dados mas IA sempre retorna 403 (e o frontend faz fallback silencioso) â€” "nenhuma IA funcionando".

## Resolution

root_cause: ""
fix: ""
verification: ""
files_changed: []
