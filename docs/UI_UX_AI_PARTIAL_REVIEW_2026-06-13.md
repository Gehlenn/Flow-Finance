# Flow Finance - UI/UX partial review and AI real-use queue

Data: 2026-06-13

Escopo desta rodada: avaliacao parcial de frontend antes de alterar componentes. A prioridade e deixar o produto mais bonito, harmonioso, fluido e intuitivo sem desviar do core: fluxo de caixa para empresas de servico, transacoes uteis, receita prevista vs realizada, ligacao operacao-financeiro, dashboard claro e IA consultiva.

## Protocolo de execucao

- Orquestracao, revisao e decisoes ficam com GPT-5.5.
- Toda implementacao, pesquisa e acao de codigo delegada deve ir para subagents GPT-5.4-mini, quando a ferramenta suportar.

## Veredito parcial

O frontend atual ja esta muito mais alinhado ao foco do Flow Finance do que a auditoria original indicava. O problema visual agora nao e falta de core; e excesso de superficie tratada como card.

Leitura brutal:

- O dashboard tem a informacao certa, mas ainda parece uma sequencia de caixas concorrendo por atencao.
- A experiencia mobile tende a funcionar, mas o primeiro viewport ainda pode ficar caro cognitivamente quando ativacao, status, saldo, ritual e alerta aparecem como blocos equivalentes.
- A IA consultiva tem bons limites tecnicos, mas a tela ainda se comunica mais como chat com paineis auxiliares do que como cockpit consultivo de decisao de caixa.
- O login esta polido, mas o tratamento visual e mais hero/marketing do que superficie operacional.

Nota parcial de UI atual: `7.9/10`.

Confianca: media. Ha evidencia de codigo, docs e arquitetura de navegacao, mas ainda falta screenshot comparativo e sessao real de usuario externo usando mobile/web.

## Evidencia usada

Implementado:

- `components/Dashboard.tsx:631` define `PANEL_SURFACE` como card grande com `rounded-3xl`, borda, fundo branco e sombra.
- `components/Dashboard.tsx:661` abre o dashboard com card de cabecalho.
- `components/Dashboard.tsx:774` mostra saldo atual como bloco principal.
- `components/Dashboard.tsx:826` mostra o ritual semanal.
- `components/Dashboard.tsx:921` mostra `O que pede atencao` em bloco amber separado.
- `components/Dashboard.tsx:1003` mostra `Acoes principais` como outro bloco cardificado.
- `App.tsx:420` cria container com padding grande e bottom padding para nav fixa.
- `App.tsx:424` usa tablist de subsecoes em card proprio.
- `App.tsx:455` a `App.tsx:466` implementam FAB e bottom nav fixa.
- `src/app/mainNavigation.ts:17` a `src/app/mainNavigation.ts:60` mantem navegacao segmentada em `Caixa`, `Operacao`, `Receitas` e `IA`.
- `components/Login.tsx:205` usa headline grande `Flow` com gradiente.
- `components/Login.tsx:218` usa card de login com `rounded-[3rem]`, sombra pesada e blur.
- `pages/AICFO.tsx:50` define prompts rapidos focados em caixa, risco, vencimento e corte.
- `pages/AICFO.tsx:80` e `pages/AICFO.tsx:81` definem superficies de painel para a IA.
- `pages/AICFO.tsx:507` a `pages/AICFO.tsx:586` enviam pergunta, geram resposta consultiva, rastreiam conclusao/fallback e evitam recomendacao inventada quando ha falha.
- `pages/AICFO.tsx:637` a `pages/AICFO.tsx:687` mostram snapshot rapido, confianca e qualidade da base.

Documentado:

