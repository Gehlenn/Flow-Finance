# Auditoria de ExecuÃ§Ã£o - Flow Focus 2026-04 (2026-04-24)

Data: 2026-04-24
Escopo: alinhar o repositÃ³rio com o bundle canÃ´nico do vault e validar o hotfix da matriz de E2E.

## Resumo

- `npm run health:vercel` continua respeitando `VERCEL_TARGET_URL`.
- `npm run test:critical` permanece como alias para `npm run test:coverage:critical`.
- `npm run validate:e2e:matrix` e `npm run validate:e2e:matrix:dry` seguem disponÃ­veis.
- `scripts/validate-e2e-matrix.mjs` agora chama o CLI do Playwright diretamente via `node`.
- O workflow de CI passou a enviar `--project "Mobile Chrome"` e `--project "Mobile Safari"` de forma explÃ­cita.
- O backend continua com `npm run build` limpando `dist/` antes de compilar e `npm start` apontando para `dist/src/index.js`.
- A observabilidade de IA segue com telemetria estruturada e agora inclui resumo de confianÃ§a quando o payload expÃµe sinais de confidence.
- O dashboard e o assistente ganharam hierarquia mais operacional: caixa confirmado, previsao e pendencias agora aparecem com separacao visual mais clara.
- A tela de login deixou de parecer uma tela genÃ©rica de SaaS e passou a explicitar o painel operacional de caixa e pendÃªncias.
- A lista de transaÃ§Ãµes agora abre com leitura rÃ¡pida de confirmado, pendente e vencido, reduzindo o risco de leitura errada do caixa.
- O painel de fluxo passou a separar caixa realizado, entradas e saÃ­das antes de abrir o diagnÃ³stico consultivo.
- O intake compartilhado agora destaca que a IA triagem/revisÃ£o nÃ£o substitui validaÃ§Ã£o do caixa antes de salvar.
- A tela de configuraÃ§Ãµes ficou mais operacional, com prioridade para workspace, acesso e suporte em vez de um painel genÃ©rico de SaaS.

## Hotfix validado

O gate de E2E tinha uma regressÃ£o quando o nome do projeto continha espaÃ§o. O wrapper anterior usava um `spawn` que podia falhar com `EINVAL` ao executar o projeto `Mobile Chrome` ou `Mobile Safari`.

CorreÃ§Ã£o aplicada:
- normalizaÃ§Ã£o dos argumentos `--project=...` no script `scripts/validate-e2e-matrix.mjs`;
- execuÃ§Ã£o direta do CLI do Playwright via `node`, sem `npx`/wrapper de shell;
- ajuste do workflow para passar o nome do projeto como argumento separado.

ValidaÃ§Ãµes executadas:
- `npm run test:ci`
- `npm run validate:e2e:matrix:dry`
- `npm run validate:e2e:matrix -- --project "Mobile Chrome" --list`
- `npm run validate:e2e:matrix -- --project "Mobile Safari" --list`

## Nova evidÃªncia de IA

- `backend/tests/unit/ai-controller-confidence-summary.test.ts`
- `backend/src/controllers/aiController.ts`

## EvidÃªncia de UI

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

## Hotfix de sessÃ£o local

A IA no app tambÃ©m dependia de sessÃ£o backend vÃ¡lida. O ambiente local nÃ£o estava habilitando o fallback seguro de desenvolvimento, entÃ£o o frontend entrava em login Firebase sem conseguir fechar a troca de sessÃ£o no backend.

CorreÃ§Ã£o aplicada:
- `VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true` em `.env.local`;
- `AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true` em `backend/.env.local`;
- atualizaÃ§Ã£o dos arquivos de exemplo para deixar o caminho explÃ­cito em novas instalaÃ§Ãµes.

Efeito esperado:
- quando o Firebase local nÃ£o estiver com backend identity configurado, o fluxo de desenvolvimento cai para o login local controlado;
- o frontend passa a receber token backend vÃ¡lido;
- as rotas de IA deixam de responder 401/fallback vazio no app local.

## EvidÃªncias

- Arquivo do hotfix: `scripts/validate-e2e-matrix.mjs`
- Workflow atualizado: `.github/workflows/tests.yml`
- Teste novo: `tests/unit/validate-e2e-matrix.test.ts`
- Arquivos de ambiente atualizados: `.env.local`, `backend/.env.local`, `.env.example`, `backend/.env.example`

## ConclusÃ£o

O gate de E2E ficou estÃ¡vel para projetos com espaÃ§o no nome e a suÃ­te geral permaneceu verde apÃ³s a correÃ§Ã£o.
O fluxo de IA no app local agora depende do login de desenvolvimento habilitado por env para conseguir obter sessÃ£o backend.

## Open Banking Observability

- `disconnectBank` agora registra falhas do backend/provider com diagnostico estruturado antes de remover a conexao local.
- `fullSync` agora registra falha parcial de contas sem interromper a etapa de transacoes, mantendo o fluxo tolerante existente.
- A tela de Open Banking agora mostra diagnostico visivel quando health, conectores ou token Pluggy falham ao carregar.
- O bloco de carregamento do Pluggy agora expÃµe um botao de retry visivel para reabrir o fluxo sem recarregar a pagina inteira.
- A recarga de conexoes bancarias agora mostra diagnostico visivel quando falha, em vez de deixar a tela sem explicacao.
- A recarga de conexoes bancarias agora tambem oferece retry visivel no proprio alerta, mantendo o fluxo no mesmo contexto.
- O alerta de recarga tambem reaproveita o hint de recuperacao do provider, em vez de deixar o usuario sem contexto quando o backend esta em mock.
- Entrar no fluxo de conectar banco agora limpa erro de recarga anterior, para nao carregar um alerta velho entre telas.
- Acoes individuais de sync/desconexao agora mostram erro visivel quando rejeitam inesperadamente, e o botao de desconectar ganhou nome acessivel.
- Sync em lote agora mostra erro visivel quando todas as conexoes listadas estao em erro.
- Evidencia: `services/integrations/openBankingService.ts`, `pages/OpenBanking.tsx`, `tests/unit/open-banking-service-critical-branches.test.ts` e `tests/unit/open-banking-page.test.tsx`.

## Limite desta sessÃ£o

- O `importService.ts` foi rechecado em UTF-8 e o aparente mojibake era apenas renderizaÃ§Ã£o do terminal; nÃ£o ficou limpeza de fonte aberta neste eixo.
- O arquivo permaneceu limpo no `HEAD`, e `npm run type-check:app` continuou verde.

## Verificacao dedicada de mojibake

- `src/ai/financialAutopilot.ts` e `src/ai/insightGenerator.ts` foram verificados por padroes Unicode reais, nao pela renderizacao do terminal.
- Nenhum dos dois arquivos contem os marcadores U+00C3, U+00E2 ou U+00C2 que caracterizavam a divida de mojibake.
- `npm run docs:check-mojibake` confirmou o baseline sem ocorrencias.
- Durante a validacao, `npm run lint` acusou drift de type-check em detectores financeiros e metas; os checks de `undefined` e a inicializacao de `status` foram corrigidos.

## Gate critico restaurado

- `test:critical` voltou a existir como alias de `test:coverage:critical`.
- A suite critica passou com 154 testes em 10 arquivos.
- A cobertura de branches ficou em 98.56%, acima do threshold global de 98%.
- O caso de erro local do Open Banking agora cobre a mensagem padrao retornada ao usuario e o diagnostico com `requestId`.

## Open Banking failure states

- O bloco Open Banking e o gate critico foram validados com 168 testes e cobertura de branches em 100%.
- A tela ja mostra diagnosticos visiveis para falha de reload, health/token Pluggy, sync e disconnect.
- O item ainda aberto foi reduzido para recuperacao especifica por provider, agora visivel tambem quando o backend entra em modo mock antes mesmo de qualquer erro de load.
## Parsing de datas local

- `helpers.ts`, `cashflowPredictor.ts` e `CFOAdvisor.ts` agora validam date-only com roundtrip local, descartando datas impossiveis em vez de aceitar a normalizacao silenciosa do `Date`.
- A cobertura remanescente do gate foi eliminada; `openBankingService.ts` agora fecha o ultimo ramo redundante de fallback de mensagem e o gate critico encerra sem branches pendentes.
- `src/engines/importacao/pdfExtrato.ts` foi reescrito em UTF-8 limpo e voltou a compilar com `pdf-parse` via import dinÃ¢mico, eliminando o ultimo erro de `type-check`.
- O parser de PDF agora tem cobertura para texto vazio e rejeicao do parser, deixando o fallback de importacao visivel nos testes.
- `FinanceCategory` agora tem uma unica fonte de verdade no engine de categorizacao, e o reexport em `transactionCategorizer.ts` preserva o contrato publico.
## Evidencia adicional desta sessao

- O backend local passou a carregar `.env.local` em ambiente nao produtivo.
- `AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true` voltou a valer na sessao local.
- `POST /api/auth/login` com `owner-1` retornou token valido.
- `POST /api/ai/cfo` com token valido e `x-workspace-id` retornou resposta consultiva real.
- O token manual assinado com chave diferente falhou, confirmando que o backend agora respeita a chave carregada da sessao local.
- O verificador `npm run health:vercel` foi endurecido para identificar quando o dominio backend serve o shell do frontend em vez do contrato de API esperado.
- A hipoteses mais provavel agora e root directory/deploy do backend apontado para o shell do frontend em vez de `backend/`.

## UX de diagnostico reforcada

- A tela de Estrategia Flow agora mostra um banner explicito quando a IA cai em fallback.
- O resumo e o plano de acao deixam de parecer vazios sem explicacao.
- O usuario passa a ver a acao esperada para 401, 402, 403 e 429 em vez de silencio.
- O banner de fallback agora exibe mensagem, sugestao e proximo passo quando o backend devolve diagnostico estruturado.
- O teste `tests/unit/cashflow-clarity.test.tsx` cobre o banner visivel e a invalidacao do relatorio quando o recorte de caixa muda.

## Navegacao e Settings alinhados

- A navegacao principal agora fala `InÃ­cio`, `TransaÃ§Ãµes`, `Fluxo`, `IA consultiva` e `ConfiguraÃ§Ãµes`.
- `Settings` passou a abrir com linguagem operacional e rÃ³tulos de seÃ§Ã£o mais claros.
- O fluxo de logout no teste de Settings foi fixado por role para evitar falso positivo textual.

## CashFlow clarity estabilizada

- `tests/unit/cashflow-clarity.test.tsx` foi recriado em UTF-8 limpo e deixou de depender do caminho assï¿½ncrono frï¿½gil da IA.
- O teste agora cobre renderizaï¿½ï¿½o do painel, recuperaï¿½ï¿½o de relatï¿½rio salvo, rejeiï¿½ï¿½o de payload legado e invalidaï¿½ï¿½o quando o recorte de caixa muda.
- `npm run docs:check-mojibake`, `npm run lint` e `npm run test:critical` voltaram a passar depois da limpeza.

## Dead code removido

- `pages/DashboardPage.tsx` foi removido como re-export morto para `components/Dashboard`.
- `npm run lint` e `npm run docs:check-mojibake` seguiram verdes apï¿½s a remoï¿½ï¿½o.

## Compartilhamento com diagnostico

- O texto compartilhado da tela de Estrategia Flow agora inclui o diagnostico tecnico e o proximo passo quando houver fallback de IA.
- Assim, WhatsApp, e-mail e copia deixam de esconder o motivo da indisponibilidade.


## Queue examples removidos

