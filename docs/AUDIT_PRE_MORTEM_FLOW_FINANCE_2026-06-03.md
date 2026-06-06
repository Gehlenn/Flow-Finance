# Auditoria pre-mortem Flow Finance - 2026-06-03

Status: documento de auditoria e checklist de correcao. Atualizado em 2026-06-05 com fechamento dos P1 resolviveis por codigo/teste, fechamento local do P2 em exportacao Pro N/A, fechamento do gate externo de ativacao/retencao com evidencia real em `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.md` e `test-results/activation-retention-export/published-export-verified.json`, custo estimado de IA por workspace/resposta, carga multi-tenant sintetica, fechamento real do gate externo de performance em ambiente alvo, fechamento real do gate externo de Stripe com checkout/webhook/plan sync/portal no runtime publicado e ajuste do shell pos-signup do frontend para nao prender a experiencia em loading apos o perfil carregar.
Escopo: SaaS fintech de fluxo de caixa para empresas de servico, conectado a operacao real.  
Modo: pre-mortem. Premissa: o produto foi lancado e falhou; a auditoria identifica por que.

## 0. Regras de leitura

- Esta auditoria nao trata o Flow Finance como super-app financeiro generico.
- Open Banking, OCR, automacoes e "CFO autonomo" nao sao eixo principal do MVP nesta analise.
- Cada critica importante separa evidencia implementada, documentada, planejada ou inferida.
- Onde nao ha base suficiente, o documento usa `SEM EVIDENCIA SUFICIENTE`.
- Nenhuma metrica comercial foi inventada: nao ha CAC, LTV, churn, trafego, conversao ou receita real confirmada nesta auditoria.

## 1. Veredito executivo brutal

O Flow Finance tem um nucleo de produto correto e os P1 de codigo encontrados nesta auditoria foram tratados: promessa Pro falsa removida, auth/billing endurecidos, onboarding acionavel criado, zero-state corrigido, IA reancorada no caixa operacional, mobile/FAB ajustados e gates criticos executados.

Nao ha P0 confirmado nesta auditoria. Em 2026-06-05, nao ha P1 de codigo aberto com a evidencia local revisada. O gate P1 operacional de Stripe foi fechado no runtime publicado: o backend agora responde com `workspacePersistence.mode=firebase`, checkout Stripe hosted real concluiu com `payment_status=paid`, a API do Stripe mostrou eventos reais com `pending_webhooks=0`, o workspace publicado passou a retornar `currentPlan=pro`, `hasBillingCustomer=true` e `stripePortalEnabled=true`, e `POST /api/saas/stripe/portal-session` retornou URL valida. O gate externo de ativacao/retencao tambem foi fechado no backend publicado com export real autenticado e checker PASS; o shell pos-signup do frontend foi reduzido para liberar a experiencia apos o perfil carregar.

Veredito comercial: eu ainda nao chamaria de SaaS pronto para escala, porque o fechamento do gate de ativacao/retencao nao prova recorrencia ampla nem corrige o shell do frontend publicado. Mas eu liberaria piloto privado controlado com billing publicado real ja validado e com a evidencia de coorte real anexada.

## 2. Pre-mortem: por que falhou

1. O cliente entrou, mas nao chegou rapido ao primeiro momento de valor.
   - Evidencia implementada: `App.tsx:300-330`, `components/Login.tsx:215-350`, `components/NamePromptModal.tsx:24-46`.
   - Problema original: login e nome aparecem antes de um fluxo guiado de "importe/crie 3 entradas e veja sua semana de caixa".
   - Correcao aplicada: `components/Login.tsx` agora declara acima do formulario que o produto e fluxo de caixa para empresas de servico; `components/Dashboard.tsx` inclui ativacao acionavel com saldo inicial, entrada, saida e recebivel, ligada a `onCreateAccount`, `onAddTransactions` e `onAddReminder`.

2. O produto prometeu recursos pagos que nao entrega.
   - Evidencia implementada: `pages/Pricing.tsx:8-18`, `src/app/monetizationPlan.ts:75-79`, `backend/src/billing/billingService.ts:62-69`.
   - Problema original: exportacao de relatorios/PDF aparecia como Pro, mas o backend retorna 501.
   - Correcao aplicada: promessa de exportacao foi removida do Pro ate existir backend real.

3. A navegacao fez o Flow parecer plataforma generica, nao uma ferramenta afiada de fluxo de caixa.
   - Evidencia implementada: `src/app/mainNavigation.ts:16-57`, `App.tsx:450-539`.
   - Problema: areas como IA, Auditoria, Lab IA dev, Performance dev, Workspace e Operacao competem com caixa, transacoes e receita prevista vs realizada.

4. O dashboard passou tranquilidade falsa quando nao havia dados.
   - Evidencia implementada: `components/Dashboard.tsx:278-318`.
   - Problema original: com valores zerados ou insuficientes, a mensagem podia sugerir "Caixa sob controle".
   - Correcao aplicada: zero-state agora informa falta de dados e abre a ativacao de caixa.

5. A IA consultiva soou mais generica que especifica.
   - Evidencia implementada: `backend/src/controllers/aiController.ts:51-61`, `backend/src/controllers/aiController.ts:186-203`, `backend/src/services/ai/AISecurityGuard.ts:68-86`.
   - Problema original: prompts falavam em "cerebro financeiro", gestao pessoal e relatorios estrategicos amplos, diluindo o caso de uso de caixa operacional.
   - Correcao aplicada: prompts de interpretacao, leitura semanal, CFO e guardrail de IA agora reforcam caixa operacional, empresas de servico, previsto vs realizado, recebiveis e proxima acao; `pages/AICFO.tsx` e `backend/src/controllers/aiController.ts` mostram fallback com diagnostico, baixa confianca e profundidade reduzida.