- `docs/AUDIT_CURRENT_SCORECARD_2026-06-13.md` marca UX/UI web e mobile como `8/10`, com ressalva de prova continua.
- `docs/AUDIT_CURRENT_SCORECARD_2026-06-13.md` marca arquitetura frontend como `7/10`, parcialmente fechada porque a shell ainda concentra responsabilidades.
- `docs/AUDIT_CURRENT_SCORECARD_2026-06-13.md` marca IA consultiva como `8/10`, mas ainda sem evidencia suficiente de custo/qualidade percebida em uso real amplo.

Inferido pelo auditor:

- A repeticao de `rounded-3xl`, sombras, cards, paineis e pills em varias telas tende a deixar o produto visualmente generico e pesado, mesmo quando a informacao esta correta.
- O dashboard pode ficar mais intuitivo se a tela inicial operar como uma leitura unica de caixa, nao como colecao de modulos equivalentes.
- A IA pode gerar mais uso real se virar uma camada consultiva sobre decisao de caixa com evidencia, confianca e proxima acao, nao apenas conversa.

SEM EVIDENCIA SUFICIENTE:

- Sessao gravada de usuario real usando web.
- Sessao gravada de usuario real usando mobile.
- Heatmap, funil visual, tempo ate primeira decisao ou taxa de clique nos blocos do dashboard.
- Prova de que a tela de IA gera decisao recorrente sem acompanhamento manual.
- Comparativo A/B de layout cardificado vs layout operacional mais plano.

## Visual thesis

O Flow Finance deve parecer uma mesa de comando financeira calma: superficie clara, pouco ornamento, hierarquia forte, alerta sobrio e acao evidente.

## Content plan para o app

1. Primeiro viewport: caixa atual, previsto curto, recebido/pendente/vencido e uma acao recomendada.
2. Segundo bloco: ritual semanal como loop principal de habito.
3. Terceiro bloco: estados financeiros e recebiveis como explicacao auditavel.
4. Quarto bloco: atalhos secundarios, so depois da leitura de decisao.
5. IA: perguntas orientadas por trabalho financeiro real, resposta com base usada, confianca, limite e proxima acao.

## Interaction thesis

- Movimento deve existir para status de sync, entrada de modais e confirmacao de acao financeira.
- Transicoes de troca de aba podem ser discretas, mas nao devem transformar cada card em evento visual.
- Mobile deve priorizar estabilidade: nada que mova a leitura do saldo, risco e acao depois que a tela carrega.

## Scorecard parcial por area

| Area | Nota | Confianca | Principal problema | Prioridade |
| --- | ---: | --- | --- | --- |
| Hierarquia do dashboard | 7 | Media | Informacao certa, mas excesso de blocos com peso visual semelhante | P1 |
| Mobile primeiro viewport | 8 | Media | A leitura inicial melhorou, mas ainda precisa prova com usuario externo | P1 |
| Harmonia visual | 7 | Alta | Muito card, raio grande, sombra e slate repetido | P1 |
| Navegacao | 8 | Media | Mobile esta compacto; desktop agora evita sobreposicao com rail lateral em telas largas | P2 |
| Login | 7 | Media | Polido, mas com energia de landing/hero dentro de produto operacional | P2 |
| IA consultiva UI | 8 | Media | Base e limites agora aparecem melhor, mas ainda falta prova de uso recorrente real | P1 |
| Fluidez | 7 | Baixa | Ha animacoes implementadas, mas falta validacao visual por screenshot/runtime nesta rodada | P2 |
| Intuitividade operacional | 8 | Media | Labels estao bons, mas a ordem e o peso dos blocos podem melhorar | P1 |

## Principais problemas e impactos

### P1 - Dashboard ainda parece mosaico de cards