- `src/ai/queue/examples.ts` foi removido como exemplo/demo sem importaï¿½ï¿½o em runtime.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` seguiram verdes depois da remoï¿½ï¿½o.

## AICFO com diagnostico visivel

- A resposta do CFO agora carrega diagnostico estruturado quando a IA cai em fallback ou retorna vazio.
- A tela AICFO exibe um banner tecnico na bolha do assistente, sem deixar o usuario com resposta aparentemente valida mas sem contexto.
- O teste `tests/unit/aicfo-plan-render.test.tsx` cobre o banner de diagnostico e o texto de recuperacao.


## Mï¿½dulos ï¿½rfï¿½os removidos

- `hooks/useCashFlowState.ts`, `components/SpendingAlerts.tsx`, `src/events/financialEventStream.ts` e `src/runtime/index.ts` foram removidos como mï¿½dulos sem importaï¿½ï¿½o viva.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` seguiram verdes depois da limpeza.

## Login com diagnostico visivel

- O login agora exibe um banner de diagnostico quando Firebase nao esta configurado, quando o login local falha ou quando o dominio nao esta autorizado.
- O usuario passa a ver o proximo passo em vez de apenas a mensagem bruta de erro.

## Suporte IA em Settings

- O modal de suporte agora mostra diagnostico visivel quando o suporte IA cai em fallback ou retorna vazio.
- Cada intent recebe mensagem e sugestao especificas para reduzir resposta crua sem contexto.


## AI Debug Logs alimentados

- A resposta vazia do CFO agora gera log de debug no painel de AI Debug Logs.
- O painel deixa de ficar oco quando a IA falha e passa a mostrar a entrada, intent e motivo do fallback.
- O teste 	ests/unit/ai-cfo-debug-log.test.ts cobre a gravaÃ§Ã£o do log local.


## Chunk guard simplificado

- `src/runtime/chunkGuard.ts` perdeu o alias legado `initChunkGuard` e o export morto `resetChunkErrorCount`.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` continuaram verdes apï¿½s a limpeza.

## Version guard simplificado

- `src/runtime/versionGuard.ts` perdeu o helper morto de notificaï¿½ï¿½o de mismatch de versï¿½o.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` continuaram verdes depois da limpeza.

## AIInput com diagnostico visivel

- O fluxo de captura inteligente agora mostra diagnostico quando a interpretacao da IA volta unknown ou falha.
- O painel de revisao e a tela principal exibem mensagem e proximo passo em vez de um erro generico sem contexto.
- O teste `tests/unit/ai-input.test.tsx` cobre o estado de diagnostico visivel.


## Limite desta passada

- Os itens remanescentes agora caem em contrato compartilhado, migração de validação ou dependência de outra sessão.
- O restante do cleanup deve ficar em passadas dedicadas, não em remoção cega.

## Open Banking com hint de recuperacao

- O bloco de erro de acao em Open Banking agora mostra uma hint derivada da falha, em vez de apenas o texto bruto.
- A falha de conectar banco real passou a orientar a validacao de sessao e token antes da nova tentativa.
- O teste `tests/unit/open-banking-page.test.tsx` cobre a mensagem e o proximo passo visivel.
## Parser Lab com diagnostico visivel

- O Parser Lab agora mostra diagnostico quando nao identifica transacoes, em vez de retornar apenas zero linhas.
- O usuario recebe mensagem de causa provavel e proximo passo para ajustar formato, cabecalho ou separador.
- Os testes `tests/unit/ai-control-panel-parser-lab.test.ts` e `tests/unit/ai-control-panel-parser-lab-ui.test.tsx` cobrem o novo comportamento.
## Workspace Admin em PT-BR

- O painel de administracao do workspace passou a exibir textos e mensagens de faturamento em PT-BR.
- O estado de carregamento, a visao apenas leitura e as acoes de faturamento foram traduzidos sem mexer nos identificadores tecnicos.
- Os testes `tests/unit/workspace-admin-page.test.tsx` cobrem checkout, portal, plano mock e modo apenas leitura.
## Receipt Scanner com diagnostico visivel

- O scanner de recibos agora mostra diagnostico quando a extracao falha ou quando a imagem enviada nao e valida.
- O usuario recebe sugestao de recuperacao para ajustar a foto ou seguir para o preenchimento manual.
- O teste `tests/unit/receipt-scanner-draft-path.test.tsx` cobre o fluxo feliz e a falha com diagnostico.

## ImportTransactions com diagnostico visivel

- A tela de importacao agora mostra diagnostico quando a pipeline termina sem transacoes aproveitaveis.
- O estado de erro exibe causa provavel e proximo passo em vez de apenas o texto bruto da falha.
- O teste `tests/unit/import-transactions-session.test.tsx` cobre o caso de importacao quebrada sem transacoes.

## Workspace Audit com diagnostico visivel

- A tela de auditoria do workspace agora mostra diagnostico visivel quando o carregamento falha.
- O usuario recebe causa provavel e proximo passo em vez de ficar preso no erro bruto.
- O teste `tests/unit/workspace-audit-page.test.tsx` cobre o estado de falha com diagnostic.

## Accounts com diagnostico visivel

- O formulario de contas agora mostra diagnostico visivel quando o saldo inicial nao pode ser convertido em moeda.
- O usuario recebe sugestao de formato valido em vez de apenas o erro bruto.
- O teste `tests/unit/accounts-form.test.tsx` cobre o bloqueio do saldo invalido com estado de diagnostico.

## Settings com diagnostico visivel

- O painel de settings agora mostra diagnostico visivel quando o plano do workspace nao carrega.
- O suporte IA e as areas sensiveis continuam oferecendo fallback, mas com pista clara do proximo passo.
- O teste `tests/unit/settings-workspace-admin.test.tsx` cobre a falha de billing com estado de diagnostico.

## Workspace Admin com diagnostico visivel

- A administracao do workspace agora mostra diagnostico visivel quando a carga inicial falha.
- O usuario recebe causa provavel e proximo passo em vez de apenas o erro bruto.
- O teste `tests/unit/workspace-admin-page.test.tsx` cobre a falha de carregamento com estado de diagnostico.

## Open Banking com diagnostico visivel

- O erro de reload do Open Banking agora mostra diagnostico visivel em vez de apenas o texto bruto.
- A tela destaca causa provavel e proximo passo para o usuario retomar o fluxo real.
- O teste `tests/unit/open-banking-page.test.tsx` cobre a falha de carregamento com o bloco de diagnostico.

## Goals com diagnostico visivel

- O formulario de metas agora mostra diagnostico visivel quando o valor alvo ou o aporte sao invalidos.
- O usuario recebe causa provavel e proximo passo em vez de apenas o texto bruto do erro.
- Os testes `tests/unit/goals-page.test.tsx` e `tests/unit/goals-contribution.test.tsx` cobrem a criacao e o aporte com estado de diagnostico.

## Assistant com diagnostico visivel ao gerar sugestoes

- O modal de alertas inteligentes agora mostra diagnostico visivel quando a geracao falha.
- O usuario recebe causa provavel, sugestao de recuperacao e acao para tentar novamente.
- O teste `tests/unit/assistant-smart-alerts-fallback.test.tsx` cobre a falha de geracao com bloco de diagnostico.

## Autopilot com diagnostico visivel ao falhar aprendizado

- O Autopilot agora mostra diagnostico visivel quando o aprendizado em segundo plano falha.
- O usuario recebe causa provavel e sugestao de recuperacao em vez de um erro silencioso no console.
- O teste `tests/unit/autopilot-refresh.test.tsx` cobre a falha de aprendizado com estado de diagnostico.

## AICFO com diagnostico visivel ao falhar aprendizado da conversa

- O CFO agora mostra diagnostico visivel quando o aprendizado em segundo plano falha.
- O usuario recebe causa provavel e sugestao de recuperacao em vez de um erro silencioso apos a pergunta.
- O teste `tests/unit/aicfo-plan-render.test.tsx` cobre a falha de aprendizado da conversa com estado de diagnostico.

## Settings com diagnostico visivel ao vincular provedor

- O vinculo social agora mostra diagnostico visivel quando o popup ou a credencial falha.
- O usuario recebe causa provavel e sugestao de recuperacao em vez de apenas a mensagem bruta do erro.
- O teste `tests/unit/settings-workspace-admin.test.tsx` cobre a falha de vinculo com estado de diagnostico.

## Accounts com diagnostico visivel ao criar conta

- A criacao de conta agora mostra diagnostico visivel quando o salvamento falha.
- O usuario recebe causa provavel e proximo passo em vez de apenas erro no console.
- O teste `tests/unit/accounts-form.test.tsx` cobre a falha de salvamento com estado de diagnostico.

## AIInput com diagnostico visivel ao falhar leitura de imagem

- A leitura de imagem agora mostra diagnostico visivel quando a interpretacao falha.
- O usuario recebe causa provavel e proximo passo em vez de apenas um erro seco.
- O teste `tests/unit/ai-input.test.tsx` cobre a falha de leitura de imagem com estado de diagnostico.

## TransactionList com diagnostico visivel ao falhar aprendizado auxiliar

- O salvamento de categoria agora mostra diagnostico visivel quando o aprendizado auxiliar da IA falha.
- A transacao segue atualizada localmente, mas o usuario passa a receber um aviso de sincronizacao pendente em vez de silencio.
- O teste `tests/unit/transaction-list-category-learning-diagnostic.test.tsx` cobre a falha do aprendizado auxiliar com estado de diagnostico.

## AIControlPanel com diagnostico visivel ao falhar carregamento de memorias

- A aba de memoria agora mostra diagnostico visivel quando a leitura de AI Memory falha.
- O painel deixa de confundir falha de carga com ausencia real de dados.
- O teste `tests/unit/ai-control-panel-memory-error.test.tsx` cobre o erro de carregamento com bloco de diagnostico.

## Settings com diagnostico visivel ao falhar copia de integracoes

- Os fluxos de copia de chave, payload e curl agora mostram diagnostico visivel se o clipboard do navegador bloquear a operacao.
- O usuario deixa de receber sucesso falso quando a copia nao foi realmente concluida.
- O teste `tests/unit/settings-clipboard-diagnostic.test.tsx` cobre a falha de copia com estado de diagnostico.

## CashFlow com diagnostico visivel ao falhar copia de resumo

- A copia do resumo do fluxo agora mostra diagnostico visivel se o clipboard bloquear a operacao.
- O modal de compartilhamento permanece aberto em caso de falha para evitar sucesso falso.
- O teste `tests/unit/cashflow-clipboard-diagnostic.test.tsx` cobre a falha de copia do resumo com estado de diagnostico.

## TransactionList com diagnostico visivel ao falhar copia do historico

- A copia do historico agora mostra diagnostico visivel se o clipboard bloquear a operacao.
- O modal de compartilhamento permanece aberto em caso de falha para evitar sucesso falso.
- O teste `tests/unit/transaction-list-clipboard-diagnostic.test.tsx` cobre a falha de copia do historico com estado de diagnostico.

## ImportTransactions com diagnostico visivel ao falhar aprendizado auxiliar

- A importacao continua concluindo mesmo quando o aprendizado auxiliar de categorias falha.
- O usuario agora recebe um aviso visivel de aprendizado pendente em vez de silencio depois da importacao.
- O teste `tests/unit/import-transactions-session.test.tsx` cobre a importacao concluida com aprendizado auxiliar pendente.

## TransactionList com diagnostico visivel ao falhar sugestao de categoria

- A sugestao de categoria da IA agora mostra diagnostico visivel quando a consulta falha.
- O modal de edicao continua funcional com orientacao manual para o usuario.
- O teste `tests/unit/transaction-list-suggestion-diagnostic.test.tsx` cobre a falha da sugestao de categoria com estado de diagnostico.

