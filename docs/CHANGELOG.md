# Changelog - Flow Finance

## Papel deste documento

Este changelog registra mudancas relevantes no repositorio. Ele nao e a fonte de verdade do status operacional atual.

Para status real do ciclo e pendencias operacionais atuais, consultar:

- `docs/DEPLOYMENT_STATUS.md`
- `./OPERATIONS_README.md`
- vault canonico (fora do repo): `E:\app e jogos criados\obsidian-vault\Projetos\` (ver `../README.md`)

## Ultima revisao editorial

- 2026-05-26 (registro da linha de polimento visual, refinamento de empty states e modais menores)

## 2026-05-27 - Demo local isolado da nuvem e validado em navegador

- O modo `demoData=1` passou a resolver identidade e workspace locais sem tocar em Firestore, igualando o comportamento do bootstrap demo ao fluxo E2E local.
- `App.tsx` agora trata `isDemoBootstrapActive` como trilha local-only para billing/usage, evitando adapters de Firestore durante a revisao demo.
- `pages/AICFO.tsx` deixou de carregar usage real do workspace no modo demo, eliminando o warning de permissao que ainda aparecia no console.
- O contrato foi coberto por teste unitario em `workspace-session` e por um spec E2E dedicado ao bootstrap demo.
- Os artefatos temporarios de revisao local foram limpos apos a validacao final.

## 2026-05-26 - Bootstrap E2E e runtime local estabilizados para revisao visual

- `App.tsx` passou a resetar o usage store para memoria quando a sessao esta em bootstrap E2E, sem usuario/workspace valido ou sem Firebase configurado, evitando que adapters do Firestore vazem para a revisao local.
- `hooks/useSyncEngine.ts` passou a tratar o bootstrap E2E como trilha local-only para carga e persistencia de entidades, eliminando warnings falsos de sync/backend durante QA visual.
- `src/runtime/apiGuard.ts` e `src/runtime/versionGuard.ts` agora pulam probes locais em DEV quando o alvo e `localhost`, `127.0.0.1` ou `0.0.0.0`, reduzindo ruído quando o frontend esta sendo revisado sem backend local.
- `src/runtime/serviceWorkerGuard.ts` rebaixou a limpeza de caches antigos em DEV para log informativo, mantendo o comportamento de limpeza sem poluir a consola.
- A revisao visual desktop/mobile foi refeita com bootstrap E2E e terminou sem erros ou warnings no console do app.

## 2026-05-26 - Fechamento de acabamento visual e validacao local desktop/mobile

- A ultima rodada de acabamento focou em `Login`, `Settings`, `Logo`, `NamePromptModal`, `LegalModal` e `AIDebugPanel`, reduzindo acentos decorativos residuais sem mexer nos estados semanticos.
- Os acentos restantes em botões primarios e cores de status foram mantidos de forma intencional para preservar hierarquia, legibilidade e contraste.
- A interface foi conferida localmente em desktop e mobile com captura de navegador, confirmando a entrada do app como consistente nos dois formatos.
- O estado segue sendo de polimento fino e fechamento documental, nao de mudanca funcional.

## 2026-05-26 - Acabamento de empty states e modais menores

- Os modais menores e empty states foram alinhados ao mesmo tom visual do restante da interface: `NamePromptModal`, `LegalModal` e `WorkspaceAudit`.
- O objetivo foi reduzir acentos decorativos soltos e encerrar as ultimas superficies que ainda destoavam da linha neutra do produto.
- O contrato funcional nao mudou; a validacao continua amparada pelos testes ja executados nesta passada.

## 2026-05-26 - Polimento visual e acabamento fino concluidos na interface principal

- As superficies principais do app foram reduzidas em peso visual sem alterar contratos funcionais: `Dashboard`, `CashFlow`, `TransactionList`, `AIInput`, `Assistant`, `Settings`, `Login`, `Pricing`, `Accounts`, `Goals`, `Insights`, `AICFO`, `WorkspaceAdmin`, `WorkspaceAudit` e `ImportTransactions`.
- Estados ativos, alertas, risco, sucesso e erro continuaram semanticos; o corte foi restrito a banners, gradientes e acentos decorativos que puxavam a interface para uma cara de template generico.
- A arvore voltou a fechar com `npm run type-check:app`, `npm run build` e testes focados nas superficies tocadas.
- O estado atual e de polimento fino, nao de reestruturacao funcional.

## 2026-05-25 - Backend oficial revalidado em 0.9.7

- O backend oficial voltou a expor `0.9.7` em `/api/version` no dominio `flow-finance-backend.vercel.app`.
- Os contratos de `/health` e `/api/health` voltaram a responder `200` na revalidacao de producao.
- Os envs criticos de frontend e backend ja aparecem provisionados no Vercel; o restante do fechamento e evidencia externa e preview access quando aplicavel.
- A documentacao viva foi alinhada ao estado real de producao na mesma passada.

## 2026-05-25 - Contrato de integracao generica validado

- O contrato generico de integracao ficou operacional em `backend/src/routes/businessIntegration.ts` e permanece exposto em `/api/integrations/transactions` e `/api/integrations/reminders`.
- O caminho canonico de eventos externos segue em `/api/integrations/external/events`.
- O adaptador clinic-specific continua como compatibilidade legada, sem virar a superficie principal do produto.
- Stripe segue em modo beta/teste por decisao de produto; a cobranca real continua propositalmente desativada.

## 2026-05-15 - Corte de paginas legadas e dependencias pesadas

- Removidas do bundle ativo: `pages/Autopilot.tsx`, `pages/OpenBanking.tsx`, `pages/ReceiptScanner.tsx`.
- Navegacao interna limpa para nao lazy-loadar mais essas telas.
- Removidas dependencias do app shell sem uso no escopo atual: `react-pluggy-connect`, `@google/genai`.
- `pdf-parse` e `tesseract.js` permanecem temporariamente porque ainda sustentam a trilha ativa de importacao/OCR fora do escopo desta sessao.
- Flags de ambiente legadas comentadas em `.env.example` para evitar reintroducao silenciosa do escopo cortado.

## 2026-05-15 - S5 consultor IA reduzido para motor de sinais

- `pages/AICFO.tsx` deixou de depender do pipeline inchado de `runAIPipelineSync` e passou a montar contexto consultivo direto com `buildCashflowPrediction` + `signalEngine`.
- `components/Assistant.tsx` deixou de usar o branding legado de `financialAutopilot` para gerar alertas locais e agora consome sinais consultivos puros.
- `src/ai/signalEngine.ts` entrou como nucleo minimo para sinais de caixa, recorrencias, despesas fixas e oportunidades, sem semantica de execucao autonoma.
- `src/ai/financialAutopilot.ts` e `src/ai/aiOrchestrator.ts` foram rebaixados a wrappers de compatibilidade para nao quebrar consumidores fora desta sessao.
- Testes focados da trilha consultiva foram atualizados para o motor de sinais e para o contrato minimo de compatibilidade.

## 2026-04-22 - Curadoria documental (camada 5)

- Consolidacao de docs vivos vs historicos em `docs/` e `docs/archive/`.
- Normalizacao de guias de setup, deploy, Vercel, mobile, integracoes e evidencias em PT-BR.
- Arquivamento de materiais datados que nao devem competir com a trilha operacional.

Documentos centrais desta rodada:

- `docs/README.md`
- `docs/SETUP_GUIDE.md`
- `docs/DEPLOYMENT.md`
- `docs/VERCEL_CONFIG.md`
- `docs/VERCEL_DEPLOYMENT.md`
- `docs/AUDIT_AND_EVIDENCE_INDEX.md`
- `docs/HISTORICAL_README.md`

## 0.9.6.1v - 2026-04-12 (registro historico)

- Reestruturacao ampla de documentacao e indices.
- Evidencia operacional de Stripe sandbox consolidada.
- Contratos HTTP sensiveis documentados e congelados por referencia.

## Historico completo

O changelog detalhado anterior foi movido para:

- `docs/archive/CHANGELOG_ANTIGO.md`

Ele existe para rastreabilidade historica e nao deve ser usado como status vivo.
