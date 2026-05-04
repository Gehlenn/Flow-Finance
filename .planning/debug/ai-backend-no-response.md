---
status: verifying
trigger: "Diagnosticar e corrigir o problema em que a IA não está funcionando no app, com foco no backend de IA."
created: 2026-04-25T00:00:00.000Z
updated: 2026-04-25T00:20:00.000Z
---

## Current Focus

hypothesis: Root cause confirmado: `safeJsonParse` é estrito e não lida com respostas do LLM que incluem markdown/code fences ou texto extra; `interpret`/`insights` engolem o erro e devolvem fallback vazio.
test: Rodar unit test cobrindo fenced JSON e ruído antes/depois do JSON.
expecting: Com extração, parse passa e controllers deixam de cair no fallback por causa de formatação do LLM.
next_action: Pedir verificação humana no app (interpret/insights) e, se confirmado, arquivar sessão.

## Symptoms

expected: Chamadas de IA retornam respostas úteis (interpretar texto, insights, classificação, OCR e CFO).
actual: No app, chamadas de IA não retornam respostas úteis; comportamento sugere "resposta vazia" ou fallback silencioso.
errors: Não há erro explícito reportado no app; suspeita de falha silenciosa de config/flag/fallback.
reproduction: Usar endpoints `/api/ai/*` via frontend (proxy `services/geminiService.ts`) e observar respostas vazias/sem dados.
started: Mudanças recentes no backend de IA (fallback Gemini/OpenAI, endurecimento de factory/singleton, novos guards/middlewares).

## Eliminated

## Evidence

- timestamp: 2026-04-25T00:08:00.000Z
  checked: backend/src/utils/jsonHelpers.ts
  found: safeJsonParse usa `JSON.parse` estrito e falha quando a resposta contém qualquer texto extra (ex: markdown/code fences).
  implication: Respostas válidas que vêm como ```json ...``` ou com preâmbulo causam `INVALID_AI_RESPONSE`.

- timestamp: 2026-04-25T00:09:00.000Z
  checked: backend/src/controllers/aiController.ts
  found: `interpretController` e `generateInsightsController` capturam qualquer erro (incl. parse/validação) e retornam fallback vazio via `res.json(build*FallbackResponse())`.
  implication: Falha de JSON/LLM vira “IA não funciona” no app sem erro explícito, porque a resposta é semanticamente vazia.

## Resolution

root_cause: "`backend/src/utils/jsonHelpers.ts` fazia `JSON.parse` direto e falhava em respostas comuns do LLM (ex: ```json fences / preâmbulo), gerando `INVALID_AI_RESPONSE`. Como `interpretController` e `generateInsightsController` fazem catch genérico e retornam fallback vazio, o app via respostas semanticamente vazias."
fix: "Tornei `safeJsonParse` tolerante a JSON dentro de code fences e a JSON com ruído (extração de substring) antes de registrar erro e lançar AppError."
verification: "Unit test: `npm exec vitest -- run backend/tests/unit/json-helpers.safe-json-parse.test.ts --pool=threads --maxWorkers=1`"
files_changed:
  - backend/src/utils/jsonHelpers.ts
  - backend/tests/unit/json-helpers.safe-json-parse.test.ts
