# Decisão de Banco de Dados

## Papel deste documento

Registrar a decisão arquitetural de banco de dados sem carregar exemplos promocionais ou excesso de material comparativo.

## Decisão registrada

O documento histórico defendia PostgreSQL como escolha forte para um SaaS financeiro por causa de:

- integridade transacional
- modelagem relacional
- precisão monetária
- ecossistema maduro

## Leitura correta no contexto atual

Hoje, o projeto opera com combinação de persistências conforme o recurso:

- Firebase em partes importantes do sistema
- PostgreSQL como opção ou direção em áreas específicas

Portanto, a leitura correta não é “PostgreSQL substitui tudo agora”, mas sim:

- PostgreSQL continua sendo decisão válida quando o requisito pedir banco relacional forte
- o estado real do projeto deve ser conferido na configuração ativa e na documentação mais recente

## Valor histórico do documento

Este arquivo permanece útil para justificar por que PostgreSQL foi considerado adequado para cenários financeiros e de SaaS.

## Referências atuais

- [docs/ARCHITECTURE.md](E:\app e jogos criados\Flow-Finance\docs\ARCHITECTURE.md)
- [backend/README.md](E:\app e jogos criados\Flow-Finance\backend\README.md)
- [README.md](E:\app e jogos criados\Flow-Finance\README.md)