- Evidencia: `components/Dashboard.tsx:631`, `components/Dashboard.tsx:661`, `components/Dashboard.tsx:774`, `components/Dashboard.tsx:826`, `components/Dashboard.tsx:888`, `components/Dashboard.tsx:921`, `components/Dashboard.tsx:981`, `components/Dashboard.tsx:1003`.
- Problema: quase todos os blocos importantes usam tratamento de painel proprio. Isso reduz contraste hierarquico entre saldo, ritual, atencao e acoes.
- Impacto comercial: o usuario entende que ha recursos, mas pode nao sentir uma leitura unica de decisao.
- Impacto tecnico: refinar exige mexer no layout central, mas nao exige mudar dominio financeiro.
- Risco se ignorar: o produto continuar parecendo dashboard financeiro generico com bons textos.
- Correcao recomendada: transformar o dashboard em uma superficie principal com secoes, dividers e hierarquia de leitura; manter card apenas para interacoes reais ou alertas.
- Esforco estimado: medio.
- Prioridade: P1.

### P1 - Primeiro viewport mobile precisa ser mais decisivo

- Evidencia: `App.tsx:420` adiciona padding/top/bottom para status e nav; `components/Dashboard.tsx:691` a `components/Dashboard.tsx:824` podem inserir ativacao, cabecalho e saldo antes do alerta/ritual; `App.tsx:455` a `App.tsx:466` adicionam FAB e nav fixa.
- Problema: em estados de ativacao ou sync, a primeira tela pode virar empilhamento de chrome antes da decisao principal.
- Impacto comercial: pequenas empresas tendem a abrir no celular para decidir rapido; se a resposta nao aparece logo, o produto perde habito.
- Impacto tecnico: ajuste e de composicao e breakpoints, com baixo risco de dominio.
- Risco se ignorar: mobile virar web comprimido.
- Correcao recomendada: criar um `cash decision strip` mobile no topo com saldo, previsto 7 dias, vencido/pendente e CTA unica.
- Esforco estimado: medio.
- Prioridade: P1.

### P1 - IA precisa parecer instrumento de decisao, nao novidade de chat

- Evidencia: `pages/AICFO.tsx:50` a `pages/AICFO.tsx:57` prompts rapidos; `pages/AICFO.tsx:637` a `pages/AICFO.tsx:687` snapshot/confianca; `pages/AICFO.tsx:696` a `pages/AICFO.tsx:760` area de mensagens, input e prompts.
- Problema: os ingredientes corretos existem, mas o frame principal ainda e conversa. O diferencial deveria ser pergunta financeira guiada com resposta fundamentada e proxima acao.
- Impacto comercial: IA generica e facil de copiar; IA que reduz incerteza semanal de caixa e mais defensavel.
- Impacto tecnico: separar "workspace de pergunta" de "historico de conversa" reduz peso visual e melhora instrumentacao.
- Risco se ignorar: usuarios testam uma vez, acham interessante e nao retornam.
- Correcao recomendada: reorganizar a tela como `Pergunta de caixa`, `Base usada`, `Resposta`, `Proxima acao`, `Historico`, com chat como detalhe.
- Esforco estimado: medio a alto.
- Prioridade: P1.

### P2 - Login esta bonito, mas desalinhado com produto operacional

- Evidencia: `components/Login.tsx:205` a `components/Login.tsx:218`.
- Problema: headline enorme, gradiente e card com raio de 3rem comunicam landing/premium app; o produto principal precisa passar clareza operacional e confianca financeira.
- Impacto comercial: primeiro contato pode parecer mais app de consumo do que ferramenta de gestao.
- Impacto tecnico: ajuste isolado.
- Risco se ignorar: posicionamento visual menos B2B e menos financeiro.
- Correcao recomendada: reduzir hero, trazer promessa operacional direta, baixar sombra/raio e reforcar seguranca/uso real sem excesso visual.
- Esforco estimado: baixo a medio.
- Prioridade: P2.

### P2 - Sistema visual tem excesso de slate, radius e sombra

