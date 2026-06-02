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

## Open Banking Observability

- `disconnectBank` agora registra falhas do backend/provider com diagnostico estruturado antes de remover a conexao local.
- `fullSync` agora registra falha parcial de contas sem interromper a etapa de transacoes, mantendo o fluxo tolerante existente.
- A tela de Open Banking agora mostra diagnostico visivel quando health, conectores ou token Pluggy falham ao carregar.
- O bloco de carregamento do Pluggy agora expõe um botao de retry visivel para reabrir o fluxo sem recarregar a pagina inteira.
- A recarga de conexoes bancarias agora mostra diagnostico visivel quando falha, em vez de deixar a tela sem explicacao.
- A recarga de conexoes bancarias agora tambem oferece retry visivel no proprio alerta, mantendo o fluxo no mesmo contexto.
- O alerta de recarga tambem reaproveita o hint de recuperacao do provider, em vez de deixar o usuario sem contexto quando o backend esta em mock.
- Entrar no fluxo de conectar banco agora limpa erro de recarga anterior, para nao carregar um alerta velho entre telas.
- Acoes individuais de sync/desconexao agora mostram erro visivel quando rejeitam inesperadamente, e o botao de desconectar ganhou nome acessivel.
- Sync em lote agora mostra erro visivel quando todas as conexoes listadas estao em erro.
- Evidencia: `services/integrations/openBankingService.ts`, `pages/OpenBanking.tsx`, `tests/unit/open-banking-service-critical-branches.test.ts` e `tests/unit/open-banking-page.test.tsx`.

## Limite desta sessão

- O `importService.ts` foi rechecado em UTF-8 e o aparente mojibake era apenas renderização do terminal; não ficou limpeza de fonte aberta neste eixo.
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
- `src/engines/importacao/pdfExtrato.ts` foi reescrito em UTF-8 limpo e voltou a compilar com `pdf-parse` via import dinâmico, eliminando o ultimo erro de `type-check`.
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

- A navegacao principal agora fala `Início`, `Transações`, `Fluxo`, `IA consultiva` e `Configurações`.
- `Settings` passou a abrir com linguagem operacional e rótulos de seção mais claros.
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
- O teste 	ests/unit/ai-cfo-debug-log.test.ts cobre a gravação do log local.


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

## Settings com densidade tipografica reduzida

- `components/Settings.tsx` suavizou a tipografia nos blocos de perfil, resumo do workspace, integrações e suporte operacional.

## AICFO com densidade tipografica reduzida

- `pages/AICFO.tsx` reduziu a agressividade tipografica nos baloes, diagnosticos, estado de carregamento, tela de boas-vindas, snapshot financeiro, modo Free, badges de contexto e atalhos rápidos.

## Autopilot com densidade tipografica reduzida

- `pages/Autopilot.tsx` reduziu a densidade tipografica nos cards, badges, cabecalho, estado vazio, aprendizado em segundo plano e aviso de seguranca.

## WorkspaceAdmin com densidade tipografica reduzida

- `pages/WorkspaceAdmin.tsx` suavizou a tipografia nos estados de carregamento, leitura, faturamento, membros, auditoria e prontidão do workspace.

## ReceiptScanner com densidade tipografica reduzida

- `pages/ReceiptScanner.tsx` reduziu a agressividade tipografica nos estados idle, preview, scanning, review, done, error e dicas finais.

## AdvancedAnalytics com densidade tipografica reduzida

- `components/AdvancedAnalytics.tsx` suavizou a tipografia dos titulos, resumo do workspace, badges dos graficos e tabela comparativa mensal.

## Assistant com densidade tipografica reduzida

- `components/Assistant.tsx` reduziu a densidade tipografica nos atalhos, timeline financeira, metas, limites, formulários e modais de confirmação.

## AIInput com densidade tipografica reduzida

- `components/AIInput.tsx` reduziu a densidade tipografica nos estados de revisão, diagnóstico, seletores de conta, modo AI/manual, entradas e confirmações.

## WorkspaceAudit com densidade tipografica reduzida

- `pages/WorkspaceAudit.tsx` reduziu a densidade tipografica nos estados de acesso, filtros, carregamento, erro, lista de eventos e resumo da auditoria.

## Dashboard com densidade tipografica reduzida

- `components/Dashboard.tsx` suavizou a tipografia da leitura rapida, saldos, alertas e chamadas principais do painel.

## Insights com densidade tipografica reduzida

- `pages/Insights.tsx` reduziu a densidade tipografica nas leituras, badges, resumo de saude do caixa, contexto avancado, sinais e riscos do caixa.

## OpenBanking com densidade tipografica reduzida

