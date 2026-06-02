# Fase 0 - Baseline UI/UX (2026-05-12)

## Escopo da auditoria

- Tipo: code-only (sem captura visual)
- Motivo: sem dev server ativo em localhost:3000, 5173 ou 8080
- Gate de screenshot aplicado: .planning/ui-reviews/.gitignore criado
- Baseline usado: padroes abstratos de UX/UI (nao ha UI-SPEC.md no projeto)

---

## Pillar Scores

| Pilar | Score | Sintese |
|---|---:|---|
| 1. Copywriting | 3/4 | Copy principal alinhada ao posicionamento consultivo, com alguns ruidos de consistencia entre areas e labels muito genericas em acoes secundarias. |
| 2. Visuals | 2/4 | Boa base de componentes, mas com excesso de variacao de hero/header e densidade visual desigual entre telas. |
| 3. Color | 2/4 | Sistema de cor parcialmente tokenizado, porem com muitos hardcodes hex/rgb espalhados no front. |
| 4. Typography | 2/4 | Hierarquia presente, mas com uso excessivo de texto muito pequeno e de font-black em alto volume. |
| 5. Spacing | 2/4 | Estrutura geral consistente, porem com muitos valores arbitrarios em classes utilitarias. |
| 6. Experience Design | 3/4 | Cobertura de loading/erro/vazio robusta nas telas principais, com inconsistencias de padrao entre modulos. |

**Overall: 14/24**

---

## Top 3 prioridade de correção

1. **Normalizar tipografia operacional** - impacto: melhora legibilidade mobile e reduz fadiga cognitiva.
   - Fix concreto: limitar escala de texto para UI operacional e reduzir uso de text-[6-10px] + font-black em blocos de leitura.

2. **Tokenizar cores de forma obrigatoria** - impacto: aumenta consistencia visual e reduz risco de regressao de tema.
   - Fix concreto: migrar hardcoded hex/rgb de componentes para tokens centrais e classes padronizadas.

3. **Consolidar arquitetura de informacao das telas financeiras** - impacto: reduz sobreposicao de proposta entre Fluxo, Insights e Consultor IA.
   - Fix concreto: reposicionar "Fluxo" para "Receitas" na nav principal e mover recursos analiticos avancados para entradas contextuais.

---

## Evidencias detalhadas por pilar

### 1) Copywriting (3/4)

Pontos fortes:
- Linguagem consultiva e operacional no nucleo principal.
- CTA principal em linha com decisao de caixa.

Achados:
- Labels curtas/genericas em pontos de acao secundaria: "Salvar", "Cancelar", "Criar" sem qualificacao de contexto em modais e listas.
- Trechos em ingles em areas administrativas/dev quebram consistencia do produto final.

Evidencias:
- src/app/mainNavigation.ts:9-13
- components/TransactionList.tsx:832-834
- pages/WorkspaceAudit.tsx:258-286

### 2) Visuals (2/4)

Achados:
- Repeticao de hero gradients por tela sem criterio unico de prioridade visual.
- Densidade de cards variando bastante entre dashboard, transacoes e settings.

Evidencias:
- components/Assistant.tsx:309
- components/TransactionList.tsx:498
- pages/AICFO.tsx:311
- components/Settings.tsx:471

### 3) Color (2/4)

Achados:
- Tokens existem em src/styles/tailwind.css, mas convivem com alto volume de hex/rgb hardcoded em componentes.
- Cores de grafico e overlays estao acopladas nos componentes.

Evidencias:
- src/styles/tailwind.css:6-21
- components/CashFlow.tsx:30, 77, 269-270
- components/AdvancedAnalytics.tsx:18-29, 173-183
- pages/WorkspaceAudit.tsx:186, 205

### 4) Typography (2/4)

Achados:
- Uso intenso de font-black em labels, titulos e microtextos.
- Ocorrencia frequente de text-[7px], text-[8px], text-[9px], text-[10px] em conteudo importante.

Evidencias:
- components/TransactionList.tsx:537, 542, 545, 565, 599
- components/Settings.tsx:475, 489, 498, 505
- components/Assistant.tsx:311, 725, 739

### 5) Spacing (2/4)

Achados:
- Base de espacamento Tailwind coerente, mas com muitos valores arbitrarios entre colchetes.
- Risco de inconsistencias em responsividade fina e manutencao.

Evidencias:
- components/Assistant.tsx:389, 396
- components/TransactionList.tsx:498
- components/Login.tsx:180-181

### 6) Experience Design (3/4)

Pontos fortes:
- Presenca de loading/error/diagnostic em modulos criticos (App, AIInput, WorkspaceAdmin/Audit).
- Estados vazios em varias telas.

Achados:
- Padrao visual de estado ainda heterogeneo entre modulos (mensagens, prioridade visual e CTA de recuperacao).

Evidencias:
- App.tsx:197, 239
- components/AIInput.tsx:75-78, 227, 478, 541
- pages/WorkspaceAdmin.tsx:94-97, 437-444
- pages/WorkspaceAudit.tsx:255-267, 286

---

## Arquivos auditados (recorte principal)

- App.tsx
- src/app/mainNavigation.ts
- hooks/useNavigationTabs.tsx
- components/Dashboard.tsx
- components/TransactionList.tsx
- components/CashFlow.tsx
- components/Assistant.tsx
- pages/AICFO.tsx
- pages/Insights.tsx
- components/Settings.tsx
- components/AIInput.tsx
- components/Login.tsx
- pages/WorkspaceAdmin.tsx
- pages/WorkspaceAudit.tsx
- src/styles/tailwind.css

---

## Recomendacao objetiva para Fase 1

1. Trocar nav principal de "Fluxo" para "Receitas" (mantendo aderencia ao foco de produto).
2. Definir contrato de tipografia com limite estrito de tamanhos e pesos para telas operacionais.
3. Iniciar migracao de cores hardcoded para tokens centrais nas telas nucleares (Dashboard, Transacoes, Receitas, Consultor IA, Ajustes).