- Evidencia: `rg` encontrou uso amplo de `rounded-3xl`, `rounded-[2rem]`, `rounded-[3rem]`, `shadow-*`, `PANEL_SURFACE` e animacoes em `App.tsx`, `components/*` e `pages/*`.
- Problema: mesmo quando cada tela funciona, o conjunto fica muito uniforme e pouco proprio.
- Impacto comercial: risco de parecer template SaaS/financeiro generico.
- Impacto tecnico: recomenda criar tokens de superficie por funcao, nao trocar classe por classe sem criterio.
- Risco se ignorar: cada nova tela copia o mesmo card e aumenta a sensacao generica.
- Correcao recomendada: definir 4 tokens: `workspace`, `interactive-card`, `alert`, `modal`; reduzir `rounded-3xl` para modais/alerts e usar linhas/dividers no workspace.
- Esforco estimado: medio.
- Prioridade: P2.

## Checklist de melhoria frontend

### Imediato, antes de mexer na IA

- [x] Criar screenshot baseline desktop e mobile do dashboard, login e IA.
- [x] Aplicar primeira passada de hierarquia no dashboard: saldo, atencao e ritual ficaram agrupados em duas superficies principais, com menor cardificacao interna.
- [x] Definir contrato visual: `workspace`, `section`, `interactive-card`, `alert`, `modal`.
- [x] Redesenhar primeiro viewport do dashboard para leitura unica de caixa.
- [x] Elevar `O que pede atencao` para perto do saldo ou combinar com a leitura principal.
- [x] Transformar `Ritual semanal` em parte do loop principal, nao mais um card equivalente.
- [x] Reduzir tratamento de card em `Acoes principais` e secoes explicativas.
- [x] Testar mobile 390px e 430px para garantir que saldo, risco e acao aparecem cedo.
- [x] Remover sobreposicao da navegacao principal sobre o conteudo em desktop largo.

Status da passada atual:

- Desktop: melhora visivel e suficiente para seguir.
- Mobile: melhora visivel. O dashboard injeta `O que pede atencao` no bloco principal e a nav inferior ficou mais compacta, mantendo acesso rapido sem virar o foco da tela.
- Desktop largo: a navegacao principal agora vira rail lateral, evitando cobrir dashboard, IA ou compositores no rodape.
- Fechamento local de 2026-06-14: `components/Dashboard.tsx` agora abre em uma superficie unica de decisao com `Caixa real`, `Previsto curto`, `Pendente`, `Vencido`, atencao e CTA de `Registrar revisao semanal` no primeiro bloco. A base da revisao ficou abaixo como suporte, sem duplicar a CTA principal.

### Pre-lancamento visual

- [x] Harmonizar login com produto operacional.
- [x] Revisar `CashFlow`, `TransactionList`, `Insights`, `Settings` e `Assistant` para reduzir cardificacao herdada.
- [x] `TransactionList` ja recebeu a passada de compactacao visual: toolbar de busca/compartilhar/filtro mais leve, header e chips mobile menores, rows auxiliares mobile ocultas e bulk action strip mais fino.
- [x] `CashFlow` ja recebeu a passada de compactacao visual: superficies de rotina menos pesadas, toolbar de periodo/compartilhar mais densa, tabs internas 2x2 no mobile e paineis iniciais com menor atrito contra a nav fixa.
- [x] `Settings` ja recebeu a passada de compactacao visual: operacao do workspace, plano, integracoes e suporte ficaram menos cardificados, com menor radius/sombra e modal de guia IA menos pesado.
- [x] `Assistant` ja recebeu a passada de compactacao visual: header, atalhos, CTA de alertas, listas de lembretes/metas/limites e modais ficaram mais densos e operacionais.
- [x] `Insights` ja recebeu a passada de compactacao visual: superficies operacionais menores, header mais direto, leitura de saude/projecao/contexto mais auditavel, sinais e riscos menos parecidos com galeria generica de IA.
- [x] Padronizar movimento apenas para status, modais, confirmacoes e troca de estado critica.
- [x] Criar regressao visual leve com screenshots em desktop e mobile.
- [x] Atualizar `docs/AUDIT_CURRENT_SCORECARD_2026-06-13.md` apos a revisao visual implementada.