6. A seguranca tinha controles bons, mas algumas bordas financeiras ficaram permissivas.
   - Evidencia implementada: `backend/src/routes/saas.ts:56-68`, `backend/src/routes/saas.ts:115-162`, `backend/src/services/auth/authCookies.ts:10-20`, `backend/src/routes/auth.ts:46`, `firestore.rules:241`.
   - Problema: billing/uso SaaS usa membership simples em algumas rotas; cookie auth nao mostrou CSRF explicito; `billing_hooks` pode ser criado por membro no Firestore.

7. O teste/documentacao prometeu uma rotina critica que nao existe exatamente.
   - Evidencia original: `package.json` nao continha `test:critical`; existia `test:coverage:critical`.
   - Correcao aplicada: `package.json` agora tem `test:critical` como alias de `test:coverage:critical`.

8. O produto nao provou habito em escala, mas o gate operacional de ativacao/retencao foi fechado.
   - Evidencia: `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`, `test-results/activation-retention-export/published-export-verified.json`.
   - Problema: o fechamento prova uma coorte real publicada, mas nao substitui prova de uso recorrente amplo nem elimina a necessidade de acompanhar a experiencia do shell em producao.

## 3. Evidencia por tipo

### Implementado

- Navegacao principal: `src/app/mainNavigation.ts:16-57`.
- Shell web/mobile, bottom nav e FAB: `App.tsx:404-460`.
- Login, demo e nome inicial: `components/Login.tsx:215-350`, `components/NamePromptModal.tsx:24-46`.
- Dashboard e mensagens de estado: `components/Dashboard.tsx:278-318`, `components/Dashboard.tsx:433-612`.
- Pricing e plano Pro: `pages/Pricing.tsx:8-18`, `pages/Pricing.tsx:84-148`, `src/app/monetizationPlan.ts:5-15`, `src/app/monetizationPlan.ts:153-156`.
- Billing export nao implementado: `backend/src/billing/billingService.ts:62-69`.
- Integracao operacional minima: `backend/src/routes/businessIntegration.ts:21-49`, `backend/src/validation/businessIntegration.schema.ts:1-139`, `backend/src/services/businessIntegrationService.ts:75-194`.
- Auth, cookies, SaaS routes, webhooks, Firestore rules: `backend/src/middleware/auth.ts:56-78`, `backend/src/services/auth/authCookies.ts:10-20`, `backend/src/routes/saas.ts:56-162`, `backend/src/services/saas/stripeService.ts:151-198`, `firestore.rules:140-296`.
- IA backend: `backend/src/controllers/aiController.ts:51-61`, `backend/src/controllers/aiController.ts:186-316`, `backend/src/services/ai/AISecurityGuard.ts:68-86`.

### Documentado

- Direcao de produto: `E:/app e jogos criados/obsidian-vault/Projetos/Core/Product Plan.md`.
- Regras do projeto: `E:/app e jogos criados/obsidian-vault/Projetos/Core/Project Rules.md`.
- Tarefas atuais: `E:/app e jogos criados/obsidian-vault/Projetos/Core/Code Tasks.md`.
- Modelo de integracao operacional: `E:/app e jogos criados/obsidian-vault/Projetos/Planning/2026-04-flow-focus/02_BUSINESS_INTEGRATION_MODEL.md`.
- Arquitetura de IA/input: `E:/app e jogos criados/obsidian-vault/Projetos/Planning/2026-04-flow-focus/03_AI_AND_INPUT_ARCHITECTURE.md`.
- Oferta e monetizacao: `E:/app e jogos criados/obsidian-vault/Projetos/Planning/2026-04-flow-focus/06_PRODUCT_AND_OFFER_MODEL.md`.
- Contrato de integracao: `E:/app e jogos criados/obsidian-vault/Projetos/Planning/2026-04-flow-focus/07_BUSINESS_INTEGRATION_CONTRACT.md`.

### Planejado

- Simplificar app em torno de caixa, transacoes, previsto vs realizado, IA consultiva e ligacao operacional.
  - Evidencia documentada: `E:/app e jogos criados/obsidian-vault/Projetos/Core/Code Tasks.md`.
- Manter Flow separado de servico de automacao.
  - Evidencia documentada: `06_PRODUCT_AND_OFFER_MODEL.md`.
- Receber sinais operacionais leves, sem virar base rica de operacao/CRM.
  - Evidencia documentada: `02_BUSINESS_INTEGRATION_MODEL.md`.

### Inferido

- O produto esta mais perto de piloto privado do que de SaaS pago publico.
  - Inferencia baseada em P1s encontrados, validacoes passadas, gate de ativacao/retencao ja fechado com evidencias publicadas e ausencia de metricas amplas/historicas de recorrencia.
- O preco de R$49/mes nao e o principal problema.
  - Inferencia baseada em concorrentes com planos publicos acima ou similares, mas com ressalva: valor percebido depende de clareza do diferencial.

## 4. Scorecard por area

### 1. Produto e proposta de valor

- Nota: 7/10
- Confianca: alta
- Evidencia usada: Product Plan; `01_PRODUCT_SCOPE_AND_POSITIONING.md`; `components/Dashboard.tsx:433-612`; `backend/src/services/businessIntegrationService.ts:75-194`.
- Principal problema: a tese e boa, mas a experiencia ainda nao obriga o usuario a enxergar "meu caixa da semana e o que fazer agora".
- Impacto comercial: conversao e retencao ficam dependentes de explicacao externa.
- Impacto tecnico: features perifericas continuam competindo por manutencao.
- Risco se ignorar: virar mais um painel financeiro, sem urgencia de compra.
- Correcao recomendada: transformar a proposta em fluxo: entradas confirmadas, saidas, recebiveis em risco, previsto vs realizado e acao recomendada.
- Esforco estimado: medio.
- Prioridade: P1.

