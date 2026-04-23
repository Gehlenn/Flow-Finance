# Buglog Historico

## Papel deste documento

Este arquivo registra bugs, regressões e decisões de correção relevantes na evolução do Flow Finance. Ele foi reduzido para preservar sinal histórico sem manter ruído, duplicação ou material obsoleto demais.

## Como usar

- Use este documento para investigar regressões antigas, decisões de correção e padrões recorrentes.
- Não use este documento como source of truth de release atual.
- Para estado vivo, consulte `README`, `docs/README.md`, `docs/OPERATIONS_README.md`, `docs/DEPLOYMENT_STATUS.md` e `docs/CHANGELOG.md`.

## Legenda de status

- `ABERTO`: identificado e ainda não resolvido
- `CORRIGIDO`: solução aplicada e validada
- `WONTFIX`: não será resolvido por decisão técnica ou de negócio
- `BLOQUEADO`: depende de fator externo ou de outra correção

## Checkpoint 0.9.6.1v

### B016 - Regressão na suíte global de cobertura

- Status: `BLOQUEADO`
- Escopo: `npm run test:coverage`
- Evidência: múltiplos arquivos de teste falhando apesar de os gates críticos estarem verdes
- Impacto: bloqueia fechamento honesto da versão
- Ação esperada: corrigir suites falhas e estabilizar o baseline global

### B017 - Gate de release bloqueado por divergência entre suíte crítica e suíte global

- Status: `BLOQUEADO`
- Evidência:
  - cobertura crítica validada acima da meta
  - regras Firestore validadas
  - suíte global ainda falhando
- Impacto: não existe gate único confiável de release enquanto a divergência persistir

## Checkpoint 0.9.1v

### B013 - Loop de render com `Maximum update depth exceeded`

- Status: `CORRIGIDO`
- Severidade: alta
- Impacto: regressão funcional em múltiplos browsers
- Causa raiz: efeitos React com dependências instáveis e atualização em cascata
- Solução aplicada:
  - estabilização de callbacks no `App.tsx`
  - ajuste no `useAuthAndWorkspace` para reduzir resubscribe

### B014 - `API_KEY_INVALID` em runtime

- Status: `CORRIGIDO`
- Severidade: alta
- Impacto: falha em fluxos de autenticação/integração com ruído de console
- Causa raiz: ambiente de teste sem configuração válida de Firebase/serviços externos
- Solução aplicada:
  - modo degradado seguro em `services/firebase.ts`
  - guardas de configuração em `components/Login.tsx`

### B015 - `ERR_CONNECTION_REFUSED` em E2E local

- Status: `CORRIGIDO`
- Severidade: média
- Impacto: falso negativo por indisponibilidade da aplicação sob teste
- Causa raiz: dependência rígida de servidor local
- Solução aplicada:
  - uso de `baseURL`
  - alinhamento das specs ao fluxo autenticado e ao ambiente disponível

## Checkpoint 0.6.x

### D001 - Open Finance desativado por inviabilidade econômica

- Status: `WONTFIX`
- Natureza: decisão de negócio, não bug técnico
- Impacto: Pluggy e trilha Open Finance colocados em standby
- Motivo: custo operacional incompatível com a fase do produto
- Resultado: infraestrutura preservada para reativação futura

### B012 - Instabilidade de E2E Pluggy por identidade dinâmica

- Status: `CORRIGIDO`
- Impacto: teste do Pluggy pulando ou degradando por usuário efêmero
- Solução aplicada: fixture estável de autenticação para o cenário E2E

### B011 - E2E Pluggy falhando sem backend local

- Status: `CORRIGIDO`
- Impacto: falso negativo em ambientes sem API ativa
- Solução aplicada: `skip` controlado com motivo explícito

### B009 - Provider Open Finance aceitando valor inválido

- Status: `CORRIGIDO`
- Impacto: mascarava erro de ambiente
- Solução aplicada: validação estrita do provider com fallback seguro

### B010 - Reconfiguração indevida do Firestore

- Status: `CORRIGIDO`
- Impacto: risco de `503` em runtime
- Solução aplicada: guarda global para aplicar settings apenas uma vez

### B007 - Health check de Open Banking dependente de backend remoto

- Status: `CORRIGIDO`
- Impacto: testes de coverage não determinísticos
- Solução aplicada: desativação do caminho remoto em `MODE=test`, salvo override explícito

### B008 - Cobertura abaixo da meta protocolar

- Status: `ABERTO` no contexto histórico original
- Impacto: transição não podia ser considerada concluída integralmente
- Observação atual: o projeto evoluiu desde esse ponto, mas este registro permanece útil como memória do endurecimento de qualidade

### B006 - Coverage command sem provider instalado

- Status: `CORRIGIDO`
- Impacto: impossível aferir baseline formal de coverage no período
- Solução aplicada: inclusão do provider de coverage do Vitest

## Checkpoint 0.3.x

### B001 - Enum de categoria desatualizado em teste

- Status: `CORRIGIDO`
- Impacto: falha de compilação/teste

### B002 - ErrorBoundary incompleto

- Status: `CORRIGIDO`
- Impacto: componente não compilava corretamente

### B003 - Uso incorreto de `timeout` em `fetch`

- Status: `CORRIGIDO`
- Impacto: type error em configuração de API
- Solução aplicada: `AbortController`

### B004 - Incompatibilidade do BrowserTracing

- Status: `CORRIGIDO`
- Impacto: bootstrap de Sentry inconsistente

### B005 - Propriedades inválidas no Capacitor config

- Status: `CORRIGIDO`
- Impacto: quebra de configuração mobile

### B006 - Erro de sintaxe em tipagem do Capacitor

- Status: `CORRIGIDO`
- Impacto: type definitions inválidas

## Padrões aprendidos

1. Ambientes incompletos geram muitos falsos negativos se não houver guards explícitos.
2. E2E precisa separar bug real de indisponibilidade de infraestrutura.
3. Gates de release só são confiáveis quando a suíte global e a suíte crítica contam a mesma história.
4. Documentação histórica precisa ser compacta; se virar arquivo morto barulhento, perde valor.

## Referências relacionadas

- `docs/HISTORICAL_README.md`
- `docs/CHANGELOG.md`
- `docs/DEPLOYMENT_STATUS.md`
- `docs/archive/CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md`