### Depois, IA de uso real

- [x] Trocar frame da IA de "chat principal" para "decisao consultiva de caixa".
- [x] Agrupar prompts por trabalho: pagar semana, cobrar recebiveis, cortar gasto, prever fechamento.
- [x] Mostrar sempre base usada: saldo, pendente, vencido, previsto e confianca.
- [x] Exigir proxima acao para respostas de risco alto.
- [x] Instrumentar eventos: pergunta feita, resposta com base suficiente, fallback, acao criada, navegacao apos resposta.
- [x] Criar teste de qualidade com perguntas canonicas e snapshots de resposta.
- [x] Manter limite: IA consultiva, nao CFO autonomo.

Status desta passada:

- `pages/AICFO.tsx` foi reorganizada para `leitura operacional -> base usada -> workspace consultivo -> pergunta operacional`.
- Os prompts rapidos foram mantidos, mas agora aparecem como ponto de partida para decisao concreta, nao como chips soltos em uma tela de chat.
- A base consultiva agora fica explicita logo no topo com saldo, 7 dias, 30 dias, confianca, recorrencias, suficiencia da base e postura do consultor.
- O estado vazio deixou de auto-rolar para o fim da tela; isso corrigiu a perda do topo do workspace na captura desktop.
- `components/TransactionList.tsx` foi compactado visualmente por GPT-5.4-mini sob orquestracao GPT-5.5: toolbar mais leve, mobile header/chips menores, rows auxiliares mobile ocultas e bulk strip mais fino.
- `components/CashFlow.tsx` foi compactado visualmente por GPT-5.4-mini sob orquestracao GPT-5.5, com ajuste final local do orquestrador apos limite de uso do subagente: menos radius/sombra em superficies de rotina, tabs internas mais densas no mobile e toolbar de periodo/compartilhar mais compacta.
- `components/Settings.tsx` foi compactado visualmente por GPT-5.4-mini sob orquestracao GPT-5.5: header menor, superficies de rotina com menor radius/sombra, integracoes/suporte mais calmos e modal de guia IA menos pesado. O orquestrador removeu BOM residual antes da validacao final.
- `components/Assistant.tsx` foi compactado visualmente por GPT-5.4-mini sob orquestracao GPT-5.5: header e atalhos mais densos, CTA de alertas menos parecido com banner, listas de rotina com menos peso visual e modais menos volumosos. O orquestrador removeu BOM/whitespace residual antes da validacao final.
- `pages/Insights.tsx` foi compactado visualmente por GPT-5.4-mini sob orquestracao GPT-5.5: a tela deixou de forcar `rounded-[2rem]`/sombras em superficies de rotina, corrigiu o contraste de valores positivos da projecao e passou a organizar saude, projecao, contexto, sinais e riscos como leitura operacional de caixa.
- O orquestrador removeu BOM residual do patch de `Insights` e ajustou a grade executiva para empilhar os blocos no container atual, evitando quebra ruim de `Contexto avancado` no desktop.
- `pages/AICFO.tsx` recebeu a primeira passada de uso recorrente real por GPT-5.4-mini sob orquestracao GPT-5.5: cada resposta agora garante `Base da resposta`, perguntas de risco/caixa exibem `Proxima acao obrigatoria`, e os cliques de criar lembrete/abrir fluxo viraram eventos instrumentados.
- `src/app/productAnalytics.ts` agora aceita `ai_question_submitted`, `ai_response_action_created` e `ai_response_flow_opened`, sem incluir propriedades sensiveis.
- `tests/unit/aicfo-plan-render.test.tsx` passou a cobrir base sempre visivel, acao obrigatoria para risco e eventos de acao/navegacao. Isso e teste de comportamento UI; ainda nao substitui uma suite canonica de qualidade de resposta por snapshots.
- `App.tsx` recebeu ajuste pequeno na nav mobile: rotulos visuais ocultos antes de `md`, `aria-label` preservado nos botoes e menor altura fisica da barra.
- Evidencia visual desta passada:
  - `test-results/ui-aicfo-desktop-2026-06-13.png`
  - `test-results/ui-aicfo-mobile-2026-06-13.png`
  - `test-results/ui-shell-dashboard-desktop-2026-06-13-v5.png`
  - `test-results/ui-aicfo-desktop-2026-06-13-v5.png`
  - `test-results/ui-shell-dashboard-mobile-2026-06-13-v5.png`
  - `test-results/ui-aicfo-mobile-2026-06-13-v5.png`
  - `test-results/ui-transactions-desktop-2026-06-13-v3.png`
  - `test-results/ui-transactions-mobile-2026-06-13-v3.png`
  - `test-results/ui-transactions-desktop-bulk-2026-06-13-v3.png`
  - `test-results/ui-transactions-mobile-bulk-2026-06-13-v3.png`
  - `test-results/ui-cashflow-desktop-2026-06-13-v1.png`
  - `test-results/ui-cashflow-mobile-2026-06-13-v2.png`
  - `test-results/ui-settings-desktop-2026-06-13-v1.png`
  - `test-results/ui-settings-mobile-2026-06-13-v3.png`
  - `test-results/ui-assistant-desktop-2026-06-13-v1.png`
  - `test-results/ui-assistant-mobile-2026-06-13-v3.png`
  - `test-results/ui-insights-desktop-2026-06-13-v2.png`
  - `test-results/ui-insights-mobile-2026-06-13-v2.png`
  - `test-results/ui-aicfo-real-use-desktop-2026-06-13-v1.png`
  - `test-results/ui-aicfo-real-use-mobile-2026-06-13-v1.png`