## Settings com diagnostico visivel ao falhar metadados da chave de integracao

- O carregamento dos metadados da chave de integracao agora mostra diagnostico visivel quando o GET falha.
- A area de integracoes deixa de engolir erro de provisionamento/consulta sem contexto.
- O teste `tests/unit/settings-clipboard-diagnostic.test.tsx` cobre a falha de carregamento dos metadados com estado de diagnostico.

## BankSyncEngine com aviso contextual ao falhar persistencia do relatorio

- A persistencia do relatorio de sync agora registra aviso contextual quando o `localStorage` falha.
- O auto sync tambem deixa rastro quando a rotina agendada falha, sem bloquear a execucao principal.
- O teste `tests/unit/bank-sync-engine.test.ts` cobre a persistencia do relatorio com falha de armazenamento.

## Open Banking com aviso contextual ao falhar classificacao da IA

- A classificacao das transacoes durante o sync agora registra aviso contextual quando a IA falha.
- O fluxo continua com mapeamento basico, mas sem virar silencio operacional.
- O teste `tests/unit/open-banking-service-critical-branches.test.ts` cobre a falha de classificacao com fallback basico.

## Open Banking com aviso contextual ao falhar recarga de conexoes

- A recarga de conexoes agora registra aviso contextual quando o backend falha.
- O fluxo retorna ao cache local sem parecer uma leitura bem-sucedida silenciosa.
- O teste `tests/unit/open-banking-service-critical-branches.test.ts` cobre a recarga com backend indisponivel e cache local.

## LocalSync com aviso contextual ao falhar push e pull

- O push para a nuvem agora registra aviso contextual quando falha, mantendo o cache local como fonte imediata.
- O pull da nuvem agora registra aviso contextual quando falha, em vez de retornar null sem rastro.
- O teste `tests/unit/localSyncService.test.ts` cobre push e pull com falha de rede/contexto.

## BackendSession com erro explicito para payload invalido

- A troca de sessao backend agora registra aviso contextual quando o JSON da resposta vem invalido.
- O login falha com mensagem explicita em vez de esconder o problema atras de um parse silencioso.
- O teste `tests/unit/backend-session.test.ts` cobre o payload invalido na troca firebase.

## AI storage com aviso contextual ao falhar parse de memoria e debug

- O carregamento da memoria da IA agora registra aviso contextual quando o JSON vem corrompido.
- O carregamento dos logs de debug da IA agora registra aviso contextual quando o JSON vem corrompido.
- O teste `tests/unit/ai-storage-resilience.test.ts` cobre a resiliencia com storage malformado.

## ImportService com aviso contextual ao falhar classificacao e leitura de arquivo

- A classificacao por IA durante a importacao agora registra aviso contextual quando o backend falha.
- O parse de PDF e a deteccao de formato agora deixam rastro quando a leitura de arquivo falha.
- O teste `tests/unit/import-service.test.ts` cobre a classificacao com fallback padrao e aviso contextual.

## Auth middleware com aviso contextual ao falhar decode de token

- O decode de token agora registra aviso contextual quando a validacao JWT falha.
- O contrato continua igual para os chamadores: o retorno permanece `null`, mas a falha deixa rastro observavel.
- O teste `backend/tests/unit/auth-decode-token.test.ts` cobre o token invalido com log de aviso.

## Stripe com aviso contextual ao falhar parse do webhook

- O parse do webhook Stripe agora registra aviso contextual quando o JSON chega invalido.
- O contrato continua igual para os chamadores: a rota segue devolvendo erro 400, mas a falha deixa rastro observavel.
- O teste `backend/tests/unit/stripe-service.test.ts` cobre o payload invalido do webhook com log de aviso.

## GoalService com aviso contextual ao falhar leitura do storage

- A leitura das metas agora registra aviso contextual quando o storage local vem corrompido.
- O contrato continua igual para os chamadores: o retorno permanece uma lista vazia, mas a falha deixa rastro observavel.
- O teste `tests/unit/goal-service.test.ts` cobre o storage corrompido com log de aviso.

## ReceiptScanner com aviso contextual ao falhar scan do backend

- O scan do recibo agora registra aviso contextual quando o backend falha.
- O contrato continua igual para os chamadores: o retorno permanece estruturado com `success: false`, mas a falha deixa rastro observavel.
- O teste `tests/unit/receipt-scanner.test.ts` cobre o scan com backend indisponivel e log de aviso.

## EncryptionService com aviso contextual ao falhar gravacao e fallback de leitura

- A gravacao do armazenamento criptografado agora registra aviso contextual quando a criptografia falha.
- O fallback de leitura em desenvolvimento agora registra aviso contextual quando o JSON puro vem corrompido.
- O teste `tests/unit/encryption-service.test.ts` cobre a gravacao em fallback e o parse corrompido com log de aviso.

## ReceiptScanner com aviso contextual ao falhar estrategia de data

- A estrategia de data do recibo agora registra aviso contextual quando uma tentativa de parse falha.
- O parser continua tentando as proximas estrategias, mas sem perder o rastro da falha intermediaria.
- O teste `tests/unit/receipt-scanner.test.ts` cobre a falha da estrategia de data com log de aviso.

## BankSyncEngine com aviso contextual ao falhar analises pos-sync

- A persistencia do relatorio de sync, a leitura do historico e as analises pos-sync agora deixam rastro quando falham.
- O sync continua funcionando, mas sem esconder falhas de armazenamento ou de insights.
- O teste `tests/unit/bank-sync-engine.test.ts` cobre a persistencia e as falhas de analise com log de aviso.

## ExternalIntegrationAuth com aviso contextual ao falhar comparacao segura da assinatura

- A comparacao segura da assinatura externa agora registra aviso contextual quando a operacao criptografica falha.
- O contrato continua igual para os chamadores: a autenticacao falha com 401, mas a causa deixa rastro observavel.
- O teste `backend/tests/unit/external-integration-auth.test.ts` cobre a falha da comparacao segura com log de aviso.

## SaaS store com aviso contextual ao falhar leitura do blob legado

- A leitura do estado legado do SaaS agora registra aviso contextual quando o arquivo vem corrompido.
- O contrato continua igual para os chamadores: o store cai para estado vazio, mas a falha deixa rastro observavel.
- O teste `backend/tests/unit/saas-store.test.ts` cobre o blob corrompido com log de aviso.

## AI config com aviso contextual ao falhar estimativa de tokens

- A estimativa de tokens agora registra aviso contextual quando a chamada do provider falha.
- O contrato continua igual para os chamadores: o calculo cai para heuristica local, mas a falha deixa rastro observavel.
- O teste `backend/tests/unit/ai-config-observability.test.ts` cobre a heuristica com log de aviso.

## CORS com aviso contextual ao falhar parse de origem

- O parser de origem do CORS agora registra aviso contextual quando a origem informada e invalida.
- O contrato continua igual para os chamadores: a origem e rejeitada, mas a falha deixa rastro observavel.
- O teste `backend/src/config/cors.test.ts` cobre a origem malformada com log de aviso.

## Runtime guards com aviso contextual ao falhar parse de URL base

- O guard de API e o guard de versao agora registram aviso contextual quando a URL base e invalida.
- O contrato continua igual para os chamadores: a probagem falha de forma controlada, mas a causa deixa rastro observavel.
- O teste `tests/unit/runtime-guards.test.ts` cobre as duas URLs invalidas com log de aviso.

## IdempotentEventStore com aviso contextual ao falhar fallback Redis e parse de registro

- O fallback de gravação Redis agora registra aviso contextual quando as estrategias atômicas falham.
- A listagem de registros processados agora registra aviso contextual quando encontra payload JSON invalido.
- O teste `backend/tests/unit/idempotent-event-store.test.ts` cobre o fallback Redis e o registro invalido com log de aviso.

## API config com aviso contextual ao falhar parse de erro e recuperacao de workspace

- O parse do payload de erro da API agora registra aviso contextual quando o JSON do backend vem invalido.
- A recuperacao de workspace agora registra aviso contextual quando a chamada de fallback falha.
- O teste `tests/unit/observability-client.test.ts` cobre os dois caminhos com log de aviso.

## ExtratoImporter com aviso contextual ao falhar parse de CSV e OFX

- O importador de extratos agora registra aviso contextual quando o parse de CSV ou OFX falha.
- O contrato continua igual para os chamadores: os erros seguem sendo acumulados, mas a falha deixa rastro observavel.
- O teste `src/engines/importacao/extratoImporter.test.ts` cobre o parse de CSV com erro e log de aviso.

## OCRRecibo com aviso contextual ao falhar validacao base64 e processamento OCR

- A validacao do data URI base64 agora registra aviso contextual quando a imagem e invalida.
- O processamento de OCR agora registra aviso contextual quando a rotina falha, em vez de sumir sem rastro.
- O teste `src/engines/importacao/ocrRecibo.test.ts` cobre o data URI invalido e a falha de processamento com log de aviso.

## AdaptiveAIEngine com aviso contextual ao falhar leitura de estatisticas adaptativas

- A leitura das estatisticas adaptativas agora registra aviso contextual quando o snapshot de memoria falha.
- O contrato continua igual para os chamadores: o retorno cai para snapshot vazio, mas a falha deixa rastro observavel.
- O teste `tests/unit/adaptive-ai-engine.test.ts` cobre o fallback vazio com log de aviso.

## BillingHooks com aviso contextual ao falhar persistencia e leitura do storage

- A persistencia dos hooks de billing agora registra aviso contextual quando o JSON do storage vem corrompido.
- A leitura dos hooks de billing agora registra aviso contextual quando o storage falha ao parsear.
- O teste `tests/unit/billing-hooks.test.ts` cobre o storage corrompido na leitura com log de aviso.

## LocalSyncService com aviso contextual ao falhar parse do cache local

- O parse do cache local de goals agora registra aviso contextual quando o JSON vem corrompido.
- O contrato continua igual para os chamadores: o fluxo segue com baseline vazio, mas a falha deixa rastro observavel.
- O teste `tests/unit/localSyncService.test.ts` cobre o cache corrompido na hidratacao com log de aviso.

## API config com aviso contextual ao falhar deteccao de plataforma cliente

- A deteccao da plataforma cliente agora registra aviso contextual quando o check do Capacitor falha.
- O contrato continua igual para os chamadores: o header cai para `web`, mas a falha deixa rastro observavel.
- O teste `tests/unit/observability-client.test.ts` cobre o fallback de plataforma com log de aviso.

## Helpers com aviso contextual ao falhar parse de storage

- O parse de storage agora registra aviso contextual quando encontra JSON corrompido.
- O contrato continua igual para os chamadores: o fallback continua retornando o default, mas a falha deixa rastro observavel.
- O teste `tests/unit/helpers.test.ts` cobre o JSON corrompido com log de aviso.

## Finance route com aviso contextual ao falhar persistencia do evento

- A persistencia do evento financeiro agora registra aviso contextual quando falha e aciona retry.
- O contrato continua igual para os chamadores: o endpoint responde `202 queued`, mas a falha deixa rastro observavel.
- O teste `backend/tests/unit/finance-route.test.ts` cobre o fallback de retry com log de aviso.

## PDFExtrato com aviso contextual ao falhar processamento do PDF

- O processamento do PDF agora registra aviso contextual quando o parser rejeita o arquivo.
- O contrato continua igual para os chamadores: os erros continuam estruturados no retorno, mas a falha deixa rastro observavel.
- O teste `tests/unit/pdf-extrato-date.test.ts` cobre o parser rejeitado com log de aviso.

## TaskStore com aviso contextual ao falhar leitura e gravação do queue storage