### 2. Foco do MVP

- Nota: 6/10
- Confianca: alta
- Evidencia usada: `src/app/mainNavigation.ts:16-57`, `App.tsx:450-539`, `pages/WorkspaceAdmin.tsx:391-648`, `pages/WorkspaceAudit.tsx:196-217`.
- Principal problema: o MVP ainda mostra cara de plataforma com admin, auditoria, lab e performance.
- Impacto comercial: onboarding fica confuso; pitch perde especificidade.
- Impacto tecnico: aumenta superficie de regressao antes de validar o core.
- Risco se ignorar: o produto falha por dispersao, nao por falta de codigo.
- Correcao recomendada: esconder do fluxo principal tudo que nao serve caixa/transacao/previsto-realizado/decisao semanal.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 3. UX/UI web

- Nota: 6/10
- Confianca: media
- Evidencia usada: `App.tsx:404-460`, `components/Dashboard.tsx:278-318`, `components/Dashboard.tsx:433-612`.
- Principal problema: a hierarquia existe, mas a shell fixa e mensagens de estado reduzem confianca.
- Impacto comercial: o usuario pode abandonar antes de entender a decisao principal.
- Impacto tecnico: layout fixo cria risco de sobreposicao e comportamento diferente entre breakpoints.
- Risco se ignorar: experiencia parece polida em screenshot, mas cansativa em uso real.
- Correcao recomendada: revisar shell, FAB, bottom nav e estados vazios; subir risco/proxima acao acima da dobra.
- Esforco estimado: medio.
- Prioridade: P1.

### 4. UX/UI mobile

- Nota: 6/10
- Confianca: media
- Evidencia usada: `App.tsx:404-460`, `components/Dashboard.tsx:433-557`, `pages/AICFO.tsx` com tipografia pequena em trechos apontados na auditoria.
- Principal problema: o mobile nao prioriza agressivamente risco e proxima decisao no primeiro viewport.
- Impacto comercial: empresas pequenas podem usar no celular; se a tela inicial nao responde rapido, o habito nao nasce.
- Impacto tecnico: fixed nav + FAB aumenta chance de colisao visual.
- Risco se ignorar: mobile vira versao comprimida do web.
- Correcao recomendada: primeiro viewport mobile deve mostrar caixa atual, saldo projetado, maior risco e uma acao primaria.
- Esforco estimado: medio.
- Prioridade: P1.

### 5. Onboarding e ativacao

- Nota: 5/10
- Confianca: alta
- Evidencia usada: `App.tsx:300-330`, `components/Login.tsx:215-350`, `components/NamePromptModal.tsx:24-46`, `pages/ImportTransactions.tsx:383-444`, `pages/ImportTransactions.tsx:618-621`.
- Principal problema: ha login e nome, mas nao ha ativacao guiada para primeiro valor financeiro.
- Impacto comercial: trial/free nao converte se o usuario nao ve valor em minutos.
- Impacto tecnico: dados iniciais podem ficar insuficientes para dashboard e IA.
- Risco se ignorar: churn antes da primeira decisao util.
- Correcao recomendada: criar onboarding de 3 passos: saldo inicial, 3 entradas/saidas, 1 recebivel pendente; depois mostrar previsto vs realizado.
- Esforco estimado: medio.
- Prioridade: P1.

### 6. Retencao e habito

- Nota: 5/10
- Confianca: media
- Evidencia usada: `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`, `test-results/activation-retention-export/published-export-verified.json`; lembretes e receitas existem em codigo, mas a prova agora e de coorte real fechada, nao de escala ampla.
- Principal problema: a prova de uma coorte real existe, mas ainda nao prova recorrencia ampla em escala.
- Impacto comercial: sem recorrencia ampla, o produto ainda pode virar ferramenta eventual.
- Impacto tecnico: dificil priorizar eventos, alertas e IA sem loop de uso definido em escala.
- Risco se ignorar: usuarios podem ativar uma vez e nao voltar em volume suficiente.
- Correcao recomendada: desenhar "Revisao de caixa da semana" como rotina central, com tarefas fechaveis, e acompanhar a repeticao real desse loop.
- Esforco estimado: medio.
- Prioridade: P1.

### 7. IA consultiva / AI CFO

- Nota: 6/10
- Confianca: media
- Evidencia usada: `backend/src/controllers/aiController.ts:51-61`, `backend/src/controllers/aiController.ts:186-316`, `backend/src/services/ai/AISecurityGuard.ts:68-86`, `src/ai/aiCFO.ts`.
- Principal problema: a IA ainda tem linguagem e contrato amplos demais para o core de caixa operacional.
- Impacto comercial: "AI CFO" pode soar como promessa generica e arriscada.
- Impacto tecnico: respostas amplas aumentam necessidade de guardrails, observabilidade e testes.
- Risco se ignorar: perda de confianca quando a IA falar alem do dado disponivel.
- Correcao recomendada: reposicionar como consultor de clareza de caixa: o que mudou, o que esta em risco, qual acao tomar e com qual confianca.
- Esforco estimado: medio.
- Prioridade: P1.

### 8. Dashboard e fluxo financeiro

