# AI Readiness Roadmap - 2026-05-14

## 1. Analise objetiva

O Flow Finance ja possui uma base de IA funcional e relativamente extensa, mas ainda nao fechou a transformacao de "motor de inferencia" para "sistema de produto confiavel".

O estado atual mostra quatro capacidades reais em producao:
- leitura financeira sintetica via pipeline sincronizado
- assistente consultivo de caixa
- insights, riscos e previsao de curto prazo
- infraestrutura interna de memoria e fila de tarefas de IA

O que ainda falta nao e principalmente mais modelo. O que falta e:
- persistencia de experiencia
- rastreabilidade de respostas
- governanca de memoria
- acao operacional apos insight
- avaliacao continua de qualidade

Sem isso, a IA responde, mas ainda nao fecha o ciclo completo de decisao e aprendizado dentro do produto.

## 2. Arquitetura atual

### 2.1 Pipeline principal
Arquivos centrais:
- src/ai/aiOrchestrator.ts
- src/ai/financialEngine.ts
- src/ai/riskAnalyzer.ts
- src/ai/insightGenerator.ts
- src/ai/adaptiveAIEngine.ts
- src/ai/memory/AIMemoryEngine.ts

Capacidades atuais:
- consolida estado financeiro
- ajusta previsao com padroes aprendidos
- detecta perfil, riscos e insights
- grava aprendizado em background
- calcula health score e rotulo operacional

### 2.2 Assistente consultivo
Arquivos centrais:
- pages/AICFO.tsx
- src/ai/aiCFO.ts
- src/app/productFinancialIntelligence.ts

Capacidades atuais:
- classifica intencao da pergunta
- monta contexto financeiro enriquecido
- chama backend/LLM para resposta consultiva
- exibe confianca e qualidade da base
- aprende sinais simples da conversa em background

Limitacao atual:
- a conversa nao persiste como ativo do workspace
- nao existe trilha clara de auditoria da resposta exibida

### 2.3 Leitura de insights
Arquivos centrais:
- pages/Insights.tsx
- src/ai/insightGenerator.ts
- src/ai/financialAutopilot.ts

Capacidades atuais:
- mostra saude do caixa
- mostra riscos e insights visiveis por plano
- exibe proxima acao sintetica

Limitacao atual:
- pouca interacao posterior com o insight
- o insight e lido, mas nao gera um fluxo forte de decisao confirmada

### 2.4 Infraestrutura assíncrona
Arquivos centrais:
- src/ai/queue/AITaskQueue.ts
- src/ai/queue/AIWorker.ts
- src/ai/queue/taskStore.ts
- pages/AIControlPanel.tsx

Capacidades atuais:
- fila de tarefas de IA
- retries basicos
- eventos de progresso
- painel interno para memoria e diagnostico

Limitacao atual:
- a fila existe mais como infraestrutura do que como capacidade operacional visivel no produto principal

## 3. Gaps por prioridade

### 3.1 Criticos

#### Gap A - Persistencia de conversa e contexto do CFO
Evidencia:
- pages/AICFO.tsx usa estado local para `messages`
- limpar a tela ou sair da pagina elimina historico e continuidade

Impacto:
- a IA nao cria continuidade real
- o usuario precisa reexplicar contexto frequentemente
- reduz percepcao de inteligencia e utilidade pratica

Root cause:
- inexistencia de storage/modelo de conversa consultiva por workspace

### 3.2 Altos

#### Gap B - Explicabilidade operacional insuficiente
Evidencia:
- src/ai/aiCFO.ts gera resposta com contexto rico, mas a UI nao mostra base objetiva da recomendacao
- pages/AICFO.tsx exibe confianca geral e snapshot, mas nao ancora a resposta em "fatos usados"

Impacto:
- resposta pode parecer boa, mas opaca
- dificulta confianca do usuario em cenarios delicados
- dificulta auditoria e debug de recomendacoes ruins

#### Gap C - Falta de ciclo de acao apos insight
Evidencia:
- pages/Insights.tsx mostra health score, riscos e insights
- nao existe fluxo claro de "aceitar decisao", "criar lembrete", "resolver risco" ou "acompanhar efeito"

Impacto:
- IA gera leitura, mas nao move comportamento
- baixo aproveitamento do valor do insight

#### Gap D - Governanca fraca de memoria
Evidencia:
- ha leitura/escrita de memoria em src/ai/aiOrchestrator.ts e src/ai/aiCFO.ts
- AIControlPanel tem MemoryTab, mas isso e ferramental interno e nao governanca de produto

Impacto:
- usuario nao sabe o que a IA aprendeu
- nao ha fluxo claro de corrigir/apagar memorias inferidas
- aumenta risco de memoria errada persistir

### 3.3 Medios

#### Gap E - Fila de IA pouco conectada ao fluxo principal
Evidencia:
- AITaskQueue e AIWorker existem e suportam varias tarefas
- a maior parte da experiencia principal ainda depende de leitura sincronizada ou nao exposta como job rastreavel

Impacto:
- pouca observabilidade para o usuario
- baixa resiliencia percebida em tarefas mais pesadas

