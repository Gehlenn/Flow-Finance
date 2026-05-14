# UI/UX Reform Plan - Flow Finance (2026-05-12)

## 1. Analise objetiva

Direcao correta ja iniciada:
- Navegacao principal ja simplificada para foco em caixa e operacao.
- Posicionamento do Consultor IA ja mais consultivo e menos "autonomo".
- Open Finance/Pluggy fora da experiencia principal.

Gaps atuais observados:
- Excesso de variacao visual entre telas (cards, gradientes, densidade de informacao).
- Microtipografia muito agressiva em varios pontos (labels muito pequenas), reduzindo legibilidade mobile.
- Hierarquia de acoes inconsistente entre telas (onde fica acao primaria e secundaria muda bastante).
- Concorrencia de linguagem entre modulos (Fluxo, Insights e Consultor IA com sobreposicao de proposta de valor).
- Estados de UX (vazio, erro, carregamento, sucesso) com padroes diferentes entre areas.

Objetivo do ciclo:
- Reformular a experiencia para "caixa orientado a decisao" com interface mais limpa, previsivel e escalavel para web e mobile.

---

## 2. Proposta de arquitetura de UI

### 2.1 Arquitetura de informacao
Navegacao principal alvo:
- Caixa
- Transacoes
- Receitas
- Consultor IA
- Ajustes

Regra:
- Tudo que for avancado entra como fluxo contextual dentro das telas (e nao na barra principal).

### 2.2 Sistema visual unificado
Criar camada de design tokens aplicacionais:
- Tipografia: escala curta e consistente (evitar proliferacao de tamanhos ultra pequenos)
- Espacamento: grade fixa de espacamentos
- Cores: base neutra + acento controlado (evitar ruido de gradientes em excesso)
- Elevacao: poucos niveis de sombra e raio

### 2.3 Padroes de composicao
Padroes obrigatorios para todas as telas:
- Header de contexto
- Bloco de KPI principal
- Blocos secundarios de apoio
- Bloco de acoes rapidas contextual
- Bloco de estados/alertas acionaveis

### 2.4 Contrato de estados de UX
Padrao unico para:
- Loading
- Empty
- Error
- Success
- Disabled

Com mensagens objetivas e orientadas a acao.

---

## 3. Lista de arquivos a criar/editar (planejada)

Arquivos de alto impacto (prioridade 1):
- src/app/mainNavigation.ts
- hooks/useNavigationTabs.tsx
- components/Dashboard.tsx
- components/TransactionList.tsx
- components/CashFlow.tsx
- pages/AICFO.tsx
- components/Assistant.tsx

Arquivos de suporte (prioridade 2):
- src/app/assistantCopy.ts
- src/app/secondaryFlowsCopy.ts
- src/styles (tokens/utilitarios, se ainda nao existir consolidado)

Arquivos de validacao (prioridade 1):
- tests/unit/main-navigation.test.ts
- tests/unit/dashboard-quick-actions.test.tsx
- tests/unit/dashboard-metrics.test.ts
- tests/unit/assistant-copy.test.ts
- testes de UI/fluxo ja existentes de navegacao critica

---

## 4. Snippets de direcao (contrato de implementacao)

### 4.1 Regra de CTA principal por tela
- 1 CTA primario por viewport
- CTAs secundarios em hierarquia visual inferior

### 4.2 Regra de tipografia
- Limitar quantidade de tamanhos por tela
- Limitar pesos para evitar ruido de contraste
- Priorizar legibilidade em mobile antes de refinamento desktop

### 4.3 Regra de copy
- Linguagem operacional e consultiva
- Evitar termos de "autonomia total" de IA
- Sempre explicitar proximo passo pratico

---

## 5. Riscos e trade-offs

Riscos:
- Regressao visual em telas secundarias ao unificar padroes.
- Quebra de testes por mudancas de labels/seletores.
- Aumento inicial de retrabalho se nao houver contrato visual unico antes da execucao.

Trade-offs:
- Menos "efeito visual" em troca de maior clareza operacional.
- Menos variacao de componentes em troca de manutencao e escala.
- Menos tabs principais em troca de navegação contextual mais eficiente.

Mitigacoes:
- Implementar por ondas pequenas (1 tela por vez).
- Validacao continua com testes unitarios + lint + E2E de fluxo critico.
- Congelar contrato de tokens e copy antes de editar em massa.

---

## 6. Ordem sugerida de implementacao

### Fase 0 - Baseline de UX (1 dia)
- Auditoria visual completa das 5 telas principais.
- Inventario de tipografia, espacamento, cores e estados.
- Definir score baseline por pilar: copy, visuais, cor, tipografia, espacamento, experiencia.

### Fase 1 - IA e navegacao (1-2 dias)
- Ajustar arquitetura para "Receitas" no lugar de "Fluxo" na navegacao principal.
- Manter recursos avancados somente por entrada contextual.
- Atualizar testes de navegacao e acessibilidade basica.

### Fase 2 - Sistema visual (2 dias)
- Consolidar tokens e padroes de composicao.
- Aplicar primeiro em Dashboard e Transacoes.
- Validar legibilidade mobile e consistencia de estados.

### Fase 3 - Reformulacao das telas nucleares (2-3 dias)
- Dashboard: foco em leitura imediata + 3 proximas acoes.
- Transacoes: filtro e decisao mais rapidos.
- Receitas: separar claramente realizado, previsto, pendente e vencido.
- Consultor IA: reforcar conversa orientada a decisao (curta e acionavel).

### Fase 4 - Polimento e regressao (1-2 dias)
- Ajustes finos de microcopy e hierarquia visual.
- Validacao tecnica obrigatoria: lint, testes unitarios impactados, cobertura critica aplicavel, E2E essencial.
- Atualizar documentacao de UI simplificada.

---

## 7. Criterios de aceite do plano

- Navegacao principal reduzida e coerente com direcao de produto.
- Legibilidade mobile melhorada (sem dependencias de textos ultra pequenos para leitura critica).
- Uma hierarquia visual previsivel nas telas principais.
- Padrao unico de estados (loading, vazio, erro, sucesso) aplicado.
- Tom consultivo da IA consistente em toda experiencia.
- Nenhuma regressao funcional nos fluxos financeiros principais.

---

## 8. KPIs de validacao

- Tempo para entender estado do caixa (teste interno) reduzido.
- Reducao de cliques para chegar em acao principal por tela.
- Queda de ambiguidades de copy em QA.
- Regressao de bugs visuais abaixo do baseline anterior ao ciclo.