- Nota: 7/10
- Confianca: alta
- Evidencia usada: `components/Dashboard.tsx:278-318`, `components/Dashboard.tsx:433-612`, `backend/src/services/businessIntegrationService.ts:75-194`.
- Principal problema: boa base, mas zero-state e ordem visual podem gerar conclusao errada.
- Impacto comercial: dashboard e o principal motivo de compra; se ele falha, o SaaS falha.
- Impacto tecnico: precisa distinguir confirmado, previsto, pendente, atrasado e lembrete sem ambiguidade.
- Risco se ignorar: decisoes financeiras erradas por leitura superficial.
- Correcao recomendada: card principal deve separar caixa real, saldo projetado e recebiveis em risco; zero-state deve pedir dados, nao tranquilizar.
- Esforco estimado: medio.
- Prioridade: P1.

### 9. Arquitetura frontend

- Nota: 6/10
- Confianca: media
- Evidencia usada: `App.tsx:46-56`, `App.tsx:120-249`, `src/app/mainNavigation.ts:16-57`.
- Principal problema: shell central concentra muita decisao de navegacao, contexto e exibicao.
- Impacto comercial: iterar o MVP fica mais lento e arriscado.
- Impacto tecnico: aumento de acoplamento entre auth, plano, workspace, navegacao e fluxo financeiro.
- Risco se ignorar: cada mudanca de produto vira risco de regressao visual e de estado.
- Correcao recomendada: extrair fluxo de ativacao e shell por responsabilidades, preservando comportamento.
- Esforco estimado: medio.
- Prioridade: P2.

### 10. Arquitetura backend

- Nota: 7/10
- Confianca: alta
- Evidencia usada: `backend/src/routes/businessIntegration.ts:21-49`, `backend/src/middleware/businessIntegrationContract.ts:43-79`, `backend/src/middleware/externalIntegrationAuth.ts:84-245`, `backend/src/middleware/integrationBindingScope.ts:33-69`, `backend/src/services/businessIntegrationService.ts:75-194`.
- Principal problema: core de integracao e bom, mas bordas SaaS/billing/webhook ainda precisam endurecer.
- Impacto comercial: confianca de fintech depende menos de features e mais de previsibilidade operacional.
- Impacto tecnico: rotas financeiras exigem autorizacao e idempotencia consistentes.
- Risco se ignorar: incidente pequeno em billing/auth destrui credibilidade.
- Correcao recomendada: padronizar authz por permissao em todas as superficies SaaS e revisar replay/dedupe.
- Esforco estimado: medio.
- Prioridade: P1.

### 11. Firebase, dados e seguranca

- Nota: 6/10
- Confianca: alta
- Evidencia usada: `firestore.rules:57`, `firestore.rules:140-249`, `firestore.rules:241`, `firestore.rules:272-296`.
- Principal problema: regras tem isolamento geral, mas `billing_hooks` pode ser criado por membro via cliente.
- Impacto comercial: dados financeiros e billing nao toleram ambiguidade de escrita.
- Impacto tecnico: permissao client-side em colecao sensivel aumenta superficie de abuso/erro.
- Risco se ignorar: integridade de eventos financeiros/billing questionavel.
- Correcao recomendada: tornar `billing_hooks` server-only e cobrir com teste de regras.
- Esforco estimado: baixo.
- Prioridade: P1.

### 12. Performance e escala

- Nota: 7/10
- Confianca: media
- Evidencia usada: `npm run health:runtime`, `npm run health:runtime:mobile`, `npm run health:vercel`, `npm run type-check`.
- Principal problema: o gate externo de performance em alvo ja tem evidencia real, mas ainda nao ha carga multi-tenant sintetica em ambiente alvo.
- Impacto comercial: piloto pequeno provavelmente suporta; escala paga ainda nao provada.
- Impacto tecnico: falta baseline publico de latencia, custo por workspace e throughput de integracao sob carga sintetica.
- Risco se ignorar: degradacao aparece junto com os primeiros clientes reais.
- Correcao recomendada: criar baseline de carga para dashboard, IA e integracao de transacoes.
- Esforco estimado: medio.
- Prioridade: P2.

### 13. Observabilidade e operacao

- Nota: 7/10
- Confianca: alta
- Evidencia usada: `npm run health:vercel` retornou `/health`, `/api/health`, `/api/version` saudaveis; docs de operacao existem em `./OPERATIONS_README.md`, `./SENTRY_SETUP.md`; eventos adicionados em `src/app/productAnalytics.ts`, `src/app/financeService.ts`, `components/Dashboard.tsx`, `pages/AICFO.tsx`, `src/saas/billingClient.ts`, `src/saas/billingHooks.ts`; o gate de ativacao/retencao foi fechado com `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json` e `test-results/activation-retention-export/published-export-verified.json`; dedupe opaco e redaction de IDs em `src/app/productAnalytics.ts` e `src/utils/logger.ts`.
- Principal problema: observabilidade de ativacao e billing agora existe e a coorte real foi fechada, mas ainda falta prova de funil amplo e analise de escala continua.
- Impacto comercial: sem funil operacional amplo, falhas silenciosas viram churn.
- Impacto tecnico: health check nao substitui tracing de jornada.
- Risco se ignorar: producao "verde" enquanto o uso recorrente amplo nao se consolida.
- Correcao recomendada: instrumentar eventos de primeira transacao, primeiro dashboard util, consulta IA util, checkout e erro de integracao; manter exportacao fora do Pro enquanto nao houver backend real, mas sem tratar o gate de ativacao/retencao como aberto.
- Esforco estimado: medio.
- Prioridade: P2.

### 14. Monetizacao, pricing e assinatura