- Validacao desta passada: `npm run docs:check-mojibake`, `npx tsc -p tsconfig.app.json --noEmit --pretty false`, runner estavel de `transaction-list`, runner estavel de `cashflow-clarity`/`cashflow-clipboard-diagnostic`/`weekly-cash-review`, runner estavel de `settings-workspace-admin`/`settings-clipboard-diagnostic`, runner estavel de `assistant-reminder-states`/`assistant-smart-alerts-fallback`/`assistant-bulk-delete-escape`, runner estavel de `app-shell-navigation`, runner estavel de `insights-plan-render`, runner estavel de `aicfo-plan-render`, `npm run build` e `docs:check-links`.
- Risco residual desta passada: a bottom nav fixa ainda consome viewport mobile. Em `CashFlow`, ela nao cobre mais os controles internos nem o cabecalho do primeiro painel na captura 390px. Em `Settings` e `Assistant`, a nav mobile icon-only reduziu a obstrucao, mas ainda pode atravessar parte do conteudo na zona inferior do primeiro viewport por ser fixa/global; qualquer mudanca futura na shell deve tratar essa area como contrato visual.
- Contrato visual: `Insights` agora tem constantes locais (`PAGE_SURFACE`, `SOFT_SURFACE`, `ICON_SURFACE`) que provam a direcao, mas o contrato ainda nao esta extraido como sistema compartilhado. Por isso o item fica parcial, nao fechado globalmente.
- `services/geminiService.ts` recebeu hardening da resposta demo-local: `buildLocalCFOAnswer` agora resume a base financeira em leitura, risco, proxima acao e `Base resumida`, em vez de despejar trechos do contexto bruto.
- `src/ai/cfoEvaluation.ts` ganhou o trait `avoids_raw_context_leak` para impedir vazamento de marcadores internos como `=== DADOS`, `CONTAS:`, `TOTAL DE TRANSACOES`, `REGRA OPERACIONAL` e `CLASSIFICACAO DE CAIXA:`.
- `tests/unit/ai-cfo-evaluation.test.ts`, `tests/fixtures/ai/cfoEvaluationFixtures.ts` e `tests/health/ai-cfo-evaluation.health.test.ts` agora cobrem pergunta canonica, resposta demo concisa, explainability e ausencia de vazamento bruto.
- `App.tsx` recebeu ajuste pequeno no status superior: no mobile, o pill de demo/sync rola com a pagina em vez de ficar fixo cobrindo respostas longas; no desktop segue fixo.
- `pages/AICFO.tsx` recebeu padding inferior especifico na area rolavel de mensagens para preservar o ultimo cartao de resposta acima da bottom nav fixa.
- `tests/unit/aicfo-plan-render.test.tsx` e `tests/unit/app-shell-demo-status-spacing.test.tsx` cobrem a reserva de espaco da resposta e o respiro superior do status demo no shell.
- `src/app/visualSystem.ts` formaliza o contrato visual compartilhado: `workspace`, `section`, `interactiveCard`, `alert`, `modal` e movimentos `state`, `action`, `entrance`, `critical`.
- `components/Dashboard.tsx` passou a usar `VISUAL_SURFACES.workspace` e fechou o item parcial de primeiro viewport: a leitura inicial agora combina caixa real, previsto curto, pendente, vencido, atencao e ritual semanal em uma unica superficie de decisao.
- `components/Login.tsx` foi harmonizado com o produto operacional: saiu do hero/marketing e passou a comunicar `Revisao de caixa da semana`, `Caixa real`, `Previsto` e `Recebiveis`.
- `src/styles/tailwind.css` agora respeita `prefers-reduced-motion: reduce`, reduzindo animacoes/transicoes quando o sistema pede menos movimento.
- `scripts/capture-visual-regression.mjs` e `npm run visual:regression` criam uma regressao visual leve com screenshots desktop/mobile e manifest JSON.
- Evidencia visual adicional desta passada:
  - `test-results/ui-aicfo-demo-quality-mobile-top-viewport-2026-06-14-v2.png`
  - `test-results/ui-aicfo-demo-quality-mobile-response-viewport-2026-06-14-v2.png`
  - `test-results/ui-aicfo-demo-quality-desktop-2026-06-14-v2.png`
  - `test-results/ui-login-operational-desktop-2026-06-14-v1.png`
  - `test-results/ui-login-operational-mobile-2026-06-14-v1.png`
  - `test-results/visual-regression/2026-06-14T07-47-08-463Z/manifest.json`