- `pages/OpenBanking.tsx` reduziu a densidade tipografica nos estados de conexão, ações, erros, métricas, conectores e rodapé operacional.
## Sweep de densidade tipografica em fluxo principal e auth
- Reduzi hierarquia visual em `components/LegalModal.tsx`, `pages/ImportTransactions.tsx`, `components/CashFlow.tsx`, `hooks/useNavigationTabs.tsx`, `components/UpgradePromptCard.tsx`, `components/NamePromptModal.tsx`, `components/Logo.tsx`, `src/components/ErrorBoundary.tsx`, `pages/AIControlPanel.tsx`, `components/Login.tsx`, `components/Settings.tsx`, `components/PerformanceMonitor.tsx`, `components/MetricsViewer.tsx`, `components/TransactionList.tsx`, `pages/Goals.tsx` e `pages/Accounts.tsx`.
- Reparei a regressao de sintaxe em `src/ai/aiCFO.ts` e mantive a explicabilidade no retorno consultivo.
- Validei com `rtk npm run test -- --run tests/unit/login.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/settings-clipboard-diagnostic.test.tsx tests/unit/import-transactions-session.test.tsx tests/unit/import-transactions-date-label.test.ts tests/unit/import-transactions-draft-path.test.ts tests/unit/transaction-list-states.test.tsx tests/unit/transaction-list-clipboard-diagnostic.test.tsx tests/unit/transaction-list-suggestion-diagnostic.test.tsx tests/unit/transaction-list-category-learning-diagnostic.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/cashflow-clipboard-diagnostic.test.tsx tests/unit/ai-control-panel-parser-lab-ui.test.tsx tests/unit/ai-control-panel-memory-error.test.tsx tests/unit/ai-control-panel-snapshots.test.tsx tests/unit/ai-control-panel-simulation.test.tsx tests/unit/ai-control-panel-date-fallback.test.ts tests/unit/aicfo-plan-render.test.tsx tests/unit/ai-cfo-observability.test.ts --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.
## Sweep final de hierarquia visual e selectors de teste
- Removi `font-black` e `font-bold` dos painéis de dev `components/dev/AIDebugPanel.tsx` e `components/dev/AITaskQueueMonitor.tsx`.
- Troquei o selector frágil `h4.font-bold` por `h4` no teste E2E `tests/e2e/transaction-edit-category.spec.ts`.
- Busca final em `components`, `pages`, `hooks`, `src` e `tests` voltou limpa para `font-black|font-bold`.
- Validado com `rtk npm run type-check:app`.
## Sweep adicional de tracking reduzido

- Normalizei `tracking-widest` e pesos monoespaçados muito agressivos em `pages/Autopilot.tsx`, `pages/ReceiptScanner.tsx`, `pages/Accounts.tsx`, `components/MetricsViewer.tsx`, `components/AIInput.tsx`, `pages/ImportTransactions.tsx`, `pages/OpenBanking.tsx`, `pages/AICFO.tsx`, `pages/Insights.tsx`, `components/AdvancedAnalytics.tsx`, `components/LegalModal.tsx`, `components/NamePromptModal.tsx`, `components/UpgradePromptCard.tsx`, `hooks/useNavigationTabs.tsx`, `components/Assistant.tsx`, `components/TransactionList.tsx`, `pages/AIControlPanel.tsx` e `components/Login.tsx`.
- Busca final em `components`, `pages`, `hooks` e `src` voltou limpa para `tracking-widest|font-black|font-bold|font-mono text-[9px]|font-mono text-[10px]` fora de `components/dev`.
- Validado com `rtk npm run type-check:app` e a suíte já executada nesta rodada.
## Sweep de dev panels com densidade reduzida

- `components/dev/AIDebugPanel.tsx` e `components/dev/AITaskQueueMonitor.tsx` tiveram a microtipografia reduzida para versões menos agressivas.
- A busca final em `components/dev` voltou limpa para `tracking-widest|font-black|font-bold|text-[7px]|text-[8px]|text-[9px]|text-[10px]`.
- Validado com `rtk npm run type-check:app`.
## Sweep final de tracking e pesos monoespaçados em produto

- Reduzi a última camada de microtipografia em `pages/Autopilot.tsx`, `pages/ReceiptScanner.tsx`, `pages/Accounts.tsx`, `components/MetricsViewer.tsx`, `components/AIInput.tsx`, `pages/ImportTransactions.tsx`, `pages/OpenBanking.tsx`, `pages/AICFO.tsx`, `pages/Insights.tsx`, `components/AdvancedAnalytics.tsx`, `components/LegalModal.tsx`, `components/NamePromptModal.tsx`, `components/UpgradePromptCard.tsx`, `hooks/useNavigationTabs.tsx`, `components/Assistant.tsx`, `components/TransactionList.tsx`, `pages/AIControlPanel.tsx`, `components/Login.tsx`, `pages/Goals.tsx`, `pages/WorkspaceAdmin.tsx` e `pages/WorkspaceAudit.tsx`.
- A busca final em `components`, `pages`, `hooks` e `src` voltou limpa para `tracking-widest|tracking-wider|font-black|font-bold|font-mono text-[7px]|font-mono text-[8px]|font-mono text-[9px]|font-mono text-[10px]` fora de `components/dev`.
- Validado com `rtk npm run type-check:app`.
## Insights com CTA operacional

- `pages/Insights.tsx` agora expõe ações diretas para abrir o assistente e ver metas a partir da leitura de caixa.
- `hooks/useNavigationTabs.tsx` repassa o callback de navegação para a tela de insights.
- `App.tsx` teve o último ruído de `font-black` suavizado no bootstrap e no status de sincronização.
- `tests/unit/insights-plan-render.test.tsx` cobre os CTAs operacionais.
- Validado com `rtk npm run test -- --run tests/unit/insights-plan-render.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.
## Insights com CTA operacional

