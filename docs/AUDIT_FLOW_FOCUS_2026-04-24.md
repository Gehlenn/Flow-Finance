# Auditoria de Execução - Flow Focus 2026-04 (2026-04-24)

Data: 2026-04-24
Escopo: alinhar o repositório com o bundle canônico do vault e validar o hotfix da matriz de E2E.

## Resumo

- `npm run health:vercel` continua respeitando `VERCEL_TARGET_URL`.
- `npm run test:critical` permanece como alias para `npm run test:coverage:critical`.
- `npm run validate:e2e:matrix` e `npm run validate:e2e:matrix:dry` seguem disponíveis.
- `scripts/validate-e2e-matrix.mjs` agora chama o CLI do Playwright diretamente via `node`.
- O workflow de CI passou a enviar `--project "Mobile Chrome"` e `--project "Mobile Safari"` de forma explícita.
- O backend continua com `npm run build` limpando `dist/` antes de compilar e `npm start` apontando para `dist/src/index.js`.
- A observabilidade de IA segue com telemetria estruturada e agora inclui resumo de confiança quando o payload expõe sinais de confidence.
- O dashboard e o assistente ganharam hierarquia mais operacional: caixa confirmado, previsao e pendencias agora aparecem com separacao visual mais clara.
- A tela de login deixou de parecer uma tela genérica de SaaS e passou a explicitar o painel operacional de caixa e pendências.
- A lista de transações agora abre com leitura rápida de confirmado, pendente e vencido, reduzindo o risco de leitura errada do caixa.
- O painel de fluxo passou a separar caixa realizado, entradas e saídas antes de abrir o diagnóstico consultivo.
- O intake compartilhado agora destaca que a IA triagem/revisão não substitui validação do caixa antes de salvar.
- A tela de configurações ficou mais operacional, com prioridade para workspace, acesso e suporte em vez de um painel genérico de SaaS.

## Hotfix validado

O gate de E2E tinha uma regressão quando o nome do projeto continha espaço. O wrapper anterior usava um `spawn` que podia falhar com `EINVAL` ao executar o projeto `Mobile Chrome` ou `Mobile Safari`.

Correção aplicada:
- normalização dos argumentos `--project=...` no script `scripts/validate-e2e-matrix.mjs`;
- execução direta do CLI do Playwright via `node`, sem `npx`/wrapper de shell;
- ajuste do workflow para passar o nome do projeto como argumento separado.

Validações executadas:
- `npm run test:ci`
- `npm run validate:e2e:matrix:dry`
- `npm run validate:e2e:matrix -- --project "Mobile Chrome" --list`
- `npm run validate:e2e:matrix -- --project "Mobile Safari" --list`

## Nova evidência de IA

- `backend/tests/unit/ai-controller-confidence-summary.test.ts`
- `backend/src/controllers/aiController.ts`

## Evidência de UI

- `components/Login.tsx`
- `tests/unit/login.test.tsx`
- `components/TransactionList.tsx`
- `tests/unit/transaction-list-states.test.tsx`
- `components/CashFlow.tsx`
- `tests/unit/cashflow-clarity.test.tsx`
- `components/AIInput.tsx`
- `tests/unit/ai-input.test.tsx`
- `components/Settings.tsx`
- `tests/unit/settings-workspace-admin.test.tsx`
- `components/Dashboard.tsx`
- `components/Assistant.tsx`
- `src/app/assistantCopy.ts`
- `tests/unit/dashboard-quick-actions.test.tsx`
- `tests/unit/assistant-reminder-states.test.tsx`
- `tests/unit/assistant-copy.test.ts`

## Hotfix de sessão local

A IA no app também dependia de sessão backend válida. O ambiente local não estava habilitando o fallback seguro de desenvolvimento, então o frontend entrava em login Firebase sem conseguir fechar a troca de sessão no backend.

Correção aplicada:
- `VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true` em `.env.local`;
- `AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true` em `backend/.env.local`;
- atualização dos arquivos de exemplo para deixar o caminho explícito em novas instalações.

Efeito esperado:
- quando o Firebase local não estiver com backend identity configurado, o fluxo de desenvolvimento cai para o login local controlado;
- o frontend passa a receber token backend válido;
- as rotas de IA deixam de responder 401/fallback vazio no app local.

## Evidências

- Arquivo do hotfix: `scripts/validate-e2e-matrix.mjs`
- Workflow atualizado: `.github/workflows/tests.yml`
- Teste novo: `tests/unit/validate-e2e-matrix.test.ts`
- Arquivos de ambiente atualizados: `.env.local`, `backend/.env.local`, `.env.example`, `backend/.env.example`

## Conclusão

O gate de E2E ficou estável para projetos com espaço no nome e a suíte geral permaneceu verde após a correção.
O fluxo de IA no app local agora depende do login de desenvolvimento habilitado por env para conseguir obter sessão backend.

## Limite desta sessão

- A limpeza de `src/finance/importService.ts` foi abortada e revertida para evitar conflito com outra sessão em paralelo.
- O arquivo voltou ao estado limpo do `HEAD`, e `npm run type-check:app` permaneceu verde.
- O gap de import service fica explicitamente deferido para uma sessão isolada, com foco próprio de encoding/parser.
## Evidencia adicional desta sessao

- O backend local passou a carregar `.env.local` em ambiente nao produtivo.
- `AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true` voltou a valer na sessao local.
- `POST /api/auth/login` com `owner-1` retornou token valido.
- `POST /api/ai/cfo` com token valido e `x-workspace-id` retornou resposta consultiva real.
- O token manual assinado com chave diferente falhou, confirmando que o backend agora respeita a chave carregada da sessao local.

## UX de diagnostico reforcada

- A tela de Estrategia Flow agora mostra um banner explicito quando a IA cai em fallback.
- O resumo e o plano de acao deixam de parecer vazios sem explicacao.
- O usuario passa a ver a acao esperada para 401, 402, 403 e 429 em vez de silencio.

## Navegacao e Settings alinhados

- A navegacao principal agora fala `Início`, `Transações`, `Fluxo`, `IA consultiva` e `Configurações`.
- `Settings` passou a abrir com linguagem operacional e rótulos de seção mais claros.
- O fluxo de logout no teste de Settings foi fixado por role para evitar falso positivo textual.