- Nota: 6/10
- Confianca: alta
- Evidencia usada: `pages/Pricing.tsx:8-18`, `pages/Pricing.tsx:84-148`, `src/app/monetizationPlan.ts:5-15`, `src/app/monetizationPlan.ts:153-156`, `backend/src/docs/openapiFragments.ts:1297-1298`, `src/saas/billingClient.ts:108-151`, `components/Settings.tsx:384-447`, `pages/WorkspaceAdmin.tsx:276-337`.
- Principal problema: a promessa paga de exportacao foi removida e preco ativo foi alinhado; checkout/portal publicados ja foram validados ponta a ponta, mas o endpoint legado de exportacao segue 501 fora do Pro.
- Impacto comercial: menor risco de promessa falsa; venda paga ja tem prova real de billing publicado, mas a oferta Pro ainda depende de decidir se exportacao volta ou sai definitivamente da narrativa.
- Impacto tecnico: testes unitarios cobrem lifecycle de billing, mas a integracao de billing ainda nao roda no runner padrao.
- Risco se ignorar: funil de conversao medido incorretamente ou checkout quebrado so descoberto por usuario pagante.
- Correcao recomendada: manter o fluxo Stripe publicado como baseline validada, ajustar o runner/documentacao para refletir o passo browser real e so recolocar exportacao se houver backend/teste real.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 15. Mercado, concorrencia e diferenciacao

- Nota: 6/10
- Confianca: media
- Evidencia usada: fontes publicas de pricing/posicionamento consultadas em 2026-06-03: Conta Azul, Nibo, Granatum, Conta no Azul, QuickBooks Brasil encerrado.
- Principal problema: preco de R$49/mes pode ser aceitavel, mas diferenciacao precisa ser mais clara que "dashboard + IA".
- Impacto comercial: concorrentes tem marca, suite e distribuicao; Flow precisa vencer por foco.
- Impacto tecnico: construir suite para competir frontalmente seria erro de escopo.
- Risco se ignorar: entrar num mercado com incumbentes sem uma razao forte para trocar.
- Correcao recomendada: competir por clareza operacional de caixa para servicos, nao por contabilidade completa.
- Esforco estimado: medio.
- Prioridade: P1.

Fontes externas usadas:

- Conta Azul: https://contaazul.com/planos
- Nibo: https://www.nibo.com.br/empresa/planos-e-precos
- Granatum: https://www.granatum.com.br/financeiro/precos-planos
- Conta no Azul: https://contanoazul.com.br/
- QuickBooks Brasil encerrado: https://quickbooks.intuit.com/br/ e https://www.startse.com/artigos/quickbooks-brasil-encerramento-operacoes/

### 16. Risco de parecer generico

- Nota: 5/10
- Confianca: alta
- Evidencia usada: `src/app/mainNavigation.ts:16-57`, `backend/src/controllers/aiController.ts:51-61`, `backend/src/services/ai/AISecurityGuard.ts:68-86`.
- Principal problema: a combinacao de IA ampla, lab, auditoria, performance, workspace e varias secoes faz o produto parecer generico.
- Impacto comercial: usuario nao entende por que este SaaS existe.
- Impacto tecnico: times futuros tenderao a adicionar mais features laterais.
- Risco se ignorar: produto vira "app financeiro com IA", categoria saturada e fraca.
- Correcao recomendada: linguagem e navegacao devem repetir obsessivamente o core: caixa, previsto, realizado, risco e acao.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 17. Prontidao para producao

- Nota: 7/10
- Confianca: alta
- Evidencia usada: validacoes executadas nesta auditoria, incluindo o export real backend-autenticado de ativacao/retencao e o checker PASS.
- Principal problema: P1s de codigo foram fechados, billing publicado real foi validado e o gate de ativacao/retencao tambem foi fechado, mas producao paga ampla ainda depende de metricas de recorrencia e escala.
- Impacto comercial: vender sem prova de recorrencia ampla ainda gera risco de suporte e churn.
- Impacto tecnico: Firestore rules passaram com JDK 21 portatil; `test:critical` foi alinhado como alias de `test:coverage:critical`; runtime web/mobile, health Vercel e o gate de ativacao/retencao passaram.
- Risco se ignorar: confundir "gates fechados" com "SaaS escalavel validado".
- Correcao recomendada: manter monitoramento de ativacao e retencao semanal como metricas de produto, mas nao como gate operacional aberto; Stripe published e activation/retention ja sairam da lista de bloqueios.
- Esforco estimado: medio.
- Prioridade: P1.

## 5. Validacoes executadas

Passou:

- `npm run health:vercel`
  - `/health`, `/api/health`, `/api/version` saudaveis.
  - `/` retornou 404 esperado para API-only.
- `npm run type-check`
- `npm run test:critical`
  - Alias de `npm run test:coverage:critical`.
  - 10 arquivos de teste, 171 testes.
- `npx vitest run backend/tests/unit/ai-controller-observability.test.ts backend/tests/unit/ai-controller-cfo-input.test.ts backend/tests/unit/ai-security-guard.test.ts`
  - 3 arquivos de teste, 49 testes.
- `npx vitest run tests/unit/product-analytics.test.ts tests/unit/useFinancialState.test.tsx tests/unit/aicfo-plan-render.test.tsx tests/unit/workspace-admin-page.test.tsx tests/unit/settings-workspace-admin.test.tsx`
  - 5 arquivos de teste, 34 testes.
- `npx vitest run tests/unit/billing-client.test.ts tests/unit/product-analytics.test.ts tests/unit/finance-service.test.ts tests/unit/useFinancialState.test.tsx`
  - 4 arquivos de teste, 23 testes.
- `npx vitest run tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/workspace-admin-page.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/billing-client.test.ts`
  - 4 arquivos de teste, 25 testes.
- `npx vitest run tests/unit/product-analytics.test.ts tests/unit/logger.test.ts tests/unit/billing-client.test.ts tests/unit/pricing-upgrade-checkout.test.tsx`
  - 4 arquivos de teste, 12 testes.
- `npx vitest run tests/unit/dashboard-metrics.test.ts tests/unit/dashboard-quick-actions.test.tsx tests/unit/app-shell-navigation.test.tsx`
  - 3 arquivos de teste, 15 testes.