#### Gap F - Falta de criterio de recusa / insuficiencia de base mais explicito
Evidencia:
- AICFO ja mostra "Base suficiente" ou "Base incompleta"
- mas o comportamento ainda nao parece escalonar claramente a profundidade da resposta de forma contratual

Impacto:
- risco de resposta parecer precisa demais quando a base ainda e fraca

#### Gap G - Avaliacao sistematica da IA ainda insuficiente
Evidencia:
- existem muitos testes de infraestrutura e regressao
- nao ha um recorte claro de avaliacao de qualidade de resposta por tipo de pergunta de negocio

Impacto:
- regressao semantica pode passar sem alerta
- melhora de IA fica dificil de medir

## 4. As 5 entregas de IA em ordem de implementacao

### Entrega 1 - Conversa persistente do CFO por workspace
Objetivo:
- transformar o CFO em um assistente com continuidade real

Escopo:
- persistir sessoes e mensagens
- salvar resumo de contexto por conversa
- reabrir ultima conversa do workspace
- permitir limpar conversa sem apagar memoria comportamental global

Arquivos provaveis:
- pages/AICFO.tsx
- src/ai/aiCFO.ts
- src/services/ ou src/saas/ para store de conversas
- models/ ou shared/ para contrato de sessao/mensagem

Resultado esperado:
- o usuario volta e retoma a conversa com contexto

### Entrega 2 - Resposta auditavel e explicavel
Objetivo:
- mostrar por que a IA recomendou algo

Escopo:
- adicionar "base da resposta" no AICFO
- exibir fatos usados: saldo confirmado, previsao 7 dias, recebiveis, gasto dominante, alertas
- incluir nivel de confianca por resposta, nao so por contexto global

Arquivos provaveis:
- src/ai/aiCFO.ts
- pages/AICFO.tsx
- src/app/productFinancialIntelligence.ts

Resultado esperado:
- resposta mais confiavel, auditavel e debugavel

### Entrega 3 - Insight acionavel
Objetivo:
- fazer a IA gerar comportamento, nao so leitura

Escopo:
- cada insight/risco precisa ter CTA operacional
- exemplos: criar lembrete, registrar decisao, revisar categoria, marcar resolvido, acompanhar depois
- ligar insights a Assistant, lembretes e tarefas operacionais

Arquivos provaveis:
- pages/Insights.tsx
- components/Assistant.tsx
- src/ai/financialAutopilot.ts
- tipos de reminder/goal/alerta

Resultado esperado:
- insight vira acao dentro do app

### Entrega 4 - Governanca de memoria da IA
Objetivo:
- permitir revisar, corrigir e apagar o que a IA aprendeu

Escopo:
- promover a memoria de debug interno para capacidade de produto/admin
- listar memorias por tipo
- permitir confirmar ou invalidar inferencias
- registrar origem da memoria: conversa, transacao, inferencia recorrente, categorizacao

Arquivos provaveis:
- pages/AIControlPanel.tsx
- src/ai/aiMemory.ts
- src/ai/memory/AIMemoryEngine.ts
- src/ai/memory/AIMemoryStore.ts

Resultado esperado:
- memoria confiavel e controlavel

### Entrega 5 - Harness de avaliacao continua da IA
Objetivo:
- medir qualidade real da IA ao longo do tempo

Escopo:
- dataset de perguntas canonicas por dominio
- expected traits por resposta: prudencia, uso de caixa confirmado, mencao de risco, ausencia de promessa absoluta
- score automatico por categoria de pergunta
- regressao visivel em CI para mudancas na camada de IA

Arquivos provaveis:
- tests/unit/ ou tests/health/
- fixtures de perguntas e contexto
- possivel docs/ com protocolo de avaliacao

Resultado esperado:
- evolucao de IA com criterio tecnico e nao impressao subjetiva

## 5. O que nao falta agora

Nao falta neste momento:
- mais tab de IA
- mais complexidade de pipeline por si so
- mais heuristicas paralelas sem fechamento de produto
- mais promessas de automacao externa na experiencia principal

Adicionar mais "capacidade" sem fechar persistencia, explicabilidade, governanca e avaliacao tende a aumentar complexidade e ruido, nao valor.

## 6. Riscos e trade-offs

### Trade-off 1
Persistir conversa melhora valor, mas exige politica de retencao e privacidade.

### Trade-off 2
Explicabilidade demais pode poluir a UI principal. O ideal e disclosure progressivo.

### Trade-off 3
Governanca de memoria melhora confianca, mas adiciona custo de UX e regras de ownership.

### Trade-off 4
Harness de avaliacao aumenta rigor, mas precisa ser bem desenhado para nao virar suite fragil de snapshot textual.

## 7. Ordem sugerida de implementacao

1. Conversa persistente do CFO.
2. Explicabilidade por resposta.
3. Insight acionavel dentro do fluxo.
4. Governanca de memoria.
5. Harness de avaliacao continua.

## 8. Recomendacao pratica

Se o objetivo e fechar a trilha de IA do Flow Finance com impacto real de produto, a proxima fase nao deve ser "mais IA".

A proxima fase deve ser:
- persistencia
- explicabilidade
- acao
- governanca
- avaliacao

Esse e o caminho para a IA deixar de ser feature impressionante e virar sistema confiavel de suporte consultivo de caixa.