- A leitura do queue storage agora registra aviso contextual quando o JSON vem corrompido.
- A gravação do queue storage agora registra aviso contextual quando a persistência falha.
- O teste `tests/unit/ai-storage-resilience.test.ts` cobre o queue storage corrompido com log de aviso.

## ForecastListener com aviso contextual ao falhar recalculo de previsao

- O recalculo de previsao agora registra aviso contextual quando a rotina falha.
- O contrato continua igual para os chamadores: o evento segue sendo processado, mas a causa deixa rastro observavel.
- O teste `tests/unit/forecast-listener.test.ts` cobre o erro de previsao com log de aviso.

## EventEngine com aviso contextual ao falhar listener pipeline

- O pipeline reativo agora registra aviso contextual quando o orquestrador falha.
- O contrato continua igual para os chamadores: os eventos seguem sendo emitidos, mas a causa deixa rastro observavel.
- O teste `tests/unit/event-engine-orchestrator-routing.test.ts` cobre a rejeicao do orquestrador com log de aviso.

## AI Orchestrator com aviso contextual ao falhar aprendizado em background

- O aprendizado em background agora registra aviso contextual por etapa quando falha.
- O contrato continua igual para os chamadores: o pipeline continua e retorna o resultado, mas a causa deixa rastro observavel.
- O teste `tests/unit/ai-orchestrator-observability.test.ts` cobre a falha do aprendizado com log de aviso.

## Predictions API com aviso contextual ao falhar recomputacao de previsao

- As rotas de predictions agora registram aviso contextual quando a recomputacao falha.
- O contrato continua igual para os chamadores: o endpoint responde 500 quando falha, mas a causa deixa rastro observavel.
- O teste `backend/tests/unit/predictions-route-observability.test.ts` cobre o refresh com log de aviso.

## usePredictions com aviso contextual ao falhar fetch inicial e refresh

- O hook de previsoes agora registra aviso contextual quando o fetch inicial falha.
- O refresh de previsao agora registra aviso contextual quando a recomputacao falha.
- O teste `tests/unit/usePredictions.test.tsx` cobre o fetch inicial e o refresh com log de aviso.

## aiCFO com aviso contextual ao falhar leitura de memorias

- O construtor de contexto do CFO agora registra aviso contextual quando a leitura de memorias comportamentais falha.
- O contrato continua igual para os chamadores: o contexto financeiro segue sendo montado, mas sem o enriquecimento comportamental quando o storage falha.
- O teste `tests/unit/ai-cfo-observability.test.ts` cobre a falha de leitura de memorias com log de aviso.

## aiCFO com aviso contextual ao falhar enriquecimento do grafo

- O construtor de contexto do CFO agora registra aviso contextual quando o enriquecimento do grafo falha.
- O contrato continua igual para os chamadores: o contexto financeiro segue sendo montado, mas sem o enriquecimento do grafo quando a fonte falha.
- O teste `tests/unit/ai-cfo-observability.test.ts` cobre a falha do grafo com log de aviso.

## FinancialAutopilot com aviso contextual ao falhar grafo e memorias

- O autopilot financeiro agora registra aviso contextual quando o enriquecimento do grafo falha.
- O autopilot financeiro agora registra aviso contextual quando a leitura de memorias falha.
- O contrato continua igual para os chamadores: as acoes continuam sendo geradas, mas sem os enriquecimentos quando as fontes falham.
- O teste `tests/unit/financial-autopilot-observability.test.ts` cobre o grafo e as memorias com log de aviso.

## InsightGenerator com aviso contextual ao falhar grafo

- O gerador de insights agora registra aviso contextual quando o enriquecimento do grafo falha.
- O contrato continua igual para os chamadores: os insights continuam sendo gerados, mas sem o enriquecimento do grafo quando a fonte falha.
- O teste `tests/unit/insight-generator-observability.test.ts` cobre a falha do grafo com log de aviso.

## AIMemoryStore com aviso contextual ao falhar carga e salvamento

- O armazenamento de memorias agora registra aviso contextual quando a carga falha.
- O armazenamento de memorias agora registra aviso contextual quando o salvamento falha.
- O contrato continua igual para os chamadores: a memoria segue em fallback vazio ou em memoria local, mas a causa deixa rastro observavel.
- O teste `tests/unit/ai-storage-resilience.test.ts` cobre o armazenamento corrompido com log de aviso.

## AIInterpreter com aviso contextual ao falhar texto e imagem

- O interpretador de IA agora registra aviso contextual quando a interpretacao de texto falha.
- O interpretador de IA agora registra aviso contextual quando a interpretacao de imagem falha.
- O contrato continua igual para os chamadores: a entrada segue retornando `unknown`, mas a causa deixa rastro observavel.
- O teste `tests/unit/ai-interpreter.test.ts` cobre os dois caminhos com log de aviso.

## AIWorker com log de erro contextual ao falhar execucao de task

- O worker de IA agora registra erro contextual quando a execucao de uma task falha.
- O contrato continua igual para os chamadores: o retry e a marcacao de status seguem iguais, mas a causa fica observavel.
- O teste `tests/unit/ai-worker.test.ts` cobre a falha de execucao com log de erro contextual.

## AIMemoryEngine com aviso contextual ao falhar persistencia de memoria

- O engine de memoria agora registra aviso contextual quando a persistencia falha durante o aprendizado.
- O contrato continua igual para os chamadores: o aprendizado segue retornando a contagem calculada, mas a causa deixa rastro observavel.
- O teste `tests/unit/ai-memory-engine-observability.test.ts` cobre a falha de persistencia com log de aviso.

## AI provider health checks com erro contextual

- Os health checks dos providers OpenAI e Gemini agora registram a causa real da falha.
- O contrato continua igual para os chamadores: o health check continua retornando `false`, mas a causa fica observavel.
- O teste `backend/tests/unit/ai-provider-health-observability.test.ts` cobre os dois providers com log contextual.

## AI controller com fallback contextual em interpret, insights e CFO

- O controller de IA agora registra contexto minimo quando interpretacao, insights ou CFO falham.
- O contrato continua igual para os chamadores: os fallbacks e erros continuam iguais, mas a triagem fica mais rapida.
- O teste `backend/tests/unit/ai-controller-observability.test.ts` cobre os tres caminhos com log contextual.

## AI service bootstrap com erro contextual ao falhar inicializacao

- A inicializacao do serviço de IA agora registra contexto minimo quando o bootstrap falha.
- O contrato continua igual para os chamadores: a excecao continua subindo, mas a causa fica observavel.
- O teste `backend/tests/unit/ai-service-initialization-observability.test.ts` cobre a falha de bootstrap com log contextual.

## AIServiceFactory com erro contextual ao falhar init de provider

- A factory de IA agora registra contexto minimo quando a inicializacao de provider falha.
- O contrato continua igual para os chamadores: o bootstrap segue pulando o provider quebrado, mas a causa fica observavel.
- O teste `backend/tests/unit/ai-service-factory-observability.test.ts` cobre a falha de init de provider com log contextual.

## AIOrchestrator com erro contextual ao falhar health check de provider

- O orquestrador de IA agora registra contexto minimo quando o health check de provider falha.
- O contrato continua igual para os chamadores: o health check segue retornando `false`, mas a causa fica observavel.
- O teste `backend/tests/unit/ai-orchestrator.test.ts` cobre o health check com throw contextual.

## IntegrationMonitor com erro contextual ao falhar health check de dependencia

- O monitor de integracoes agora registra contexto minimo quando o health check de dependencia falha.
- O contrato continua igual para os chamadores: o health check segue retornando `false`, mas a causa fica observavel.
- O teste `backend/tests/unit/integration-monitor-health-observability.test.ts` cobre o health check com log contextual.

## ExternalIntegrationWrapper com erro contextual ao exaurir retries e circuito aberto

- O wrapper de integracao agora registra contexto minimo quando os retries se esgotam.
- O wrapper de integracao agora registra contexto minimo quando o circuito esta aberto.
- O contrato continua igual para os chamadores: o resultado segue sendo failure/circuitOpen, mas a causa fica observavel.
- O teste `backend/tests/unit/external-integration-wrapper-observability.test.ts` cobre os dois caminhos com log contextual.

## monitorIntegration com erro contextual ao falhar chamada externa

- O wrapper funcional de integracao agora registra contexto minimo quando a chamada externa falha.
- O contrato continua igual para os chamadores: a excecao segue subindo, mas a causa fica observavel.
- O teste `backend/tests/unit/monitor-integration-observability.test.ts` cobre a falha com log contextual.

## IntegrationTelemetry com erro contextual ao falhar executeWithTelemetry

- A telemetria de integracoes agora registra contexto minimo quando a execucao instrumentada falha.
- O contrato continua igual para os chamadores: a excecao segue subindo, mas a causa fica observavel.
- O teste `backend/tests/unit/integration-telemetry-observability.test.ts` cobre a falha com log contextual.

## OAuth do Google com erro contextual ao falhar start e callback

- O controller de OAuth agora registra contexto minimo quando o start falha.
- O controller de OAuth agora registra contexto minimo quando o callback falha.
- O contrato continua igual para os chamadores: os status e AppError seguem os mesmos, mas a causa fica observavel.
- O teste `backend/tests/unit/oauth-controller-observability.test.ts` cobre os dois caminhos com log contextual.

## Postgres state store com erro contextual ao falhar persistencia

- O store Postgres agora registra contexto minimo quando a persistencia do workspace store falha.
- O store Postgres agora registra contexto minimo quando a persistencia do estado SaaS falha.
- O contrato continua igual para os chamadores: o rollback e o throw seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/postgres-state-store-observability.test.ts` cobre os dois caminhos com log contextual.

## Workspace store com erro contextual ao falhar persistencia e backfill

- O workspace store agora registra contexto minimo quando a persistencia normalizada falha.
- O workspace store agora registra contexto minimo quando o backfill para Postgres falha.
- O contrato continua igual para os chamadores: o fluxo de persistencia segue igual, mas a causa fica observavel.
- O teste `backend/tests/unit/workspace-store-observability.test.ts` cobre os dois caminhos com log contextual.

## Domain event store com erro contextual ao falhar carga e persistencia

- O domain event store agora registra contexto minimo quando a carga local falha.
- O domain event store agora registra contexto minimo quando a persistencia local falha.
- O contrato continua igual para os chamadores: o evento segue sendo processado, mas a causa fica observavel.
- O teste `backend/tests/unit/event-store-observability.test.ts` cobre os dois caminhos com log contextual.

## Banking connection store com erro contextual ao falhar init do Firebase

- O banking connection store agora registra contexto minimo quando o Firebase Open Finance store falha ao inicializar.
- O contrato continua igual para os chamadores: o status segue sendo de falha pronta/não pronta, mas a causa fica observavel.
- O teste `backend/tests/unit/banking-connection-store-observability.test.ts` cobre o caminho de init com log contextual.

## Cloud sync store com erro contextual ao falhar init do Firebase

- O cloud sync store agora registra contexto minimo quando o Firebase Cloud Sync store falha ao inicializar.
- O contrato continua igual para os chamadores: o status segue sendo de falha pronta/não pronta, mas a causa fica observavel.
- O teste `backend/tests/unit/cloud-sync-store-observability.test.ts` cobre o caminho de init com log contextual.

## Clinic automation service com erro contextual em webhook e health check

- O clinic automation service agora registra contexto minimo quando o processamento do webhook falha.
- O clinic automation service agora registra contexto minimo quando o health check do Redis falha.
- O contrato continua igual para os chamadores: o processamento continua propagando erro e o health check continua devolvendo boolean, mas a causa fica observavel.
- O teste `backend/tests/unit/clinic-automation-service-contract.test.ts` cobre o caminho de falha do webhook e o health check com log contextual.

## Redis config com erro contextual em retry, cache e health check

- O Redis config agora registra contexto minimo no retry strategy, no client error e nos fallbacks de cache.
- O Redis config agora registra contexto minimo no health check e na inicializacao.
- O contrato continua igual para os chamadores: os fallbacks seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/redis-config-observability.test.ts` cobre retry, cache get, health check e init com log contextual.