- `npm run test:firestore:rules` com `JAVA_HOME` apontando para JDK 21 portatil em `%TEMP%`.
  - 3 arquivos de teste, 16 testes.
- `npx playwright test tests/e2e/billing.spec.ts --project=chromium --workers=1`
  - 2 testes E2E de billing/settings/workspace admin.
- `npm run test:coverage:critical`
  - 10 arquivos de teste, 171 testes.
  - Branch coverage reportado: 98.15%.
- `npm run docs:check-mojibake`
- `npm run validate:e2e:matrix:dry`
- `npm run health:runtime`
- `npm run health:runtime:mobile`

Falhou ou ficou bloqueado:

- Smoke de checkout Stripe real
  - Fechado em 2026-06-05: a tentativa publicada real final provou signup/autenticacao Firebase, troca server-side com o backend, criacao de workspace, `checkout-session` com URL Stripe real, pagamento hosted concluido, eventos Stripe reais entregues, mudanca de plano do workspace para `pro` e `portal-session` com URL valida.
- `npm run health:stripe-live-smoke`
  - Bloqueio correto: gera artefato em `test-results/stripe-live-smoke/` e mantem `BLOCK` sem backend alvo, bearer token, workspace ou comprovacao real do fluxo completo.
- `npm run health:activation-retention`
  - PASS: export real backend-autenticado fechado em `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, checker PASS em `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json` e handoff verificado em `test-results/activation-retention-export/published-export-verified.json`.
  - O runner continua retornando `SEM EVIDENCIA SUFICIENTE` quando faltar export real/cohort window, mas isso agora e apenas comportamento de refresh futuro.
- `npm run health:target-performance -- --target-url https://flow-finance-frontend-nine.vercel.app`
  - PASS: gerou `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json` e `.md`.
  - metricas capturadas: `navigationDurationMs 1656ms`, `domContentLoadedMs 1656ms`, `loadEventMs 1656ms`, `resourceCount 61`.
- `npx vitest run backend/tests/integration/billing.integration.test.ts`
  - Falha: configuracao padrao nao encontra esse teste porque `backend/tests/integration/**` esta excluido.

## 6. Top 15 riscos ordenados por severidade

| Rank | Severidade | Risco | Evidencia | Impacto | Acao |
| --- | --- | --- | --- | --- | --- |
| 1 | P1 | Plano Pro prometia exportacao, backend retorna 501 | `pages/Pricing.tsx:8-18`, `backend/src/docs/openapiFragments.ts:1297-1298` | Corrigido no pricing; risco volta se exportacao for recolocada sem backend | Mantido removido do Pro ate implementar export real |
| 2 | P1 | Superficie SaaS/billing usa membership simples em rotas de uso | `backend/src/routes/saas.ts:56-68`, `backend/src/routes/saas.ts:115-162` | Risco de autorizacao em area sensivel | Fechado: authz por permissao aplicada |
| 3 | P1 | Cookie auth sem CSRF/origin explicito na evidencia revisada | `backend/src/services/auth/authCookies.ts:10-20`, `backend/src/routes/auth.ts:46` | Risco em sessao e refresh | Fechado: CSRF/origin check |
| 4 | P1 | Stripe webhook sem dedupe/tolerancia temporal visivel | `backend/src/services/saas/stripeService.ts:151-198`, `backend/src/routes/saas.ts:70-113` | Replay/eventos duplicados | Fechado: timestamp tolerance e event id dedupe |
| 5 | P1 | Firestore permite create de `billing_hooks` por membro | `firestore.rules:57`, `firestore.rules:241` | Integridade de billing | Fechado: server-only e emulator passou |
| 6 | P1 | Onboarding nao guia ate primeiro valor financeiro | `components/Dashboard.tsx` | Baixa ativacao | Fechado: ativacao com saldo, entrada, saida e recebivel |
| 7 | P1 | Dashboard pode dizer "Caixa sob controle" sem dados suficientes | `components/Dashboard.tsx:278-318` | Decisao errada | Fechado: zero-state honesto |
| 8 | P1 | Mobile nao prioriza risco/proxima acao no primeiro viewport | `components/Dashboard.tsx:433-557` | Baixo habito mobile | Fechado: dashboard reordenado e runtime mobile passou |
| 9 | P1 | Fixed nav + FAB podem competir/sobrepor experiencia | `App.tsx:404-460` | Friccao de uso | Fechado: safe-area/padding e teste de shell |
| 10 | P1 | IA consultiva tem linguagem ampla/generica | `backend/src/controllers/aiController.ts:51-61`, `AISecurityGuard.ts:68-86` | Perda de confianca | Fechado: prompt restrito a caixa operacional |
| 11 | P2 | Preco antigo ainda existe em evidencia historica | `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`, `docs/MONETIZATION_FREE_PRO_PHASE6.md`, `src/app/monetizationPlan.ts:153-156` | Confusao se documento historico virar fonte ativa | Manter R$49/R$490 como fonte ativa e tratar R$29,90 como historico |
| 12 | P2 | Retencao/habito ainda precisa provar recorrencia ampla | `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json` | Churn precoce em escala | Criar ritual semanal e eventos e medir repeticao real |
| 13 | P2 | Open Banking/Pluggy pode puxar escopo lateral | `backend/src/controllers/bankingController.ts` evidencias revisadas de webhook/secret opcional | Dispersao e risco | Tirar do eixo do MVP |
| 14 | P2 | Script critico documentado como expectativa, mas ausente | `package.json`, validacao `npm run test:critical` | Gate confuso | Padronizar script |
| 15 | P2 | Teste Firestore dependia de Java 21 e porta 8080 livre | `npm run test:firestore:rules` | Regra sensivel sem validacao local | Fechado localmente: JDK 21 portatil e porta dinamica |