- `pages/Insights.tsx` agora expõe ações diretas para abrir o assistente e ver metas a partir da leitura de caixa.
- `hooks/useNavigationTabs.tsx` repassa o callback de navegação para a tela de insights.
- `tests/unit/insights-plan-render.test.tsx` cobre os CTAs operacionais.
- Validado com `rtk npm run test -- --run tests/unit/insights-plan-render.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.
## Governanca de memoria no painel de IA

- `pages/AIControlPanel.tsx` agora permite excluir uma memoria individual e limpar todas as memorias da sessao atual, com confirmacao e diagnostico visivel em caso de falha.
- A aba de memoria agora exibe um resumo operacional com total, alta confianca, confianca media, baixa confianca e ultima atualizacao.
- O mesmo resumo expõe um recorte por padrões, perfil de gasto e comerciantes para leitura rápida antes de qualquer exclusao.
- A mesma aba agora filtra a lista por qualidade e funcao, incluindo alta, media, baixa confianca, padrões, perfil e comerciantes.
- A aba de memoria agora pode limpar apenas o subconjunto filtrado, sem apagar o restante da sessao.
- `tests/unit/ai-control-panel-memory-governance.test.tsx` cobre exclusao individual e limpeza total da memoria da sessao.
- Validado com `rtk npm run test -- --run tests/unit/ai-control-panel-memory-governance.test.tsx tests/unit/ai-control-panel-memory-sort.test.tsx tests/unit/ai-control-panel-memory-error.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.
## CFO com explicabilidade contratual

- `src/ai/aiCFO.ts` expõe `buildCFOExplainability` para teste direto do shape de resposta auditavel.
- `tests/unit/ai-cfo-context.test.ts` valida evidencias objetivas, nivel de confianca alto e fallback forcado em baixo.
- Validado com `rtk npm run test -- --run tests/unit/ai-cfo-context.test.ts tests/unit/ai-cfo-observability.test.ts --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.
## Harness continuo de avaliacao do CFO

- `src/ai/cfoEvaluation.ts` centraliza traits canonicos para score de respostas do CFO.
- `tests/fixtures/ai/cfoEvaluationFixtures.ts` concentra o dataset canonico por dominio e tipo de resposta.
- `tests/health/ai-cfo-evaluation.health.test.ts` executa o gate continuo com score medio minimo e sem casos falhos.
- `tests/unit/ai-cfo-evaluation.test.ts` valida um caso de caixa confirmado e um fallback real do gerador com score automatizado.
- O harness verifica resposta prudente, uso de caixa confirmado, mencao de risco, ausencia de promessa absoluta e fallback explicito.
- Validado com `rtk npm run test -- --run tests/health/ai-cfo-evaluation.health.test.ts tests/unit/ai-cfo-evaluation.test.ts tests/unit/ai-cfo-context.test.ts tests/unit/ai-cfo-observability.test.ts --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.

## Insights com lembrete operacional
- `pages/Insights.tsx` agora oferece um CTA para criar um lembrete operacional a partir da proxima acao do caixa.
- `hooks/useNavigationTabs.tsx` passa `onAddReminder` para `Insights`, mantendo o contrato de navega??o simples e reutilizando o fluxo de lembretes existente.
- O lembrete gerado deriva titulo, prioridade e tipo Negocio da proje??o e da sa?de do caixa.
- `tests/unit/insights-plan-render.test.tsx` cobre o CTA de criar lembrete nos planos free e pro.
- Validado com `rtk npm run test -- --run tests/unit/insights-plan-render.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.

## Governanca de memoria com perfil estruturado
- `pages/AIControlPanel.tsx` agora mostra um recorte estruturado por padr?es, perfil e comerciantes na aba de mem?ria.
- `tests/unit/ai-control-panel-memory-governance.test.tsx` cobre a presen?a desse perfil estruturado junto da governan?a existente.
- Validado com `rtk npm run test -- --run tests/unit/ai-control-panel-memory-governance.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.

