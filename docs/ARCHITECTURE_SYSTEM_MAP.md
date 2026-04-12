# Mapa Sistêmico da Arquitetura

## Papel deste documento

Este arquivo resume o mapa de camadas do Flow Finance de forma visual e direta. Ele complementa a arquitetura principal, mas não a substitui.

## Camada 1 - Cliente

Superfícies atendidas:

- aplicação web em React
- empacotamento mobile com Capacitor
- PWA quando aplicável

Responsabilidades:

- renderização de interface
- entrada do usuário
- navegação
- visualização de estado financeiro

## Camada 2 - Guardas de runtime

Componentes principais:

- API Guard
- Chunk Guard
- Service Worker Guard
- Version Guard

Responsabilidades:

- detectar indisponibilidade de API
- reduzir falhas por chunks quebrados
- evitar inconsistência entre deploys

## Camada 3 - API

Entradas mais relevantes:

- `/api/auth`
- `/api/accounts`
- `/api/transactions`
- `/api/ai`
- `/api/health`
- `/api/version`
- `/api/saas`

Responsabilidades:

- entrada de dados
- validação
- autenticação
- mediação de fluxos sensíveis

## Camada 4 - Contexto do usuário

Dados principais:

- usuário ativo
- workspace ativo
- moeda
- fuso

Função:

- garantir que o fluxo do produto opere dentro do contexto correto

## Camada 5 - Domínio

Entidades relevantes:

- usuário
- conta
- transação
- meta
- orçamento

Objetos de valor:

- dinheiro
- categoria
- moeda

## Camada 6 - Motores financeiros

Motores principais:

- fluxo de caixa
- previsão
- orçamento
- saúde financeira

Responsabilidades:

- cálculos de saldo
- projeções
- análise de gastos

## Camada 7 - Motores de IA

Componentes principais:

- orquestrador de IA
- construtor de contexto
- decisão assistida

Responsabilidades:

- gerar insights
- apoiar análise financeira
- produzir recomendações

## Camada 8 - Autopilot

Responsabilidades:

- detectar overspending
- analisar saúde financeira
- gerar alertas e sinais

## Camada 9 - Agente CFO

Componentes:

- `AICFOAgent`
- `CFOPlanner`
- `CFOAdvisor`

Responsabilidades:

- planejamento financeiro
- orientação de corte e economia
- apoio a simulações

## Camada 10 - Barramento de eventos

Eventos típicos:

- transação criada
- transação removida
- meta criada
- orçamento alterado
- tarefa de IA concluída

Objetivo:

- automação
- reatividade
- integração entre módulos

## Camada 11 - Fila de IA

Tipos comuns:

- geração de insights
- análise do Autopilot
- geração de relatório
- simulação de fluxo

Objetivo:

- evitar bloqueio de interface

## Camada 12 - Repositórios

Camada responsável por mediar persistência.

Regra:

- motores não devem ler ou escrever no banco diretamente

## Camada 13 - Persistência

Estado atual mais relevante:

- Firebase como base principal em partes do sistema

Possibilidades futuras:

- PostgreSQL
- outras persistências específicas conforme a necessidade

## Resumo visual

```text
Cliente
 |
Guardas de runtime
 |
Frontend
 |
API
 |
Contexto do usuário
 |
Domínio
 |
Motores financeiros
 |
Motores de IA
 |
Autopilot
 |
Agente CFO
 |
Eventos
 |
Fila de IA
 |
Repositórios
 |
Persistência
```

## Referência principal

- [docs/ARCHITECTURE.md](E:\app e jogos criados\Flow-Finance\docs\ARCHITECTURE.md)
