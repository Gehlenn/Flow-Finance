# Release Summary - Flow Finance v0.5.2v

**Data:** 14 de Março de 2026  
**Release label:** `0.5.2v`  
**Versão técnica interna:** `0.6.3`  
**Branch:** `hardening-architecture`

---

## Resumo executivo

Esta entrega inicia formalmente o protocolo de transição `0.5.2v` do Flow Finance, mantendo a trilha técnica interna em `0.6.3`. O foco desta rodada foi aumentar previsibilidade operacional, endurecer regras de domínio e reduzir falsos negativos de validação no fluxo Open Banking.

---

## Principais entregas

- Hardening SaaS com erros padronizados para permissão, limite de plano e recurso indisponível.
- Validação explícita de payload para transações e metas antes da persistência.
- Repositório dedicado para assinaturas, reduzindo acoplamento dos serviços ao storage.
- Observabilidade ampliada no orquestrador de IA com métricas de chamada, erro e latência.
- Estabilização do teste E2E do Pluggy para ambientes sem backend local disponível.

---

## Impacto prático

- Falhas de negócio agora retornam erros mais consistentes e rastreáveis.
- Entradas inválidas são rejeitadas mais cedo no fluxo de aplicação.
- O comportamento de assinaturas fica mais previsível e mais fácil de evoluir.
- O pipeline de IA ganha melhor visibilidade operacional para investigação e tuning.
- O cenário E2E de Open Banking deixa de falhar por infraestrutura local ausente.

---

## Validação executada

- `npm run lint` ✅
- `npm test` ✅
- `npm run test:coverage:critical` ✅
- Cobertura crítica: `99.76%` statements / `98.3%` branches ✅
- `npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1 --reporter=line` ✅ com `skip` controlado quando backend local estiver indisponível

---

## Convenção de versão desta release

- Label documental/publicável: `0.5.2v`
- Versão técnica dos pacotes: `0.6.3`
- Tag Git híbrida recomendada: `v0.5.2v-tech-0.6.3`

---

## Mensagem curta para publicação

O Flow Finance inicia a transição `0.5.2v` com foco em hardening de domínio, observabilidade e estabilidade operacional. A base técnica interna foi consolidada em `0.6.3`, com validações críticas aprovadas e melhoria do fluxo Open Banking em ambiente local.