## 7. O que cortar do MVP

- Cortar da navegacao principal: Lab IA dev, Performance dev, Auditoria e Workspace Admin para usuarios comuns.
- Cortar promessa de exportacao Pro enquanto retornar 501.
- Cortar linguagem de "CFO autonomo" ou "cerebro financeiro" como eixo.
- Cortar Open Banking como narrativa primaria do MVP.
- Cortar OCR/scanner como promessa central se nao for o caminho principal de ativacao.
- Cortar relatorios estrategicos amplos antes de provar dashboard diario/semanal.
- Cortar qualquer tela que nao responda uma destas perguntas:
  - Quanto tenho de caixa real?
  - O que deve entrar?
  - O que ja saiu?
  - O que esta em risco?
  - O que preciso fazer esta semana?

## 8. O que dobrar como diferencial

- Revisao semanal de caixa para empresas de servico.
- Receita prevista vs realizada como grafico e como decisao.
- Recebiveis pendentes fora do caixa real, com risco claro.
- Transacoes uteis, nao extrato infinito.
- Ligacao operacional minima por `transactions` e `reminders`, sem virar CRM.
- IA consultiva com confianca, limite e acao concreta.
- Dashboard que mostra "o que mudou desde a ultima revisao".
- Linguagem de produto: "clareza de caixa para decidir a semana", nao "financas com IA".

## 9. Plano de correcao

### Imediato

- [x] Remover ou desabilitar promessa de exportacao Pro ate existir implementacao real.
- [x] Corrigir zero-state do dashboard para nao afirmar controle sem dados.
- [x] Esconder rotas/dev/admin da navegacao principal para usuario comum.
- [x] Aplicar authz por permissao nas rotas SaaS sensiveis.
- [x] Tornar `billing_hooks` server-only nas regras Firestore.
- [x] Adicionar protecao CSRF/origin para refresh cookie.
- [x] Adicionar dedupe e tolerancia temporal no webhook Stripe.
- [x] Alinhar `test:critical` vs `test:coverage:critical`.

### Pre-lancamento

- [x] Criar onboarding de ativacao com saldo inicial, entradas/saidas e recebivel pendente.
- [x] Reordenar mobile para mostrar caixa, risco e acao no primeiro viewport.
- [x] Reescrever prompts de IA para caixa operacional e decisao semanal.
- [x] Instrumentar eventos: primeira transacao, primeiro dashboard util, primeira consulta IA util, checkout e erro de integracao. Exportacao: nao aplicavel enquanto removida do Pro.
- [x] Evitar identificadores crus em dedupe de analytics e logs de billing/operacao.
- [x] Rodar Firestore rules em ambiente com Java 21+.
- [x] Incluir teste de billing export no runner padrao ou remover expectativa ate implementar. Resolvido por remocao da expectativa Pro; exportacao segue N/A no Pro atual.

### Pos-MVP

- [x] Manter exportacao fora do Pro ate existir backend real. Evidencia: `pages/Pricing.tsx`, `backend/src/billing/billingService.ts` e `backend/src/docs/openapiFragments.ts` mantem a promessa removida; recurso segue N/A no Pro atual.
- [x] Criar relatorio semanal de caixa com historico de revisoes. Evidencia: `src/finance/weeklyCashReview.ts` gera relatorio semanal, persiste historico por workspace e `tests/unit/weekly-cash-review.test.ts` cobre calculo/historico.
- [x] Medir retencao por ritual: usuarios que completam revisao semanal. Evidencia: `src/finance/weeklyCashReview.ts` expoe `measureWeeklyCashReviewRetention(...)`, `weekly_cash_review_completed` registra conclusao do ritual, `tests/unit/weekly-cash-review.test.ts` cobre a medicao local e o export real publicado fechou a coorte operacional em `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`. Ressalva: isso nao prova escala ampla nem recorrencia prolongada.
- [x] Criar baseline de performance para dashboard, IA e integracao. Harness criado em `tests/e2e/performance.spec.ts` e documentado em `docs/PERFORMANCE_BASELINE_2026-06-04.md`; rodada local gerou `test-results/performance-baseline/chromium-dashboard.json` e o gate externo foi fechado com `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`.
- [x] Avaliar Open Banking apenas como acelerador de dados, nao como tela principal. Evidencia: `backend/src/middleware/featureGate.ts`, `backend/src/config/env.ts`, `backend/src/controllers/bankingController.ts`, `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md` e `backend/tests/unit/featureGate.middleware.test.ts`.

### Escala

- [x] Definir SLOs por fluxo: login, dashboard, ingestao, IA, billing. Evidencia: `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md`; SLOs sao alvos de piloto, nao metricas historicas comprovadas.
- [x] Criar runbook de incidente para billing/auth/dados financeiros. Evidencia: `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md` com severidade, triagem por fluxo, comandos e criterios de fechamento.
- [x] Adicionar dedupe/auditoria completa para eventos financeiros externos. Evidencia local: `backend/src/services/externalIntegrationService.ts`, `backend/src/services/externalIdempotencyStore.ts`, `tests/unit/external-integration-service.test.ts`, `backend/tests/unit/external-idempotency-store.test.ts`. Ressalva: live smoke externo ainda e desejavel.
- [x] Monitorar custo por workspace e custo por resposta IA. Evidencia: o caminho real de IA em `backend/src/config/ai.ts`, `backend/src/config/openai.ts`, `backend/src/config/gemini.ts` grava metadados token-based por workspace; `backend/src/utils/saasStore.ts`, `backend/src/routes/saas.ts` e `backend/src/admin/adminController.ts` expoem `summary.aiCost` e `events[].aiCost`; cobertura em `backend/tests/unit/ai-config-observability.test.ts`, `backend/tests/unit/saas-store-ai-cost.test.ts`, `backend/tests/integration/saas.integration.test.ts` e `backend/tests/integration/admin.integration.test.ts`. Ressalva: custo estimado por tokens, nao fatura real do provedor.
- [x] Validar multi-tenant com carga e dados artificiais. Evidencia: `backend/tests/integration/workspace-storage-isolation.integration.test.ts` cobre oito workspaces com sync e uso segregados no mesmo owner; prova isolamento sintético local, nao throughput real de producao.