## Auth middleware com erro contextual ao falhar extracao de token

- O auth middleware agora registra contexto minimo quando a extracao do token falha.
- O optional auth middleware agora registra contexto minimo quando a extracao do token falha.
- O contrato continua igual para os chamadores: os status continuam iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/auth-middleware-observability.test.ts` cobre os dois caminhos com log contextual.

## Cloud storage com erro contextual em upload, signed URL, delete e exists

- O cloud storage agora registra contexto minimo quando upload falha.
- O cloud storage agora registra contexto minimo quando a geracao de signed URL falha.
- O cloud storage agora registra contexto minimo quando delete falha e quando a checagem de existencia falha.
- O contrato continua igual para os chamadores: os throws e retornos seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/storage-config-observability.test.ts` cobre os caminhos de upload, signed URL, delete e exists com log contextual.

## Bootstrap do backend com erro contextual no cold start serverless e estado persistido

- O bootstrap do backend agora registra contexto minimo quando a inicializacao de persistencia falha no cold start serverless.
- O bootstrap do backend agora registra contexto minimo quando a inicializacao de estado persistido falha.
- O contrato continua igual para os chamadores: o processo continua abortando no erro, mas a causa fica observavel.
- O teste `backend/tests/unit/index-bootstrap-observability.test.ts` cobre o cold start serverless com log contextual.

## Database config com erro contextual em connect, query e health check

- O database config agora registra contexto minimo quando a conexao falha.
- O database config agora registra contexto minimo quando a query falha.
- O database config agora registra contexto minimo quando o health check falha.
- O contrato continua igual para os chamadores: os retornos seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/database-config-observability.test.ts` cobre connect, query e health check com log contextual.

## Gemini config com erro contextual em fallback de modelo e token count

- O Gemini config agora registra contexto minimo quando um modelo fica indisponivel e tenta o proximo candidato.
- O Gemini config agora registra contexto minimo quando o generateContent falha em todos os modelos candidatos.
- O Gemini config agora registra contexto minimo quando o countTokens falha em todos os modelos candidatos.
- O contrato continua igual para os chamadores: os throws seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/gemini-config-observability.test.ts` cobre fallback de modelo e token count com log contextual.

## Auth Firebase com erro contextual na troca de idToken por sessao

- O firebaseSessionController agora registra contexto minimo quando a troca de idToken por sessao falha.
- O contrato continua igual para os chamadores: o fluxo ainda devolve 401, mas a causa fica observavel.
- O teste `backend/tests/unit/auth-controller-firebase-session-observability.test.ts` cobre o retorno 401 com log contextual.

## SaaS store com erro contextual em backup legado e backfill normalizado

- O saasStore agora registra contexto minimo quando o backup legado em Postgres falha.
- O saasStore agora registra contexto minimo quando o backfill normalizado para Postgres falha.
- O contrato continua igual para os chamadores: os fallbacks seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/saas-store.test.ts` cobre backup legado e backfill com log contextual.

## Banking controller com erro contextual em parse de Pluggy e falha de sync

- O bankingController agora registra contexto minimo quando o parse de PLUGGY_BANK_CONNECTORS falha.
- O bankingController agora registra contexto minimo quando o parse de PLUGGY_DEFAULT_CREDENTIALS_JSON falha.
- O bankingController agora registra contexto minimo quando a sincronizacao Pluggy falha.
- O contrato continua igual para os chamadores: os status e respostas seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/banking-controller-observability.test.ts` cobre parse de env e falha de sync com log contextual.

## Auth refresh com erro contextual na rotacao de refresh token

- O refreshController agora registra contexto minimo quando a rotacao de refresh token falha.
- O contrato continua igual para os chamadores: o erro continua sendo propagado, mas a causa fica observavel.
- O teste `backend/tests/unit/auth-controller-refresh-observability.test.ts` cobre a falha de rotacao com log contextual.

## Auth externa com erro contextual em assinatura e chave inválidas

- O externalIntegrationAuth agora registra contexto minimo quando a comparacao segura da assinatura falha.
- O externalIntegrationAuth agora registra contexto minimo quando a chave de integracao e a assinatura sao invalidas.
- O contrato continua igual para os chamadores: os status 401/503 continuam iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/external-integration-auth.test.ts` cobre invalid key e assinatura com log contextual.

## Rate limit com erro contextual em key generator e fallback distribuido

- O rateLimitByUser agora registra contexto minimo quando a key generator falha e cai para IP.
- O distributedRateLimitByUser agora registra contexto minimo quando o Redis falha e cai para o limiter em memoria.
- O contrato continua igual para os chamadores: o limite e os status continuam iguais, mas a causa fica observavel.
- Os testes `backend/tests/unit/rate-limit-by-user.test.ts` e `backend/tests/unit/distributed-rate-limit-by-user.test.ts` cobrem os dois fallbacks com log contextual.

## Error handler com erro contextual para falhas nao previstas

- O errorHandler agora registra contexto minimo quando recebe um erro nao esperado.
- O contrato continua igual para os chamadores: o status 500 e a resposta publica seguem iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/error-handler-observability.test.ts` cobre erro nao previsto e preserva o contrato de AppError.

## Workspace integration key store com erro contextual na comparacao segura

- O workspaceIntegrationKeyStore agora registra contexto minimo quando a comparacao segura de chaves falha.
- O contrato continua igual para os chamadores: a validacao continua retornando false, mas a causa fica observavel.
- O teste `backend/tests/unit/workspace-integration-key-store.test.ts` cobre a falha de comparacao com log contextual.

## Auth decode token com erro contextual no fallback null

- O decodeToken agora registra contexto minimo quando a decodificacao falha.
- O contrato continua igual para os chamadores: o retorno null continua igual, mas a causa fica observavel.
- O teste `backend/tests/unit/auth-decode-token.test.ts` cobre o fallback null com log contextual.

## Workspace integration key store com logger contextual na comparacao segura

- O workspaceIntegrationKeyStore agora registra contexto minimo via logger quando a comparacao segura falha.
- O contrato continua igual para os chamadores: a validacao continua retornando false, mas a causa fica observavel.
- O teste `backend/tests/unit/workspace-integration-key-store.test.ts` cobre a falha de comparacao com log contextual.

## Bootstrap de IA com erro contextual em OpenAI e Gemini

- O bootstrap do backend agora registra contexto minimo quando initOpenAI falha.
- O bootstrap do backend agora registra contexto minimo quando initGemini falha.
- O contrato continua igual para os chamadores: o bootstrap segue marcando o provider como unhealthy, mas a causa fica observavel.
- O teste `backend/tests/unit/index-bootstrap-observability.test.ts` cobre falha de inicializacao de OpenAI e Gemini com log contextual.

## PredictionEngine com erro contextual no cache Redis

- O PredictionEngine agora registra contexto minimo quando a leitura do cache Redis falha.
- O PredictionEngine agora registra contexto minimo quando a escrita do cache Redis falha.
- O contrato continua igual para os chamadores: o fallback para memoria segue igual, mas a causa fica observavel.
- O teste `backend/tests/unit/prediction-engine-observability.test.ts` cobre leitura e escrita de cache com log contextual.

## Admin controller com erro contextual no decode de cursor

- O adminController agora registra contexto minimo quando o cursor de auditoria nao pode ser decodificado.
- O contrato continua igual para os chamadores: a paginação continua retornando os mesmos dados base, mas a causa fica observavel.
- O teste `backend/tests/unit/admin-controller-observability.test.ts` cobre cursor invalido com log contextual.

## SaaS schema com erro contextual em URL malformada e returnUrl invalida

- O saas.schema agora registra contexto minimo quando FRONTEND_URL esta malformada.
- O saas.schema agora registra contexto minimo quando a returnUrl e invalida.
- O contrato continua igual para os chamadores: a validacao continua bloqueando URLs invalidas, mas a causa fica observavel.
- O teste `backend/tests/unit/saas-schema-observability.test.ts` cobre FRONTEND_URL malformada e returnUrl invalida com log contextual.

## Clinic AI enrichment queue com erro contextual no ciclo de processamento

- O ClinicAIEnrichmentQueue agora registra contexto minimo quando o ciclo de processamento falha.
- O contrato continua igual para os chamadores: a fila continua usando retry e Sentry, mas a causa fica observavel.
- O teste `backend/tests/unit/clinic-ai-enrichment-queue-observability.test.ts` cobre falha do ciclo com log contextual.

## Authz com erro contextual em falha inesperada de permissao e feature gate

- O authz agora registra contexto minimo quando ocorre erro inesperado na resolucao de permissao.
- O authz agora registra contexto minimo quando ocorre erro inesperado no feature gate.
- O contrato continua igual para os chamadores: os 403 continuam iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/authz-observability.test.ts` cobre os dois caminhos com log contextual.

## Idempotent event store com erro contextual em parse e fallback Redis

- O IdempotentEventStore agora registra contexto minimo quando o SET atomico Redis falha.
- O IdempotentEventStore agora registra contexto minimo quando o fallback posicional Redis falha.
- O IdempotentEventStore agora registra contexto minimo quando o parse do registro armazenado falha.
- O IdempotentEventStore agora registra contexto minimo quando encontra payload invalido ao listar por origem.
- O contrato continua igual para os chamadores: os retornos de idempotencia continuam iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/idempotent-event-store.test.ts` cobre os caminhos de fallback e parse com log contextual.

## Finance route com erro contextual no flush da fila e persistencia de evento

- A finance route agora registra contexto minimo quando falha ao flushar um evento enfileirado.
- A finance route agora registra contexto minimo quando falha ao persistir um evento financeiro antes do retry.
- O contrato continua igual para os chamadores: o retry e o 202 continuam iguais, mas a causa fica observavel.
- O teste `backend/tests/unit/finance-route.test.ts` cobre o flush da fila e a falha de persistencia com log contextual.

## Event queue com erro contextual no dead-letter

- O eventQueue agora registra contexto minimo quando um evento excede o maximo de retries e vai para dead-letter.
- O contrato continua igual para os chamadores: o snapshot segue indo para dead-letter, mas a causa fica observavel.
- O teste `backend/tests/unit/event-queue.test.ts` cobre o caminho de dead-letter com log contextual.

## Stripe service com erro contextual na assinatura do webhook

- O stripeService agora registra contexto minimo quando o header de assinatura do webhook esta ausente.
- O stripeService agora registra contexto minimo quando o header de assinatura do webhook esta malformado.
- O stripeService agora registra contexto minimo quando a assinatura do webhook nao bate com o payload.
- O contrato continua igual para os chamadores: o retorno booleano continua igual, mas a causa fica observavel.
- O teste `backend/tests/unit/stripe-service.test.ts` cobre assinatura ausente, malformada e divergente com log contextual.

## OpenAI config com erro contextual quando a chave nao esta configurada

- O openai config agora registra contexto minimo quando OPENAI_API_KEY nao esta configurada.
- O contrato continua igual para os chamadores: a inicializacao continua falhando do mesmo jeito, mas a causa fica observavel.
- O teste `backend/tests/unit/openai-config-observability.test.ts` cobre a falha de bootstrap com log contextual.

## Firestore admin com erro contextual no bootstrap e fallback em memoria