- Validacao adicional desta passada: `git diff --check`, `npm run docs:check-mojibake`, `npx tsc -p tsconfig.app.json --noEmit --pretty false`, `node scripts/run-vitest-stable.mjs tests/unit/aicfo-plan-render.test.tsx tests/unit/app-shell-demo-status-spacing.test.tsx tests/unit/ai-cfo-evaluation.test.ts tests/health/ai-cfo-evaluation.health.test.ts tests/health/io-integrations.health.test.ts`, `npm run build` e `npm run docs:check-links`.
- Validacao de fechamento do dashboard: `node scripts/run-vitest-stable.mjs tests/unit/dashboard-quick-actions.test.tsx tests/unit/dashboard-metrics.test.ts tests/unit/weekly-cash-review.test.ts` e `npx tsc -p tsconfig.app.json --noEmit --pretty false`.
- Validacao visual adicional: `npm run visual:regression` passou com `12` screenshots, `6` rotas, `2` viewports, `consoleIssues=0` e `pageErrors=0`.
- Validacao visual do fechamento do dashboard: `test-results/visual-regression/2026-06-14T08-15-51-721Z/manifest.json` passou com `2` screenshots, `1` rota, `2` viewports, `consoleIssues=0` e `pageErrors=0`.
- Risco residual de IA: a resposta demo-local nao vaza mais contexto bruto na pergunta canonica validada, mas ainda falta prova com usuarios reais, custo real por consulta, avaliacao qualitativa externa e retencao atribuivel ao uso da IA.

