# UI Simplification Cycle 2 — 2026-05-03

## Objetivo
Alinhar o microcopy e a hierarquia visual do Flow Finance com a direção estratégica de produto:
produto de caixa inteligente para negócios de serviço, com apoio consultivo de IA — sem referências a Open Finance ou promessas de autonomia ampla.

## Pré-condição
Ciclo 1 já havia simplificado a navegação para 5 tabs:
`dashboard`, `history`, `flow`, `cfo`, `settings` (+ `aicontrol` em dev).

## Mudanças implementadas

### 1. Navegação principal (`src/app/mainNavigation.ts`)
| Tab | Antes | Depois |
|-----|-------|--------|
| `dashboard` | "Inicio" | **"Caixa"** |
| `cfo` | "Apoio IA" | **"Consultor IA"** |

Justificativa:
- "Caixa" comunica o núcleo do produto diretamente na barra de navegação.
- "Consultor IA" reforça o papel consultivo da IA sem prometer autonomia.

### 2. Dashboard (`components/Dashboard.tsx`)
- Label tracking section: "Dashboard" → **"Caixa"** (consistência com tab renomeada)
- Botão secundário "Gerenciar contas" → **"Consultar saldos"**
  - Antes: soava como feature bancária
  - Depois: informativo e alinhado ao contexto financeiro do workspace

### 3. Testes atualizados
- `tests/unit/dashboard-quick-actions.test.tsx`: selector atualizado para `/consultar saldos/i`
- `tests/e2e/dashboard.spec.ts`: regex NAV_LABELS e homeButton expandidos para incluir "Caixa"
- `tests/e2e/helpers/skipHelpers.ts`: regex de fallback expandido para incluir "Caixa"

## Estado do assistente IA (auditado, sem mudanças necessárias)
- `AICFO.tsx`: posicionamento consultivo correto
  - Header: "Apoio Financeiro" / "Analise o caixa, riscos e pendencias com base nos seus dados"
  - Cada bolha do assistente tem disclaimer: "Consultivo · Não constitui garantia financeira"
  - Indicadores de contexto: Confiança %, "Base ancorada/incompleta"
  - QUICK_PROMPTS focados em decisões práticas de caixa
- `ASSISTANT_COPY`: alinhado ("Assistente Financeiro" / "Apoio leve para caixa, pendências e rotina operacional")
- Nenhuma referência a "CFO autônomo" ou promessas excessivas encontrada

## Estado do Open Finance
- `OpenBanking.tsx` existe no código mas **não está na navegação principal**
- Sem referências a Open Finance/Pluggy nos componentes `Dashboard`, `Settings`, `AICFO`, `Assistant`
- Settings: limpo — acesso social (Google/Apple) para autenticação, suporte humano via WhatsApp

## Validação
```
npm run lint       → zero erros
vitest run (unit)  → 17 testes passando (dashboard-quick-actions, dashboard-metrics, main-navigation)
```

## Próximos passos
- Tarefa 4/5: Deploy e validação no Vercel
- Tarefa 5/5: Integração externa — camada de eventos da clínica