- O firestoreAdmin agora registra contexto minimo quando o bootstrap do Firestore falha.
- O contrato continua igual para os chamadores: o fallback em memoria continua igual, mas a causa fica observavel.
- O teste `backend/tests/unit/firestore-admin-observability.test.ts` cobre a falha de bootstrap com log contextual.

## Clinic routes com erro contextual no health da integracao

- O clinicRoutes agora registra contexto minimo quando o health check da integracao clinica falha.
- O contrato continua igual para os chamadores: o 503 continua igual, mas a causa fica observavel.
- O teste `backend/tests/unit/clinic-routes-health-observability.test.ts` cobre o health da integracao com log contextual.

## API client com erro contextual em recovery, parse e platform detection

- O api.config agora registra contexto minimo quando a recuperacao do workspace falha.
- O api.config agora registra contexto minimo quando o parse do payload de erro falha.
- O api.config agora registra contexto minimo quando a deteccao da plataforma do cliente falha.
- O contrato continua igual para os chamadores: retries, fallback e excecoes continuam iguais, mas a causa fica observavel.
- O teste `tests/unit/observability-client.test.ts` cobre recovery, parse e platform fallback com log contextual.

## Encryption service com erro contextual em encrypt, decrypt e fallback plain-json

- O encryption service agora registra contexto minimo quando a criptografia falha.
- O encryption service agora registra contexto minimo quando a decriptografia falha.
- O encryption service agora registra contexto minimo quando o fallback plain-json falha no ambiente de desenvolvimento.
- O contrato continua igual para os chamadores: o fallback de desenvolvimento e o retorno null continuam iguais, mas a causa fica observavel.
- O teste `tests/unit/encryption-service.test.ts` cobre encrypt, decrypt e parse do fallback com log contextual.

## Billing hooks com erro contextual em persistencia, leitura, transport e listener

- O billingHooks agora registra contexto minimo quando encontra registro invalido na leitura e na persistencia.
- O billingHooks agora registra contexto minimo quando o transport falha.
- O billingHooks agora registra contexto minimo quando um listener falha.
- O contrato continua igual para os chamadores: a persistencia local continua nao bloqueante, mas a causa fica observavel.
- O teste `tests/unit/billing-hooks.test.ts` cobre leitura, persistencia, transport e listener com log contextual.

## AI queue listener com erro contextual ao enfileirar tarefa

- O aiQueueListener agora registra contexto minimo quando falha ao enfileirar tarefa a partir de evento financeiro.
- O contrato continua igual para os chamadores: o listener segue nao bloqueante, mas a causa fica observavel.
- O teste `tests/unit/ai-queue-listener.test.ts` cobre a falha de enqueue com log contextual.

## Categorization service com erro contextual no fallback deterministico

- O categorizationService agora registra contexto minimo quando a classificacao remota falha.
- O contrato continua igual para os chamadores: o fallback deterministico continua igual, mas a causa fica observavel.
- O teste `tests/unit/ai/categorizationService.test.ts` cobre o fallback com log contextual.

## Forecast listener com erro contextual ao recalcular previsao

- O forecastListener agora registra contexto minimo quando a previsao falha ao recalcular.
- O contrato continua igual para os chamadores: o listener segue nao bloqueante, mas a causa fica observavel.
- O teste `tests/unit/forecast-listener.test.ts` cobre a falha com log contextual.

## Runtime guards com erro contextual em API e version fallback

- O apiGuard agora registra contexto minimo quando a URL base e invalida, quando a API retorna status nao OK e quando a checagem falha.
- O versionGuard agora registra contexto minimo quando a URL base e invalida, quando o backend retorna status nao OK, quando a versao diverge e quando a checagem falha.
- O contrato continua igual para os chamadores: os resultados de health/version continuam iguais, mas a causa fica observavel.
- O teste `tests/unit/runtime-guards.test.ts` cobre os fallbacks com log contextual.

## Billing client com erro contextual no fallback do catalogo local

- O billingClient agora registra contexto minimo quando cai para catalogo local.
- O contrato continua igual para os chamadores: o fallback mock continua igual, mas a causa fica observavel.
- O teste `tests/unit/billing-client.test.ts` cobre fallback 503 e 404 com log contextual.

## OCR scanner com erro contextual no fallback para texto

- O OCR scanner agora registra contexto minimo quando o Tesseract nao esta disponivel.
- O contrato continua igual para os chamadores: o fallback para texto continua igual, mas a causa fica observavel.
- O teste `tests/unit/receipt-scanner.test.ts` cobre o fallback de OCR com log contextual.

## Event engine com erro contextual em persistencia remota, fetch e pipeline

- O eventEngine agora registra contexto minimo quando a persistencia remota do evento falha.
- O eventEngine agora registra contexto minimo quando o fetch remoto de eventos falha.
- O eventEngine agora registra contexto minimo quando o pipeline de listeners falha.
- O contrato continua igual para os chamadores: o bus de eventos segue nao bloqueante, mas a causa fica observavel.
- O teste `tests/unit/event-engine-orchestrator-routing.test.ts` cobre persistencia, pipeline e routing com log contextual.

## Event engine com erro contextual em falha de subscriber

- O eventEngine agora registra contexto minimo quando um subscriber lanaca excecao.
- O contrato continua igual para os chamadores: o bus de eventos segue nao bloqueante, mas a causa fica observavel.
- O teste `tests/unit/event-engine-orchestrator-routing.test.ts` cobre subscriber com log contextual.

## AI task queue com logs estruturados e cleanup observavel

- A fila de IA agora usa logger estruturado para initialize, ready, shutdown, enqueue e cancel.
- O taskStore agora registra o cleanup de tarefas expiradas com contexto estruturado.
- O contrato continua igual para os chamadores: a fila segue funcionando do mesmo jeito, mas a telemetria deixa de depender de console solto.
- Os testes `tests/unit/ai-task-queue-observability.test.ts`, `tests/unit/task-store-cleanup-observability.test.ts` e `tests/unit/ai-storage-resilience.test.ts` cobrem inicializacao, enqueue, cancelamento e cleanup.

## AI worker e memory engine com telemetria estruturada

- O AIWorker agora usa logger estruturado para iniciar, parar, processar tarefas, repetir tarefas e registrar already-running.
- O AIMemoryEngine agora registra contexto minimo quando ha poucas transacoes para aprender e quando a atualizacao de memorias conclui.
- O contrato continua igual para os chamadores: a fila e o aprendizado seguem funcionando do mesmo jeito, mas a telemetria deixa de depender de console solto.
- Os testes `tests/unit/ai-worker.test.ts` e `tests/unit/ai-memory-engine-observability.test.ts` cobrem lifecycle, retry, few-transactions e update success/failure.

## Runtime guard e Sentry com bootstrap estruturado

- O runtimeGuard agora usa logger estruturado para bootstrap, already-initialized, checks criticos e checks periodicos.
- O Sentry bootstrap agora usa logger estruturado quando o modulo falha ao carregar e quando inicializa com sucesso.
- O contrato continua igual para os chamadores: os guards seguem entregando os mesmos resultados, mas a telemetria deixa de depender de console solto.
- Os testes `tests/unit/runtime-guard-observability.test.ts` e `tests/unit/sentry-config-observability.test.ts` cobrem bootstrap, critical UI e init de Sentry.

## Metrics e backend Sentry com telemetria estruturada

- O metrics helper agora usa logger estruturado para record e increment.
- O backend Sentry agora usa o logger local do backend para registrar a inicializacao.
- O contrato continua igual para os chamadores: os utilitarios seguem funcionando do mesmo jeito, mas a telemetria deixa de depender de console solto.
- Os testes `tests/unit/metrics-observability.test.ts` e `backend/tests/unit/sentry-config-observability.test.ts` cobrem record/increment e init do backend Sentry.

## READMEs de runtime, queue e memory alinhados com a telemetria nova

- Os READMEs de runtime, queue e memory foram limpos para remover exemplos com `console.*`.
- Os exemplos agora apontam para a telemetria estruturada ou descrevem a exibicao de UI sem reforcar logs soltos.
- O contrato continua igual para os chamadores: a documentacao ficou mais coerente com a implementacao atual.

## Audit log e AIMemoryStore com telemetria estruturada

- O auditLogService agora usa logger estruturado em vez de `console.log`.
- O AIMemoryStore agora usa logger estruturado para o ciclo de decay.
- O contrato continua igual para os chamadores: auditoria e memoria seguem funcionando do mesmo jeito, mas a telemetria deixa de depender de console solto.
- Os testes `tests/unit/audit-log-service-observability.test.ts` e `tests/unit/ai-memory-store-observability.test.ts` cobrem auditoria e decay com log contextual.

## API client, previsoes, sessao e bank sync com logger estruturado

- `src/config/api.config.ts` e `src/hooks/usePredictions.ts` trocaram `console.warn` e `console.error` por logger estruturado nos fallbacks de recuperacao de workspace, deteccao de plataforma, parse de payload, retry e chamadas de previsao.
- `src/services/backendSession.ts` agora registra falhas de parse e JSON invalido na troca Firebase com contexto estruturado.
- `src/finance/bankSyncEngine.ts` agora registra falhas do sync unico e da persistencia do relatorio com contexto estruturado.
- Os testes `tests/unit/observability-client.test.ts`, `tests/unit/usePredictions.test.tsx`, `tests/unit/backend-session.test.ts` e `tests/unit/bank-sync-engine.test.ts` cobrem os caminhos observados.

## AI memory, debug, import, runtime, sync e encryption com logger estruturado

- `src/ai/aiMemory.ts` e `src/ai/aiDebugService.ts` agora registram falhas de parse do localStorage com logger estruturado e fallback explícito.
- `src/finance/importService.ts` agora registra falhas de PDF, classificacao por IA, inspeção de cabecalho e erro de aprendizado de memória com logger estruturado.
- `src/runtime/apiGuard.ts`, `src/runtime/versionGuard.ts`, `src/services/localSyncService.ts` e `src/services/security/encryptionService.ts` trocaram os ultimos `console.*` por logger estruturado nos fallbacks e validacoes de runtime.
- Os testes `tests/unit/ai-storage-resilience.test.ts`, `tests/unit/import-service.test.ts`, `tests/unit/localSyncService.test.ts`, `tests/unit/runtime-guards.test.ts` e `tests/unit/encryption-service.test.ts` cobrem os fluxos atualizados.

## Scripts operacionais do backend sem console solto

- `backend/healthcheck.js` e os scripts `backend/scripts/*.ts` passaram a escrever direto em stdout/stderr, removendo `console.log`, `console.warn` e `console.error` do caminho operacional.
- O comportamento funcional dos scripts permaneceu igual: saída estruturada em sucesso e falha com código de saída preservado.

## Helpers de e2e e scripts operacionais sem console solto

- `tests/e2e/helpers/skipHelpers.ts` passou a escrever os avisos forçados em stdout, sem usar `console.warn`.
- `backend/healthcheck.js` e os scripts operacionais de cutover/migrations continuam escrevendo em stdout/stderr, sem console solto no caminho operacional.
- O contrato funcional permaneceu igual: apenas a forma de emitir mensagens mudou.

## Helper de e2e com avisos em stdout

- `tests/e2e/helpers/skipHelpers.ts` deixou de usar `console.warn` e passou a escrever os avisos forçados em stdout.
- A cobertura entrou em `tests/unit/e2e-skip-helpers.test.ts` para garantir que o contrato continua observável sem console solto.

## Auth com fallback visivel e logger estruturado

