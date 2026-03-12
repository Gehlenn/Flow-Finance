---
name: codigo-validado
description: 'Use quando precisar adicionar, ajustar, otimizar ou refatorar codigo com garantia de fluxo, validacao, formatacao e regressao. Obriga criar testes unitarios para nova logica, validar classes afetadas, executar lint e confirmar que o codigo novo nao quebra a aplicacao.'
argument-hint: 'Descreva a mudanca, os arquivos afetados e o fluxo que precisa ser protegido'
user-invocable: true
disable-model-invocation: false
---

# Skill: Codigo Validado

## Objetivo
Garantir que qualquer codigo novo entre com validacao tecnica, cobertura suficiente da logica adicionada, verificacao de regressao nas classes afetadas, conformidade com os padroes do projeto e protecao explicita dos fluxos sensiveis.

## Quando usar
- Ao adicionar qualquer linha nova de codigo de producao.
- Ao ajustar fluxos existentes que podem quebrar comportamento antigo.
- Ao refatorar logica com risco de regressao.
- Ao otimizar codigo que afeta regras de negocio, servicos, helpers, contexto, componentes ou integracoes.
- Ao finalizar uma implementacao e precisar validar formatacao, padrao e seguranca de merge.

## Regras obrigatorias
Se qualquer linha nova de codigo for adicionada, a skill deve executar este protocolo:

1. Adicionar testes unitarios para a logica nova.
2. Validar se as classes, funcoes e modulos afetados continuam funcionando corretamente.
3. Executar os testes impactados e a regressao necessaria.
4. Executar o lint do projeto para garantir padrao e formatacao aceitos pelo repositorio.
5. Quando a mudanca tocar fluxo critico, integracao, persistencia, IA, autenticacao, calculo financeiro, sincronizacao bancaria ou logica compartilhada, executar tambem cobertura critica e validacao funcional correspondente.
6. So considerar a tarefa pronta se o codigo novo nao quebrar a aplicacao.

## Fluxos sensiveis que exigem validacao ampliada
- calculo de saldo e previsao financeira
- conversao de moeda e utilitarios financeiros
- categorizacao por IA e fluxos de IA
- persistencia de dados
- autenticacao e controle de sessao
- open banking, conectores, sync e importacao
- componentes compartilhados e regras centrais de contexto

## Trilhas obrigatorias por tipo de alteracao

### React e frontend
- Validar componentes afetados, estados, props, hooks e fluxo de navegacao.
- Cobrir regras de renderizacao condicional, eventos de usuario e regressao funcional relevante.
- Verificar acessibilidade basica do fluxo alterado: labels, papeis, foco, estado desabilitado, mensagens de erro e navegacao por teclado quando aplicavel.
- Quando houver mudanca visual relevante, validar regressao visual intencional e nao apenas comportamento funcional.
- Se a mudanca alterar jornada importante, execucao visual/funcional via E2E passa a ser obrigatoria.

### Backend e contratos HTTP
- Validar handlers, servicos, middlewares, serializacao, retries, fallbacks e tratamento de erro.
- Cobrir respostas de sucesso, erro esperado, erro inesperado e contratos consumidos pelo frontend.
- Quando houver integracao externa, validar modo degradado e comportamento fail-safe.

### Banco, storage e persistencia
- Validar leitura, escrita, atualizacao, remocao, fallback e consistencia dos dados.
- Cobrir serializacao, parsing, idempotencia, chaves de storage e contratos de repositorios/providers.
- Quando houver sincronizacao, importacao ou cache, validar integridade apos operacoes repetidas.

## Procedimento operacional

### 1. Mapear impacto da mudanca
- Identificar quais arquivos de producao foram alterados.
- Identificar classes, funcoes, hooks, servicos, contextos e fluxos indiretos afetados.
- Confirmar se a mudanca altera regra de negocio, integracao, UI, persistencia ou utilitarios compartilhados.

### 2. Criar testes para a logica nova
- Escrever testes unitarios cobrindo comportamento esperado, casos limite e falhas previsiveis.
- Se a logica nova tocar fluxo critico, incluir tambem regressao do comportamento antigo.
- Se houver branches novas, cobrir sucesso, fallback, erro e valores padrao relevantes.
- Sempre que a mudanca impactar modulo compartilhado, aumentar a cobertura do modulo em vez de testar apenas o caminho feliz.

### 3. Validar codigo ja impactado
- Rodar pelo menos os testes diretamente relacionados aos arquivos alterados.
- Se a mudanca afetar modulos compartilhados, rodar a suite ampliada correspondente.
- Se a mudanca afetar fluxo funcional importante, considerar tambem health checks, integracao ou E2E disponiveis no projeto.
- Se a mudanca tocar fluxo sensivel, nao encerrar apenas com teste unitario isolado.
- Se a mudanca tocar React, validar explicitamente renderizacao, eventos, hooks, navegacao afetada, acessibilidade basica e regressao visual aplicavel.
- Se a mudanca tocar backend, validar explicitamente contratos HTTP, erros, retries e fallbacks.
- Se a mudanca tocar persistencia, validar explicitamente leitura, escrita, consistencia e recuperacao de falha.

### 4. Executar validacoes obrigatorias do repositorio
Usar os scripts existentes do projeto sempre que disponiveis.

Comandos principais deste repositorio:

```bash
npm run lint
npm test
```

Quando a mudanca tocar fluxos criticos, preferir tambem:

```bash
npm run test:coverage:critical
npm run test:e2e
```

Meta obrigatoria para fluxo critico neste repositorio:
- cobertura critica minima de 98% no recorte aplicavel
- validacao de regressao sem falhas na suite existente impactada

### 5. Confirmar criterio de saida
Antes de encerrar, validar explicitamente:
- A nova logica tem testes.
- Os testes relacionados passaram.
- As classes e modulos afetados nao regrediram.
- O lint passou sem erros.
- O codigo novo segue o estilo e os padroes do projeto.
- Se houve fluxo sensivel, a cobertura critica e a validacao funcional correspondente tambem passaram.
- Se houve mudanca em React, backend ou persistencia, a trilha especifica da camada tambem foi executada.

## Checklist de aprovacao
- Existe teste unitario para a logica adicionada.
- Existem asserts cobrindo comportamento normal e casos de borda.
- Nenhum teste antigo relevante foi quebrado.
- O lint do projeto foi executado e passou.
- Se a mudanca foi critica, `npm run test:coverage:critical` foi executado e aprovado.
- Se a mudanca afetou React, backend ou banco, a trilha especifica correspondente foi validada.
- A alteracao nao foi encerrada apenas com implementacao sem validacao.

## Regra de resposta esperada ao usar esta skill
Ao concluir uma tarefa, informar de forma objetiva:
- quais arquivos de producao foram alterados
- quais testes foram criados ou atualizados
- quais comandos de validacao foram executados
- qual trilha de camada foi executada: React, backend, persistencia ou combinacao delas
- se houve risco residual ou area nao validada

## Politica de bloqueio
Se nao for possivel executar testes, cobertura critica, validacao funcional ou lint quando exigidos, a skill nao deve tratar a mudanca como validada. Nesse caso, deve registrar claramente o bloqueio e informar o que faltou validar.