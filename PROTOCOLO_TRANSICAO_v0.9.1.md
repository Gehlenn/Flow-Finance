# PROTOCOLO DE TRANSICAO DE VERSAO - Flow Finance v0.9.1

## 1. Status da Transicao
- Versao de produto incrementada para `0.9.1`
- Protocolo de transicao iniciado em `2026-04-02`
- Base principal ja consolidada em `main` pelos commits `c37095b`, `36c33cb` e `07aca2e`
- Fase atual: validacao final, alinhamento documental e acompanhamento de estabilizacao

## 2. Escopo Considerado nesta Virada
- App shell refatorado em hooks de composicao (`auth/workspace`, `sync`, `financial state`, `navigation`)
- Fluxos backend-first consolidados para sync, SaaS, tenancy, event store e usage tracking
- Documentacao de API exposta via OpenAPI/Swagger
- Worktree previamente saneado e curadoria inicial concluida

## 3. Gates de Entrada
- [x] Worktree principal estabilizado em `main`
- [x] Lint e type-check verdes na base consolidada
- [x] Cobertura critica executada com sucesso na etapa anterior
- [x] Versao raiz alinhada para `0.9.1`
- [ ] Revisao final dos documentos ativos da release
- [ ] Validacao operacional final do protocolo de transicao

## 4. Validacoes de Referencia
- `npm run lint`
- `npm run test:coverage:critical`
- Suites unitarias criticas de auth, sync, financial state e finance service
- Validacoes complementares de backend tenancy, docs e cutover ja executadas na consolidacao

## 5. Riscos Acompanhar
- Mudancas abertas no worktree fora deste corte ainda precisam de curadoria final antes de uma release fechada
- Documentos historicos e docs ativos devem ser revisitados para garantir consistencia textual com `0.9.1`
- Health checks runtime/E2E continuam sendo recomendados antes de deploy produtivo

## 6. Proximos Passos Imediatos
1. Concluir revisao dos docs ativos da versao `0.9.1`
2. Rodar a validacao tecnica minima do protocolo apos este incremento
3. Registrar evidencias da transicao e decidir readiness de release
4. Encaminhar a fase seguinte de estabilizacao ou deploy, conforme resultado das validacoes

---

_Protocolo de transicao iniciado em 2026-04-02._