- `hooks/useAuthAndWorkspace.ts` agora registra falhas de bootstrap do token backend, falhas de refresh do workspace, falhas de hidratacao do workspace no login local e falhas na hidratacao de metas da nuvem com `logWarn` estruturado.
- O login local segue funcionando, mas a sync backend cai explicitamente quando a hidratacao do workspace falha.
- A cobertura foi ampliada em `tests/unit/useAuthAndWorkspace.test.tsx` para validar os dois fallbacks novos e preservar o fluxo principal.

## IA com diagnostico visivel e logger estruturado

- `components/AIInput.tsx` agora registra `logWarn` quando o fluxo single-draft ignora transacoes extras e quando o processamento da IA falha.
- `pages/AIControlPanel.tsx` agora registra `logWarn` quando a memoria da IA falha ao carregar.
- A cobertura foi ampliada em `tests/unit/ai-input.test.tsx` e `tests/unit/ai-control-panel-memory-error.test.tsx` para validar os fallbacks sem regressao de UI.

## Billing com logger estruturado e diagnostico visivel

- `pages/WorkspaceAdmin.tsx` agora registra `logWarn` nas falhas de carregamento, troca de workspace, atualizacao de plano, checkout, portal e gestao de membros.
- `components/Settings.tsx` agora registra `logWarn` nas falhas de metadados de chave de integracao, copia de clipboard, carregamento de billing, suporte IA e vinculo social.
- A cobertura foi ampliada em `tests/unit/workspace-admin-page.test.tsx` e `tests/unit/settings-workspace-admin.test.tsx` para validar os fallbacks de billing e integracao sem regressao de UI.
- O helper silencioso e nao usado de metadados de chave foi removido para evitar fallback morto no caminho de settings.

## CFO com fallback visivel e logger estruturado

- `src/ai/aiCFO.ts` agora registra `logWarn` quando a resposta do CFO vem vazia e quando a geracao falha de forma excecao, mantendo o diagnostico visivel para o usuario.
- A cobertura foi ampliada em `tests/unit/ai-cfo-observability.test.ts` para validar tanto o fallback de resposta vazia quanto a falha real de geracao.

## Parser Lab da IA com logger estruturado

- `pages/AIControlPanel.tsx` agora registra `logWarn` quando o Parser Lab falha ao processar OFX/CSV, carregando formato, tamanho da entrada e fallback.
- A cobertura foi ampliada em `tests/unit/ai-control-panel-parser-lab-ui.test.tsx` para validar o log contextual no caminho de erro sem regressao da UI do parser.

## Billing hooks com persistencia observavel

- `src/saas/billingHooks.ts` agora registra `logWarn` com fallback explicito quando a persistencia local falha e quando a leitura armazenada falha por erro de storage.
- A cobertura foi ampliada em `tests/unit/billing-hooks.test.ts` para validar a falha de persistencia por quota/storage e o fallback de leitura corrompida sem regredir o contrato non-blocking.

## Stripe webhook com mismatch observavel

- `backend/src/services/saas/stripeService.ts` agora registra `logger.warn` quando a assinatura do webhook tem o mesmo tamanho, mas o conteudo nao bate, alem dos casos de header ausente e malformado.
- A cobertura foi ampliada em `backend/tests/unit/stripe-service.test.ts` para validar o mismatch de assinatura de mesmo tamanho sem regressao no contrato de `false`.

## AIInput com log estrutural no erro de imagem

- `components/AIInput.tsx` agora registra `logWarn` quando a leitura de imagem falha no caminho de OCR/interpretacao, mantendo o diagnostic visivel.
- A cobertura em `tests/unit/ai-input.test.tsx` segue validando o fallback de imagem com o log contextual novo e sem regressao de UI.

## Settings com log estrutural na chave de integracao

- `components/Settings.tsx` agora registra `logWarn` quando a geracao da chave de integracao falha e quando a revogacao da chave falha, mantendo o diagnostico visivel na UI.
- A cobertura foi ampliada em `tests/unit/settings-workspace-admin.test.tsx` para validar os dois fallbacks novos sem regressao dos fluxos de billing e suporte.

## useFinancialState com log estrutural em aprendizado e conta padrao

- `hooks/useFinancialState.ts` agora registra `logWarn` quando o aprendizado adaptativo falha e quando a criacao da conta padrao do workspace falha, sem bloquear o fluxo financeiro.
- A cobertura foi ampliada em `tests/unit/useFinancialState.test.tsx` para validar os dois fallbacks novos sem regressao do estado financeiro principal.

## AICFO, Assistant e Autopilot com logger estruturado

- `pages/AICFO.tsx` agora registra `logWarn` quando o aprendizado a partir da conversa falha em segundo plano.
- `pages/AICFO.tsx` agora registra `logWarn` quando a geracao da resposta do CFO falha e cai no fallback textual.
- `components/Assistant.tsx` agora registra `logWarn` quando a geracao de alertas inteligentes falha.
- `pages/Autopilot.tsx` agora registra `logWarn` quando o aprendizado de padroes do Autopilot falha.
- A cobertura foi ampliada em `tests/unit/aicfo-plan-render.test.tsx`, `tests/unit/assistant-smart-alerts-fallback.test.tsx` e `tests/unit/autopilot-refresh.test.tsx` para validar os fallbacks novos sem regressao de UI.

## Open Banking com logger estruturado

- `pages/OpenBanking.tsx` agora registra `logWarn` quando o Pluggy status, os conectores, o token, a conexao, a desconexao, o sync e o callback de sucesso falham.
- A cobertura foi ampliada em `tests/unit/open-banking-page.test.tsx` para validar os fallbacks novos sem regressao do fluxo de conexao bancária.

## useSyncEngine com logger estruturado

- `hooks/useSyncEngine.ts` agora registra `logWarn` quando a carga inicial das entidades falha, quando o Firestore retorna erro de permissao ou conexao, quando a sincronizacao do perfil falha e quando a sincronizacao de entidades falha.
- A cobertura foi ampliada em `tests/unit/useSyncEngine.test.tsx` para validar os fallbacks novos sem regressao da sincronizacao principal.

## Accounts com logger estruturado

- `pages/Accounts.tsx` agora registra `logWarn` quando a criacao de conta falha, mantendo o diagnostico visivel na UI.
- A cobertura foi ampliada em `tests/unit/accounts-form.test.tsx` para validar o fallback novo sem regressao do fluxo de cadastro de contas.

## CashFlow com logger estruturado e fallback visivel

- `components/CashFlow.tsx` agora registra `logWarn` quando o relatorio estrategico salvo nao pode ser parseado, quando a geracao do relatorio falha e quando a copia do resumo falha.
- A cobertura foi ampliada em `tests/unit/cashflow-clarity.test.tsx` e `tests/unit/cashflow-clipboard-diagnostic.test.tsx` para validar os fallbacks novos sem regressao de UI.

## TransactionList e WorkspaceAudit com logger estruturado

- `components/TransactionList.tsx` agora registra `logWarn` quando a sugestao de categoria falha, quando o aprendizado auxiliar falha e quando a copia do historico falha.
- `pages/WorkspaceAudit.tsx` agora registra `logWarn` quando a carga da auditoria falha e quando a pagina "load more" falha.
- A cobertura foi ampliada em `tests/unit/transaction-list-suggestion-diagnostic.test.tsx`, `tests/unit/transaction-list-category-learning-diagnostic.test.tsx`, `tests/unit/transaction-list-clipboard-diagnostic.test.tsx` e `tests/unit/workspace-audit-page.test.tsx` para validar os fallbacks novos sem regressao de UI.

## ImportTransactions e NavigationTabs com logger estruturado

- `pages/ImportTransactions.tsx` agora registra `logWarn` quando o aprendizado auxiliar de categoria falha durante a importacao, mantendo o fluxo de importacao ativo.
- `hooks/useNavigationTabs.tsx` agora registra `logWarn` quando um modulo lazy falha ao carregar ou falha apos retry.
- A cobertura foi ampliada em `tests/unit/import-transactions-session.test.tsx` e a validacao foi mantida via `tests/unit/openbanking-render-guard.test.tsx` para garantir que o fluxo de navegacao continua sem regressao de UI.

## Infra de observabilidade com logger estruturado

- `src/config/api.config.ts` agora registra `logWarn` em tentativas de retry de requisicao e `logError` quando a requisicao esgota as tentativas, sem mudar o contrato de erro.
- `src/runtime/versionGuard.ts` agora registra `logWarn` para falhas de versao e `logInfo` quando a versao bate ou o reload e pulado em benchmark.
- `src/config/sentry.ts` agora registra `logWarn` quando o modulo Sentry falha ao carregar e `logInfo` quando a inicializacao conclui.
- `hooks/usePerformanceMonitoring.ts` agora registra `logWarn` quando a API de performance nao existe ou quando o observer falha ao iniciar.
- A cobertura foi validada em `tests/unit/observability-client.test.ts`, `tests/unit/runtime-guards.test.ts`, `tests/unit/sentry-config-observability.test.ts` e `tests/unit/sentry-config-client.test.ts`, com `type-check:app` verde.

## Assistant e OpenBanking com logger estruturado

- `components/Assistant.tsx` agora registra `logWarn` quando a geracao de alertas inteligentes falha.
- `pages/OpenBanking.tsx` agora registra `logWarn` quando o reload das conexoes bancarias falha.
- A cobertura continua validada em `tests/unit/assistant-smart-alerts-fallback.test.tsx` e `tests/unit/open-banking-page.test.tsx` sem regressao de UI.

## Performance monitoring com logger estruturado

- `hooks/usePerformanceMonitoring.ts` agora registra `logWarn` quando a API de performance nao existe ou quando o observer falha ao iniciar.
- A cobertura foi ampliada em `tests/unit/usePerformanceMonitoring.test.tsx` para validar os dois fallbacks sem regressao do hook.

## Goals com logger estruturado e diagnostico de persistencia

- `pages/Goals.tsx` agora registra `logWarn` quando a criacao de meta falha e quando o aporte falha, mantendo o diagnostico visivel na UI.
- A cobertura foi ampliada em `tests/unit/goals-page.test.tsx` e `tests/unit/goals-contribution.test.tsx` para validar os dois fallbacks novos sem regressao do fluxo de metas.

## Wrappers legados de IA/Open Banking e Firebase com logger estruturado

- `services/geminiService.ts` agora registra `logWarn` e `logError` nos fallbacks legados de interpretacao, imagem, insights, classificacao, token count, consultoria e CFO.
- `services/integrations/openBankingService.ts` agora registra `logWarn` e `logError` quando a operacao de Open Banking falha, quando o reload retorna para o cache local, quando o aprendizado de memoria falha e quando a classificacao por IA cai para mapeamento basico.
- `services/integrations/openBankingState.ts` agora registra `logWarn` quando o cache local de conexoes nao pode ser decodificado.
- `services/firebase.ts` agora registra `logWarn` quando o Firebase web nao esta configurado.
- A cobertura foi ampliada em `tests/unit/gemini-service-fallback.test.ts`, `tests/unit/open-banking-service-critical-branches.test.ts`, `tests/unit/open-banking-state-observability.test.ts` e `tests/unit/firebase-config-observability.test.ts` para validar os fallbacks novos sem regressao dos wrappers legados.

## Bootstrap da aplicacao com logger estruturado

- `index.tsx` agora registra `logInfo`, `logWarn` e `logError` no cleanup de service worker, na inicializacao da runtime guard, na fila de IA, no pipeline financeiro, no registro de listeners, no banner de versao, no aviso de nova versao e no erro fatal de bootstrap.
- `App.tsx` agora registra `logError` quando o error boundary captura uma falha.
- A cobertura foi ampliada em `tests/unit/index-bootstrap-observability.test.tsx` e `tests/unit/app-bootstrap-observability.test.tsx` para validar os fallbacks novos sem regressao do bootstrap e do boundary.