## 10. Checklist de prontidao

### Produto

- [x] O primeiro usuario entende em 30 segundos que o produto e sobre fluxo de caixa de empresa de servico. Evidencia: `components/Login.tsx` declara fluxo de caixa para empresas de servico acima do formulario.
- [x] O primeiro valor aparece sem depender de explicacao externa.
- [x] Dashboard separa caixa real, previsto, realizado, pendente e atrasado.
- [x] Zero-state nunca comunica saude financeira sem dados.
- [x] A navegacao principal nao parece super-app para usuario comum.

### UX/UI

- [x] Mobile mostra caixa, risco e acao principal acima da dobra.
- [x] FAB e bottom nav nao sobrepoem conteudo.
- [x] Estados vazios ensinam a inserir dados certos.
- [x] Texto pequeno da IA no mobile foi revisado. Evidencia: `pages/AICFO.tsx` elevou textos criticos de diagnostico/free/header/valores para `text-xs`.
- [x] Cores decorativas nao competem com status financeiro. Evidencia: `pages/AICFO.tsx` neutralizou badges decorativos de intent e preservou cor forte para status/diagnostico.

### IA

- [x] Prompt central fala de caixa operacional, nao financas gerais.
- [x] IA distingue confirmado, previsto, pendente, atrasado e sugestao.
- [x] Resposta mostra confianca e limite da analise. Evidencia: `pages/AICFO.tsx` renderiza confianca, base da resposta e profundidade; fallback local recebe `confidence_band: low` e `responseDepth: reduced`.
- [x] Fallback nao finge certeza. Evidencia: `pages/AICFO.tsx` e `backend/src/controllers/aiController.ts` retornam diagnostico explicito, baixa confianca e profundidade reduzida.
- [x] Logs de erro e fallback estao observaveis. Evidencia: `pages/AICFO.tsx` usa `logWarn` com `fallback: aicfo-generate-response-failed` e evento `ai_fallback_observed`; backend registra `event: ai_cfo_request_failed` e `fallback: cfo-fallback-answer`.

### Backend e seguranca

- [x] Rotas SaaS sensiveis usam authz por permissao.
- [x] Refresh com cookie tem CSRF/origin check.
- [x] Stripe webhook tem timestamp tolerance e dedupe por event id.
- [x] Firestore `billing_hooks` e server-only.
- [x] Regras Firestore passam em Java 21+/CI. Validado localmente com JDK 21 portatil; CI deve apontar para Java 21+.

### Monetizacao

- [x] Recursos Pro prometidos existem ou foram removidos do pricing.
- [x] Preco esta alinhado entre docs ativos, UI e codigo. Ressalva: evidencia antiga de sandbox preserva R$ 29,90 como historico.
- [x] Checkout tem estados claros de erro/sucesso. Loading, erro visivel, eventos centralizados, regressao de checkout e E2E de billing existem; smoke Stripe real depende de credenciais.
- [x] Exportacao Pro tem teste real se for mantida. Nao aplicavel no MVP atual porque a promessa foi removida.
- [x] Free vs Pro reforca o core, nao features genericas. Evidencia: `pages/Pricing.tsx`, `src/app/monetizationPlan.ts` e `docs/MONETIZATION_FREE_PRO_PHASE6.md` agora descrevem caixa operacional, previsto vs realizado, revisao semanal, historico e risco recorrente.

### Operacao

- [x] `npm run type-check` passa.
- [x] `npm run test:coverage:critical` passa.
- [x] Script critico padronizado existe.
- [x] Runtime web/mobile passa.
- [x] Health de Vercel passa.
- [x] Eventos de ativacao e billing sao monitorados.
- [x] Gates externos possuem runners locais com artefato e motivo de bloqueio. Evidencia: `scripts/check-public-launch-gates.mjs`, `scripts/check-target-performance-evidence.mjs`, `scripts/check-stripe-live-smoke.mjs`, `scripts/check-activation-retention-evidence.mjs`, `docs/TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md`, `docs/STRIPE_LIVE_SMOKE_2026-06-04.md`, `docs/ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md`. Ressalva atual: performance, Stripe e activation/retention ja estao fechados com evidencia real; o shell do frontend foi ajustado e nao constitui mais bloqueio de launch.

## 11. Veredito final: eu investiria, pagaria ou apostaria?

Eu nao investiria como SaaS pronto para escala agora.

Eu pagaria apenas em piloto privado, agora com billing publicado real e o gate de ativacao/retencao fechado com evidencia real ja validada, mas ainda exigindo prova de recorrencia ampla antes de apostar em escala.

Eu apostaria em piloto privado porque os P1 de codigo foram fechados e o gate de ativacao/retencao tambem foi fechado. Eu nao apostaria em lancamento publico sem provar recorrencia ampla em ambiente configurado.

O criterio de verdade nao e "tem IA", "tem dashboard" ou "tem integracao". O criterio e: uma empresa de servico abre o Flow toda semana porque ele mostra claramente o dinheiro que entrou, o que ainda nao entrou, o que vai sair, o risco da semana e a proxima acao.
