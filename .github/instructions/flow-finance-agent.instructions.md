---
applyTo: "**"
description: "Use when evolving Flow Finance with focus on stability, security, SaaS readiness, and safe external automation integration using Firebase/Firestore."
---

# Flow Finance - Instrucoes Base do Agente de Codigo

## Objetivo
Estas instrucoes definem o comportamento base para evoluir o Flow Finance com seguranca, estabilidade e prontidao SaaS, sem quebrar o fluxo atual.

## Contexto do projeto
- Produto principal: Flow Finance
- Stack: React + TypeScript, Express backend, Firebase/Firestore
- Arquitetura: modular em camadas, foco em multi-tenant
- Direcao: automacoes externas futuras com contratos estaveis

## Regras principais
1. Prioridade maxima: nao quebrar o Flow atual.
2. Preferir solucoes simples, incrementais e seguras.
3. Nao introduzir PostgreSQL no Flow neste momento.
4. Continuar usando Firebase/Firestore.
5. Nao armazenar dados clinicos sensiveis no Flow.
6. Preparar contratos estaveis para integracoes externas.
7. Sempre informar arquivos afetados, riscos e impacto da mudanca.

## Objetivos imediatos do agente

### A. Hardening do Flow
Em tarefas de hardening, entregar:
- visao da arquitetura atual
- fraquezas criticas
- riscos de seguranca
- riscos de escalabilidade
- quick wins (alto impacto, baixo esforco)
- roadmap incremental para 3 versoes

### B. Caca de bugs
Ao escanear o projeto, buscar:
- runtime errors
- bad patterns
- logica duplicada
- codigo fragil

Responder com:
- issues por severidade
- proposta de fix
- arquivos exatos a alterar

### C. Integracao externa futura (consultorio)
Preparar camada backend para receber eventos externos de:
- receitas
- despesas
- lembretes
- agenda operacional

Diretriz critica:
- sistema externo do consultorio e a fonte de verdade operacional
- Flow atua como reflexo financeiro/operacional

## Regras de dominio para integracao

### Modelo de cobranca escolhido: Modelo A
- a divida vive no sistema do consultorio
- Flow recebe apenas reflexos financeiros e lembretes
- pagamento confirmado gera receita no Flow
- saldo pendente gera/atualiza lembrete no Flow
- quitacao total remove lembrete no Flow

### O que NAO armazenar no Flow
- CPF
- anamnese
- prontuario clinico
- historico clinico completo
- logs completos da conversa IA com cliente

### O que PODE armazenar no Flow
- valor pago
- data
- categoria
- descricao operacional
- lembrete de cobranca
- identificador externo tecnico de cliente (quando necessario)
- identificador externo tecnico de cobranca (quando necessario)

## Contratos de eventos esperados
Ao propor contratos, usar payloads enxutos, validaveis e seguros para:
- payment_received
- expense_recorded
- receivable_reminder_created
- receivable_reminder_updated
- receivable_reminder_cleared

## Restricoes
- nao migrar banco do Flow agora
- nao adicionar complexidade desnecessaria
- nao duplicar logica clinica no Flow
- nao aceitar dados livres de IA sem validacao por codigo

## Formato padrao de resposta do agente
1. analise objetiva
2. proposta de arquitetura
3. lista de arquivos a criar/editar
4. snippets de codigo quando necessario
5. riscos e trade-offs
6. ordem sugerida de implementacao

## Politica de implementacao
- sempre aplicar a skill codigo-validado quando houver codigo novo ou mudanca de logica
- sempre executar validacoes obrigatorias do repositorio antes de concluir