## Listeners e HTML bootstrap com rastreio local

- `src/events/listeners/registerListeners.ts` agora registra `logInfo` quando os listeners sao montados e desmontados.
- `src/events/listeners/autopilotListener.ts` agora registra `logInfo` quando o Autopilot gera alertas via evento.
- `index.html` agora grava o bootstrap do service worker em `window.__FLOW_BOOTSTRAP_LOGS__` em vez de usar `console.*` inline.

## Scripts operacionais com stdout/stderr direto

- `scripts/verify-vercel-observability.mjs`, `scripts/check-local-auth-readiness.mjs` e `scripts/validate-cfo-route.mjs` agora usam `stdout`/`stderr` direto em vez de `console.*`.
- A validacao dos scripts foi mantida sem regressao no bootstrap e na suite focada de observabilidade da aplicacao.

## Service worker com rastreio local

- `public/sw.js` agora grava o bootstrap, o skip waiting, o install, o pre-cache e o sync em `self.__FLOW_SW_LOGS__` em vez de usar `console.*`.
- O contrato de cache e de fetch do service worker permaneceu o mesmo.

## QA spec silencioso

- `qa-exhaustive.spec.mjs` foi limpo para não emitir `console.*` durante a execucao do spec, preservando a validacao visual e de integracao sem ruído de log.

## Scripts de manutencao com stdout/stderr direto

- `setup.js`, `scripts/activate-sentry.mjs`, `scripts/sync-obsidian-vault.mjs` e `scripts/generate-obsidian-summaries.mjs` agora escrevem em `stdout`/`stderr` direto.
- `scripts/scan-secrets.mjs`, `scripts/reset-database.mjs`, `scripts/run-firestore-rules.mjs`, `scripts/update-readme.js` e `scripts/beta-testing-coordinator.mjs` continuam sendo scripts operacionais de manutencao e permanecem fora do fluxo principal de produto.

## Autopilot com budget inteligente e teste legado alinhado ao logger

- `src/ai/financialAutopilot.ts` agora usa o `budgetEngine` como baseline de orcamento por categoria em vez do placeholder vazio, reduzindo a dependencia de heuristica muda.
- `tests/unit/graph-fallback-warnings.test.ts` foi alinhado ao logger estruturado para validar os fallbacks de grafo em vez de espionar `console.warn`.
- `tests/unit/financial-autopilot-date-safety.test.ts` ganhou um caso explicito para categoria excessiva sem historico, provando que o budget inteligente continua visivel.
- `tests/unit/import-transactions-session.test.tsx` removeu o spy morto de `console.error` no caminho de importacao atrasada apos unmount.

## Event engine com leaks e report expostos ao consumidor do listener

- `src/events/eventEngine.ts` agora encaminha leaks e report gerados pelo pipeline para callbacks opcionais de UI, sem bloquear o fluxo principal.
- `tests/unit/event-engine-orchestrator-routing.test.ts` passou a validar que o listener encaminha insights, riscos, acoes, leaks e report quando o orquestrador conclui.

## Financial state com snapshots de leaks e report

- `hooks/useFinancialState.ts` agora captura os snapshots de leaks e report emitidos pelo event engine e os mantém disponiveis para a UI.
- `pages/AIControlPanel.tsx` passou a consumir os snapshots vindos do estado financeiro, com fallback seguro para o calculo local quando o snapshot ainda nao existe.
- `hooks/useNavigationTabs.tsx` e `App.tsx` foram alinhados para transportar esses snapshots ate o painel de IA sem mudar o comportamento dos outros tabs.
- `tests/unit/useFinancialState.test.tsx` ganhou cobertura para o encaminhamento dos snapshots de leaks e report.
- `tests/unit/ai-control-panel-snapshots.test.tsx` ganhou cobertura para a renderizacao dos snapshots no painel de IA.

## Admin panel com fachada util

- `backend/src/admin/adminPanel.ts` deixou de ser um stub e passou a expor consultas basicas de workspace, tenant, usuarios e auditoria.
- `backend/src/admin/adminPanel.test.ts` foi atualizado para validar a fachada de administracao sem depender do estado real do banco ou do cache.

## Clinic AI enrichment com heuristica local observavel

- `backend/src/services/clinic/ClinicAIEnrichmentQueue.ts` saiu do no-op e passou a gerar um snapshot heuristico local quando a IA externa nao esta disponivel.
- `backend/tests/unit/clinic-ai-enrichment-queue-observability.test.ts` passou a validar o fallback heuristico e o snapshot rastreavel por task.

## Auth register com contrato explicito

- `backend/src/auth/authService.ts` passou a tratar `register` como um no-op controlado fora de producao e como erro explicito em producao.
- `backend/src/auth/authService.test.ts` passou a cobrir o aviso estruturado do no-op e a excecao de producao.

## External integration com erro contextual de persistencia

- `backend/src/services/externalIntegrationService.ts` agora registra contexto util quando a persistencia da integracao externa falha antes do marcador de idempotencia.
- `backend/tests/unit/external-integration-reminders.test.ts` passou a validar o log de erro contextual e a preservacao do contrato de falha.

## Business integration com erro contextual de persistencia

- `backend/src/services/businessIntegrationService.ts` agora registra contexto util quando a persistencia de transacao ou lembrete falha antes do registro de auditoria.
- `backend/tests/unit/business-integration-service.test.ts` passou a cobrir a falha de persistencia com log contextual e sem auditoria parcial.

## Open Finance com chave scoped malformada observavel

- `backend/src/controllers/bankingController.ts` agora registra contexto quando a chave scoped de armazenamento vem malformada ao listar conexoes Open Finance.
- `backend/tests/unit/banking-controller-observability.test.ts` passou a cobrir o warning de parse malformado e a saida funcional continua inalterada.

## Dashboard com saldo negativo em destaque

- `components/Dashboard.tsx` agora destaca saldo negativo como prioridade de foco quando nao ha pressao maior por recebiveis.
- `tests/unit/dashboard-metrics.test.ts` passou a cobrir o foco de saldo negativo no dashboard.

## Dashboard com foco em receita prevista

- `components/Dashboard.tsx` trocou a acao secundaria menos util por uma chamada para receitas previstas, alinhando a primeira tela ao nucleo do produto.
- `tests/unit/dashboard-quick-actions.test.tsx` passou a cobrir a nova acao de previsao de receita no dashboard.

## Dashboard com navegação enxuta

- `components/Dashboard.tsx` removeu o atalho morto para contas da superficie principal.
- `hooks/useNavigationTabs.tsx` deixou de injetar essa acao no dashboard, reduzindo ruído de navegação na primeira tela.

## Dashboard com receita prevista em primeira classe

- `components/Dashboard.tsx` passou a expor receita prevista como card principal, ao lado de entradas, saidas e saldo do mes.
- `tests/unit/dashboard-quick-actions.test.tsx` passou a cobrir a visibilidade dessa leitura no dashboard.

## Dashboard com tipografia mais contida

- `components/Dashboard.tsx` reduziu o peso visual de labels operacionais para melhorar legibilidade e reduzir agressividade visual.

## Lista de transacoes com filtro por estado

- `components/TransactionList.tsx` passou a expor filtro rapido por estado financeiro para acelerar revisao de itens confirmados, pendentes e vencidos.
- `tests/unit/transaction-list-states.test.tsx` passou a cobrir o filtro por estado e o contrato de decisao rapida.

## Tela de receitas com linguagem mais operacional

- `components/CashFlow.tsx` ajustou microcopy do fluxo para enfatizar realizado, previsto, pendente e vencido de forma mais direta.
- `tests/unit/cashflow-clarity.test.tsx` foi atualizado para cobrir a leitura operacional da tela de receitas.

## Tela de insights com linguagem orientada a decisao

- `pages/Insights.tsx` trocou os titulos genericos por linguagem mais operacional, destacando caixa, riscos e contexto avancado.
- `tests/unit/insights-plan-render.test.tsx` foi atualizado para cobrir a nova copy da tela de insights.

## Insights com proxima acao visivel

- `pages/Insights.tsx` ganhou uma chamada de proxima acao baseada em horizonte de caixa e saude financeira para transformar leitura em decisao.
- `tests/unit/insights-plan-render.test.tsx` passou a cobrir a nova chamada de acao dentro do resumo de caixa.

## Assistente com copy mais operacional

- `src/app/assistantCopy.ts` trocou labels genericos por termos de caixa e rotina diaria.
- `components/Assistant.tsx` alinhou seções de metas, limites e modal de alertas para a linguagem operacional do produto.
- `tests/unit/assistant-copy.test.ts` passou a cobrir a nova microcopy do assistente.

## CFO com prompts e copy mais operacionais

- `src/app/assistantCopy.ts` ajustou a copy do CFO para linguagem de caixa, risco e proximos movimentos.
- `pages/AICFO.tsx` trocou prompts genericos por perguntas mais operacionais e tornou a base do contexto mais explicita.
- `tests/unit/aicfo-plan-render.test.tsx` passou a cobrir a nova copy e os prompts do CFO.

## Caixa e contas com linguagem operacional

- `pages/Accounts.tsx` trocou a linguagem de cadastro bancario por caixa consolidado e conta de caixa.
- `tests/unit/accounts-form.test.tsx` passou a cobrir os novos rotulos e a acao principal da tela de contas.

## Settings com linguagem de operacao do workspace

- `components/Settings.tsx` trocou a linguagem genérica de ajustes por operacao do workspace, acesso e faturamento.
- `tests/unit/settings-workspace-admin.test.tsx` passou a cobrir os novos rotulos de suporte, vinculo social e guia com IA.

## Workspace admin com operacao explicita

- `pages/WorkspaceAdmin.tsx` trocou a linguagem de administracao por operacao do workspace, faturamento e prontidao.
- `tests/unit/workspace-admin-page.test.tsx` passou a cobrir os novos rotulos de faturamento, membros e auditoria do workspace.

## Importacao com linguagem de caixa

- `src/app/secondaryFlowsCopy.ts` trocou a rotulagem de importacao para a linguagem de caixa.
- `pages/ImportTransactions.tsx` passou a falar em movimentos, entradas e saidas na revisao de arquivo.
- `tests/unit/import-transactions-session.test.tsx` foi validado novamente com a nova copy da importacao.

## Scanner com linguagem de caixa

- `src/app/secondaryFlowsCopy.ts` trocou a rotulagem do scanner para a linguagem de caixa.
- `pages/ReceiptScanner.tsx` passou a falar em ler para o caixa e em movimento confirmado.
- `tests/unit/receipt-scanner-draft-path.test.tsx` passou a cobrir o novo CTA do scanner.

## Auditoria do workspace com linguagem operacional

- `pages/WorkspaceAudit.tsx` passou a falar em auditoria do workspace, com filtros e navegação em linguagem operacional.
- `tests/unit/workspace-audit-page.test.tsx` foi atualizado para cobrir os novos rotulos, o estado restrito e o resumo carregado.

## Navegacao principal com nomes mais consistentes

- `src/app/mainNavigation.ts` ajustou a aba de transacoes para usar `Transações`, alinhando a barra principal ao restante da interface.
- `pages/WorkspaceAdmin.tsx` trocou o titulo do topo para `Operacao do workspace`, mantendo a linguagem operacional do produto.

## Lista de transacoes com tipografia menos agressiva

- `components/TransactionList.tsx` reduziu a presenca de microtipografia e pesos extremos em filtros, leitura rapida, ações em massa e modais de compartilhamento/edição.

## Tela de receitas com tipografia mais contida

- `components/CashFlow.tsx` reduziu a densidade tipografica na faixa superior, cards de estado, seletor de período, modais de exportação e bloco de diagnóstico.