## Insights com CTA por risco
- `pages/Insights.tsx` agora mostra um CTA operacional por risco para criar um lembrete de acompanhamento.
- O lembrete usa prioridade derivada da severidade e fecha o ciclo de leitura para acao futura.
- O mesmo card de risco agora abre o fluxo de caixa para navegação direta ao contexto operacional.
- `tests/unit/insights-plan-render.test.tsx` cobre o CTA por risco nos planos free e pro.
- Validado com `rtk npm run test -- --run tests/unit/insights-plan-render.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.

## CFO com CTA operacional na resposta
- `pages/AICFO.tsx` agora oferece lembrete de acompanhamento e atalho para o fluxo de caixa direto na resposta do CFO.
- O lembrete deriva prioridade do intent e mantém o assistente consultivo conectado a ação.
- `tests/unit/aicfo-plan-render.test.tsx` cobre a nova ação operacional na resposta do CFO.
- Validado com `rtk npm run test -- --run tests/unit/aicfo-plan-render.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.

## Governanca de memoria com perfil estruturado
- `pages/AIControlPanel.tsx` agora mostra um recorte estruturado por padr?es, perfil e comerciantes na aba de mem?ria.
- `tests/unit/ai-control-panel-memory-governance.test.tsx` cobre a presen?a desse perfil estruturado junto da governan?a existente.
- Validado com `rtk npm run test -- --run tests/unit/ai-control-panel-memory-governance.test.tsx --pool=threads --maxWorkers=1` e `rtk npm run type-check:app`.