## Atualizacao 2026-06-19 - harmonizacao UI operacional

- Execucao sob orquestracao GPT-5.5 com subagentes GPT-5.4-mini:
  - app shell/navegacao: `components/app-shell/AppMainNav.tsx`, `AppSubNav.tsx`, `AppTopStatus.tsx` e `src/styles/tailwind.css`;
  - IA/Insights: `pages/AICFO.tsx`, `pages/Insights.tsx` e `src/app/assistantCopy.ts`;
  - integracao final do dashboard e tokens visuais pelo orquestrador.
- `components/Dashboard.tsx` foi compactado em torno da sequencia operacional `caixa real -> previsto curto -> pendente/vencido -> atencao -> revisao semanal`, reduzindo repeticao de cards e mantendo os handlers financeiros existentes.
- `src/app/visualSystem.ts` ganhou superficies compartilhadas para `quietSection` e `decision`, usadas para reforcar o painel de decisao sem abrir uma nova linguagem visual.
- `pages/AICFO.tsx` e `src/app/assistantCopy.ts` reforcam o posicionamento `Consultor de caixa`: pergunta curta, resposta direta, evidencia usada e proximo passo. A copy evita promessa de CFO autonomo.
- `pages/Insights.tsx` foi reescrito para leitura operacional de caixa: `Leitura de caixa`, `Caixa agora`, `Horizonte curto`, `Base da leitura`, `Leituras acionaveis`, `Padrao de fluxo` e `Riscos imediatos`.
- `components/app-shell/*` reduziu peso visual, melhorou alvos de toque e alinhou nav principal, subnav e status superior em desktop/mobile.
- Correcao visual critica: valores negativos no dashboard agora renderizam como `R$ -2.380,00`, evitando quebra entre hifen e moeda nos cards de previsto.
- Testes/validacao desta rodada:
  - `npm run type-check:app`
  - `node scripts/run-vitest-stable.mjs tests/unit/dashboard-quick-actions.test.tsx tests/unit/dashboard-money-math.test.ts tests/unit/assistant-copy.test.ts tests/unit/insights-plan-render.test.tsx`
  - `npm run build`
  - `npm run visual:regression`
  - `git diff --check`
- Evidencia visual final: `test-results/visual-regression/2026-06-19T02-32-11-171Z/manifest.json` com 12 screenshots e status `PASS`.
- Limite de evidencia: esta rodada melhora legibilidade, consistencia e fluxo de decisao da UI. Nao prova retencao, conversao, preferencia de usuarios, disposicao a pagar ou habito recorrente.

## O que nao cortar agora

- Dashboard como primeira superficie.
- Ritual semanal.
- Previsto vs realizado.
- Recebiveis pendentes e vencidos como distintos de caixa.
- FAB de lancamento, desde que nao dispute com CTA principal.
- Indicador de sync, desde que nao ocupe prioridade permanente.

## O que cortar ou rebaixar visualmente

- Cards que nao sao interativos.
- Sombras em bloco de conteudo comum.
- Radius gigante em superficies de rotina.
- Pills informativas repetidas quando uma linha de status resolve.
- Copy explicativa que compete com numero financeiro.
- Prompts de IA soltos sem agrupamento por decisao.

## Ordem recomendada de execucao

1. Baseline visual com screenshot web/mobile.
2. Dashboard: hierarquia e primeiro viewport.
3. Login: reduzir energia de hero e reforcar confianca operacional.
4. IA: reorganizar para decisao guiada.
5. Revisao das telas secundarias para consistencia.
6. Atualizar scorecard e checklist final.

## Veredito de investimento nesta frente

Eu nao gastaria a proxima rodada adicionando feature.

Eu gastaria em tornar a experiencia central mais nitida: abrir, entender caixa, ver risco, registrar revisao e agir. So depois disso a IA deve ser elevada para uso real, porque IA em cima de uma superficie visual ruidosa vira gimmick.