- 2026-05-14: AIControlPanel ganhou revisao de memoria com Confirmar e Invalidar, alem de origem visivel por entry.
- 2026-05-14: A memoria passou a carregar metadata opcional para manter estado de revisao e origem.
- 2026-05-14: Memoria da IA ganhou origem persistida no armazenamento e painel com confirmacao/invalidaçao.
- 2026-05-14: learnMemory passou a gravar metadata.source por default e aceitar origem explicita.
- 2026-05-14: CFO passou a expor profundidade de resposta e a reduzir a abordagem quando a base e limitada.
- 2026-05-14: AICFO mostra 'Profundidade reduzida' na conversa quando a base e fraca.
- 2026-05-14: AIControlPanel ganhou tab de fila com status e tarefas recentes para conectar a fila de IA ao painel.
- 2026-05-14: A fila passou a ser visivel no painel sem depender apenas do monitor de dev.
- 2026-05-14: Harness de avaliacao do CFO passou a validar profundidade reduzida quando a base e limitada.
- 2026-05-14: Trait de avaliacao novo cobre profundidade standard vs reduzida no CFO.
- 2026-05-14: AIControlPanel ganhou acoes de fila para cancelar tarefas pendentes e limpar tarefas concluidas/falhas.
- 2026-05-14: A fila do painel agora recarrega os estados apos cancelamento ou limpeza para refletir a operacao.
- 2026-05-14: A fila do painel ganhou detalhe de task selecionada com payload, retries e estado visivel.
- 2026-05-14: O detalhe da task fecha o ciclo de diagnostico sem precisar sair do painel de IA.
- 2026-05-14: A fila do painel agora reage a eventos de mutacao da queue e recarrega automaticamente.
- 2026-05-14: taskStore passou a emitir eventos de atualizacao, enfileiramento e limpeza para manter a UI sincronizada.
- 2026-05-14: O resumo rapido do painel agora inclui o estado da fila de IA em tempo real.
- 2026-05-14: O snapshot da fila entrou nas metricas de sistema para dar visao operacional sem abrir a aba Queue.
- 2026-05-14: O viewer interno do painel agora expõe o snapshot da fila com label acessivel e refresh por evento.
- 2026-05-14: O contador da fila no resumo rapido atualiza quando uma task nova e adicionada ao store.
- 2026-05-14: A fila ganhou métrica de canceladas na API e no monitor dev.
- 2026-05-14: A documentacao da queue foi atualizada para refletir os novos eventos e a nova estatistica.
- 2026-05-14: O pipeline de eventos agora registra canceladas como métrica da fila.
- 2026-05-14: O fluxo transaction_created ficou alinhado com a nova estatistica da queue.
- 2026-05-14: O contrato de `getQueueStats()` agora inclui canceladas como campo coberto por teste.
- 2026-05-14: A observabilidade da queue ficou alinhada com a telemetria consumida pelo painel e pelo pipeline.
- 2026-05-14: O monitor dev da queue agora reage a update e clear com teste próprio de refresh.
- 2026-05-14: A fila de dev ficou coberta para refresh por evento e limpeza manual.
- 2026-05-14: taskStore passou a ter teste dedicado para eventos de enqueue, update e clear.
- 2026-05-14: O contrato de refresh da queue ficou protegido no store e no monitor.
- 2026-05-14: O clear global da queue agora tem teste dedicado para scope all.
- 2026-05-14: O contrato de limpeza da queue ficou coberto para escopo individual e global.
- 2026-05-14: aiMemory passou a ter teste de merge de metadata para revisar memoria com origem persistida.
- 2026-05-14: O fluxo de revisao da memoria ganhou protecao para reviewState e source persistidos.
- 2026-05-14: A fila de IA deixou de emitir evento de enqueue duplicado e passou a depender do taskStore como fonte unica.
- 2026-05-14: O contrato de evento da fila agora usa o taskStore como emissor unico para refresh da UI.
- 2026-05-14: A simulacao do painel de IA perdeu os casts any e ficou tipada por ramo.
- 2026-05-14: O contrato da aba Simulation agora usa o tipo de cenário real sem holes de tipo.
- 2026-05-14: O Parser Lab passou a tratar erro como unknown e exibir a mensagem normalizada ao usuario.
- 2026-05-14: O caminho de erro do parser ficou coberto por teste de UX e log contextual.
- 2026-05-14: O autopilot financeiro recebeu tipagem explicita para os payloads da queue.
- 2026-05-14: A assinatura da queue e do autopilot ficou alinhada sem arrays unknown no caminho de analise.
- 2026-05-14: O eventEngine deixou de expor callbacks any[] para insights, riscos e acoes.
- 2026-05-14: A ponte entre o pipeline e a UI ficou tipada com os tipos reais do dominio.
- 2026-05-14: O adaptador de Sentry ficou tipado sem casts any na superficie publica.
- 2026-05-14: A integracao de observabilidade passou a usar um wrapper local com contrato tipado.
- 2026-05-14: O CFO passou a tratar erro como unknown e normalizar a mensagem de fallback.
- 2026-05-14: O caminho de falha do CFO ficou com log e diagnostico sem catch any.
- 2026-05-14: O Parser Lab do painel passou a tipar o resultado como Transaction[].
- 2026-05-14: O estado do parser nao depende mais de any[] para renderizar o preview.
- 2026-05-15: O parser OFX do importService perdeu os casts any e passou a usar estado tipado.
- 2026-05-15: O pipeline de importacao agora trata erro como unknown e normaliza a mensagem.
- 2026-05-15: Login, importacao, recibo, previsoes e Open Banking perderam os ultimos catch any do fluxo principal.
- 2026-05-15: O login passou a normalizar erro e codigo sem depender de any, e a importacao/recibo/previsoes seguiram o mesmo contrato.
- 2026-05-15: BankSyncEngine, AIInterpreter, ExtratoImporter, AIQueueListener e AIWorker passaram a tratar erro como unknown.
- 2026-05-15: O hook de performance, o importador OFX, o adaptive engine e os stores de memoria fecharam os ultimos casts any de infraestrutura.
- 2026-05-15: Backend AI providers e predictions ficaram sem any no caminho principal.
- 2026-05-15: backend/src/services/ai, backend/src/controllers/aiController.ts e backend/src/routes/predictions.ts passaram a usar erros unknown e listas tipadas.
- 2026-05-15: Os testes de observabilidade de AI provider e AIServiceFactory foram ajustados para mocks construtiveis.
- 2026-05-15: Clinic automation e integration observability perderam os ultimos any de telemetria, auditoria e idempotencia.
- 2026-05-15: jsonHelpers, clinicAudit, IdempotentEventStore, IntegrationTelemetry e IntegrationMonitor ficaram tipados com guards e environment normalizado.
- 2026-05-15: Os testes de idempotencia e clinic routes foram ajustados para os novos contratos sem any.
- 2026-05-15: Os testes de auth, banking, oauth, AI e integration telemetry perderam os ultimos any do bloco de observability.
- 2026-05-15: auth middleware, auth refresh, banking controller, oauth controller, AI controller, AIServiceFactory e integration telemetry test ficaram sem casts any no caminho principal.
- 2026-05-15: A validacao do backend passou com type-check e uma bateria focada de testes de observability.
- 2026-05-15: Os testes de AI security, auth firebase session, auth cookie, clinic payload limit, clinic AI enrichment queue e external integration auth perderam os ultimos any do lote legado.
- 2026-05-15: O auth externo passou a testar o caminho real de compare de assinatura sem quebrar o compare da chave.
- 2026-05-15: A fila clinica passou a validar o retry warning real em vez de um erro artificial.
- 2026-05-15: authController login security e clinic automation contract perderam os ultimos any dos hotspots restantes.
- 2026-05-15: O login agora trata email e password com trim antes de autenticar, bloqueando string vazia com espacos.
- 2026-05-15: O contrato da automacao clinica passou a usar mocks e payloads tipados sem casts any no teste.
- 2026-05-15: predictions.ts, sentry.ts, AISecurityGuard e backend/types/index.ts perderam os ultimos any reais do backend/src.
- 2026-05-15: O contrato das rotas de previsao saiu de Promise<any> e passou a retornar void com respostas explicitas.
- 2026-05-15: ai-security-middleware e rate-limit-by-user perderam os ultimos casts any dos testes restantes.
- 2026-05-15: firebaseOptimized, geminiService, AIMemoryEngine e AIWorker ficaram sem os ultimos erros de tipagem pendentes.
- 2026-05-15: O cache do Firebase passou a ser generico, o report estrategico ficou com retorno tipado e o worker de IA voltou a carregar o payload no escopo correto.
- 2026-05-15: index.tsx, useNavigationTabs.tsx e vite.config.ts perderam os ultimos any de bootstrap e lazy loading.
- 2026-05-15: Os testes de Accounts e WorkspaceAudit foram alinhados com a copy nova e a validacao de navegacao voltou verde.
- 2026-05-15: ai-memory-engine, gemini-service-fallback e feature-gate perderam os ultimos any de teste ainda pendentes.
- 2026-05-15: Os testes de memoria de IA, fallback de Gemini e feature gate foram tipados com TransactionData, Reminder e Request/Response.
- 2026-05-15: assistant-reminder-states e ai-memory-branches perderam os ultimos any de teste ainda pendentes.
- 2026-05-15: O assistente passou a usar o botao e o modal atualizados para alertas do caixa, e o branch de memoria ficou com fixtures de Transaction tipadas.
- 2026-05-15: app-bootstrap-observability, backend-error-handler e ai-cfo-debug-log perderam os ultimos any de teste ainda pendentes.
- 2026-05-15: O boundary de bootstrap ficou com props tipadas, o error handler passou a receber Request/Response e o debug do CFO ficou com retorno tipado do service.
- 2026-05-15: app-bootstrap-observability, backend-error-handler e ai-cfo-debug-log ficaram sem os ultimos any do lote atual.
- 2026-05-15: O teste de bootstrap passou a usar ErrorBoundaryProps, o error handler ficou com Request/Response tipados e o debug do CFO usa o retorno real do GeminiService.
- 2026-05-15: backend-oauth, external-integration-auth e finance-controller perderam os ultimos any do lote atual.
- 2026-05-15: OAuth, auth externa e finance controller passaram a usar Request/Response e mocks tipados sem casts any.
- 2026-05-15: openbanking-render-guard e cashflow-predictor perderam os ultimos any do lote atual.
- 2026-05-15: O guard de navegacao passou a tratar openbanking legacy como never e o cashflow predictor ficou com fixtures de Transaction e Account tipadas.
- 2026-05-15: assistant-smart-alerts-fallback e dashboard-quick-actions perderam os ultimos any do lote atual.
- 2026-05-15: O assistente passou a usar transactions tipadas e o fallback de alertas de caixa agora segue o modal atual sem casts soltos.
- 2026-05-15: O dashboard quick actions ficou com ReminderType e Reminder tipados nas fixtures de recebiveis.
- 2026-05-15: io-integrations.health, transaction-list-states e usePerformanceMonitoring perderam os ultimos any do lote atual.
- 2026-05-15: O health check de IO passou a usar TransactionData tipado, a lista de transacoes validou o estado pendente com tipo local e o monitor de performance ficou sem cast no observer.
- 2026-05-15: backend-controllers, import-transactions-draft-path, cashflowEngine, intakeNormalizer, task-store-branches e user-context perderam os ultimos any do lote atual.
- 2026-05-15: Os controllers backend passaram a usar requests/responses tipados, o import draft path usou ImportedTransaction, o cashflow engine aceitou CashflowTransaction e os testes de runtime ficaram sem casts soltos.
- 2026-05-15: event-engine-orchestrator-routing, smart-budget e task-store-core perderam os ultimos any do lote atual.
- 2026-05-15: O event engine voltou a usar o modulo real, o smart budget ficou com arrays tipados e o task store passou a registrar detail como unknown nas emissões.
- 2026-05-15: cfo-advisor, open-banking-service e multi-tenant-isolation perderam os ultimos any do lote atual.
- 2026-05-15: open-banking-service-extended foi reestruturado com helpers tipados para provider, transactions e accounts, e o resto do bloco ficou sem casts any.
- 2026-05-15: O fluxo de Open Banking permaneceu verde com as variantes local, backend, fallback e multi-tenant.
- 2026-05-15: skipHelpers.ts do E2E foi tipado com TestInfo e perdeu o ultimo any executavel fora de testes/unit e backend/tests/unit.
- 2026-05-15: Os unicos any restantes no repo estao em documentacao textual (READMEs e changelog), nao em codigo executavel.
- 2026-05-15: README e changelog perderam os ultimos tokens any textuais; a busca final por any fora de docs voltou vazia.
- 2026-05-15: O placeholder da fila clinica foi reescrito para refletir a heuristica local observavel.
- 2026-05-15: Nao sobraram TODO/FIXME/HACK reais no codigo executavel; o que aparece fora disso e dependencia empacotada.
- 2026-05-15: O helper de skip do E2E foi tipado com TestInfo e saiu do ultimo any executavel.
- 2026-05-15: O monitor da AI Task Queue voltou a validar canceladas e refresh por evento com strings em UTF-8.
- 2026-05-15: O adapter tipado de Sentry ganhou teste de compatibilidade com callback executado de verdade.
- 2026-05-15: forecastListener, cacheInvalidationListener e aiQueueListener passaram a usar logDebug em vez de console.debug.
- 2026-05-15: A ultima ocorrencia de console.debug em listeners de produto saiu do caminho executavel.
- 2026-05-15: workspace-store-observability passou a testar o backfill real via loadJsonState.
- O teste de backfill deixou de depender de loadWorkspaceStoreState com dados prontos e passou a validar o warn workspace-store-backfill-failed no fallback correto.
- Validado com npx vitest run backend/tests/unit/workspace-store-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: workspace-store-observability passou a cobrir o backfill normalizado vindo do JSON legado.
- O teste de backfill agora valida o warn workspace-store-backfill-failed no caminho de falha e o saveWorkspaceStoreState com tenantId e role normalizados no caminho de sucesso.
- Validado com npx vitest run backend/tests/unit/workspace-store-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: saas-store.observability passou a cobrir o backfill normalizado vindo do JSON legado.
- O teste de backfill agora valida o warn saas-backfill-to-postgres-failed no caminho de falha e o saveWorkspaceSaasState com usageByWorkspace, billingHooksByWorkspace e usageEventsByWorkspace normalizados no caminho de sucesso.
- Validado com npx vitest run backend/tests/unit/saas-store.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: backend bootstrap observability passou a carregar contexto estruturado no cold start serverless e nas falhas de init OpenAI/Gemini.
- O log de cold start agora inclui initializationTasks, vercel, nodeEnv e fallback serverless-cold-start-persistence-init-failed.
- Os logs de init de AI agora incluem provider, hasApiKey e fallback openai-init-failed/gemini-init-failed.
- Validado com npx vitest run backend/tests/unit/index-bootstrap-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: cfo-advisor.test.ts perdeu o ultimo as any e voltou a usar date normalizado tipado.
- O helper de transacao do advisor agora converte Date ou string para o campo date sem cast solto.
- Validado com npx vitest run tests/unit/cfo-advisor.test.ts --pool=threads --maxWorkers=1 e npm run type-check:app.
- 2026-05-15: backend bootstrap, workspaceStore, saasStore e cfo-advisor fecharam a ultima rodada de observability e tipagem.
- O cold start serverless agora registra contexto estruturado com initializationTasks, vercel, nodeEnv e fallback serverless-cold-start-persistence-init-failed.
- workspaceStore e saasStore passaram a cobrir tanto o warn de backfill falho quanto o backfill normalizado vindo do JSON legado.
- cfo-advisor.test.ts perdeu o ultimo as any real e voltou ao helper tipado de data normalizada.
- Validado com npx vitest run backend/tests/unit/index-bootstrap-observability.test.ts backend/tests/unit/workspace-store-observability.test.ts backend/tests/unit/saas-store.test.ts tests/unit/cfo-advisor.test.ts --pool=threads --maxWorkers=1, npm --prefix backend run type-check e npm run type-check:app.
- 2026-05-15: postgres-state-store-observability fechou falha e sucesso para workspace e SaaS persist.
- saveWorkspaceStoreState e saveWorkspaceSaasState agora sao cobertos tanto no caminho de rollback quanto no caminho feliz de commit.
- Validado com npx vitest run backend/tests/unit/postgres-state-store-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: prediction-engine-observability ganhou caminho saudavel alem dos fallbacks de leitura e escrita do Redis.
- O teste agora valida que o cache Redis responde normalmente sem gerar warn e com redisSet assíncrono bem sucedido.
- Validado com npx vitest run backend/tests/unit/prediction-engine-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: firestore-admin-observability ganhou caminho saudavel alem da falha de bootstrap.
- O teste agora valida reuse do Firestore, applyFirestoreSettingsOnce e ausencia de error log quando a inicializacao tem sucesso.
- Validado com npx vitest run backend/tests/unit/firestore-admin-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: ai-service-initialization-observability ganhou caminho saudavel alem da falha de factory.
- O teste agora valida initializeAIService e getAIService com singleton real e log de sucesso, alem do erro ai-service-unavailable.
- Validado com npx vitest run backend/tests/unit/ai-service-initialization-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: banking-connection-store-observability ficou bilateral no Firebase Open Finance.
- O teste agora valida bootstrap falho e reuse bem-sucedido do Firestore com applyFirestoreSettingsOnce e ignoreUndefinedProperties.
- Validado com npx vitest run backend/tests/unit/banking-connection-store-observability.test.ts --pool=threads --maxWorkers=1 e npm --prefix backend run type-check.
- 2026-05-15: authz-observability e aicfo-plan-render foram limpos de encoding/selector drift.
- authz-observability perdeu o BOM e voltou a aguardar o middleware assíncrono com flush explícito.
- aicfo-plan-render voltou a usar texto limpo e o seletor certo do CTA Ver fluxo.
- Validado com npx vitest run backend/tests/unit/authz-observability.test.ts tests/unit/aicfo-plan-render.test.tsx --pool=threads --maxWorkers=1 e npm run type-check:app.
- 2026-05-15: event-store-observability passou a aguardar explicitamente o caminho feliz.
- O teste agora usa await no getDomainEvents para evitar promessa solta e manter a assercao resolvida real.
- Validado com npx vitest run backend/tests/unit/event-store-observability.test.ts --pool=threads --maxWorkers=1.
- 2026-05-15: clinic-integration e saas.integration passaram a isolar os stores de teste em arquivos temporarios.
- clinic-integration agora usa WORKSPACE_STORE_FILE, SAAS_STORE_FILE e DOMAIN_EVENT_STORE_FILE sob .tmp.
- saas.integration agora usa WORKSPACE_STORE_FILE e SAAS_STORE_FILE sob .tmp.
- Validado com npm --prefix backend run type-check e npm run type-check:app.
- 2026-05-15: ai-service-initialization, banking-connection-store, event-store, firestore-admin e prediction-engine ganharam o ultimo caminho saudavel faltante.
- ai-service-initialization agora valida singleton real e log de sucesso; banking-connection-store agora valida reuse do Firestore com ignoreUndefinedProperties; event-store persiste sem warn quando o arquivo grava normalmente; firestore-admin valida reuse e ausencia de error; prediction-engine valida cache Redis saudável sem warn.
- Validado com npx vitest run backend/tests/unit/ai-service-initialization-observability.test.ts backend/tests/unit/banking-connection-store-observability.test.ts backend/tests/unit/event-store-observability.test.ts backend/tests/unit/firestore-admin-observability.test.ts backend/tests/unit/prediction-engine-observability.test.ts --pool=threads --maxWorkers=1, npm --prefix backend run type-check e npm run type-check:app.
- 2026-05-15: revisão de bugs fechou drift de mocks hoisted, dead-letter da fila e contexto de observabilidade.
- backend/tests/unit/auth-decode-token.test.ts, error-handler-observability.test.ts, event-queue.test.ts, monitor-integration-observability.test.ts e workspace-integration-key-store.test.ts passaram a usar vi.hoisted nos mocks consumidos por vi.mock.
- backend/src/events/eventQueue.ts agora registra event-queue-dead-letter no momento em que o retry atinge MAX_RETRIES, sem depender de uma tentativa posterior.
- backend/src/services/observability/monitorIntegration.ts passou a incluir userId nos logs de sucesso e erro de integracao.
- O gate docs:check-mojibake voltou a ficar limpo depois da normalizacao de textos PT-BR corrompidos em app, docs, scripts e testes.
- Validado com npx vitest run backend/tests/unit --pool=threads --maxWorkers=1 --reporter=dot --silent --bail=1, npx vitest run tests/unit/ai-input.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/import-transactions-session.test.tsx tests/unit/open-banking-page.test.tsx tests/unit/useSyncEngine.test.tsx --pool=threads --maxWorkers=1, npm run docs:check-mojibake, npm run type-check:app e npm --prefix backend run type-check.
