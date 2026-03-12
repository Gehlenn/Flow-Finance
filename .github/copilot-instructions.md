# Flow Finance - Instrucoes de Validacao de Codigo

## Protocolo obrigatorio para codigo novo
Sempre que adicionar qualquer linha nova de codigo de producao:

1. Criar ou atualizar testes unitarios para a logica adicionada.
2. Validar se classes, funcoes e modulos afetados continuam funcionando corretamente.
3. Executar o lint do projeto antes de encerrar a tarefa.
4. Quando a mudanca tocar fluxo critico, integracao, persistencia, IA, autenticacao, calculo financeiro ou logica compartilhada, executar tambem cobertura critica e validacao funcional correspondente.
5. Quando a mudanca afetar frontend React, validar renderizacao, estados, eventos, hooks e regressao visual/funcional aplicavel.
6. Quando a mudanca afetar backend ou contratos HTTP, validar handlers, regras de negocio, serializacao, erros, fallbacks e integracoes impactadas.
7. Quando a mudanca afetar banco, storage, persistencia, migracao, cache ou repositorios, validar leitura, escrita, idempotencia, fallback e integridade dos dados.
8. Nao considerar a alteracao pronta se a validacao nao tiver sido executada.

## Workflow preferencial
Ao fazer implementacoes, ajustes de fluxo, refatoracoes ou otimizacoes, usar a skill `codigo-validado` como referencia operacional.

## Comandos padrao do repositorio
Usar preferencialmente:

```bash
npm run lint
npm test
```

Quando a mudanca tocar fluxo critico, integracoes ou comportamento compartilhado, considerar tambem:

```bash
npm run test:coverage:critical
npm run test:e2e
```

Para fluxos criticos, a meta minima esperada e cobertura critica de 98% no recorte aplicavel.

## Trilhas especificas por camada
- React/UI: validar componentes afetados, estados, hooks, navegacao, acessibilidade basica, foco, feedback visual e E2E/regressao visual quando a jornada ou apresentacao mudar.
- Backend/API: validar contratos de entrada e saida, status HTTP, tratamento de erro, autenticacao, retries e health checks aplicaveis.
- Banco/Persistencia: validar repositorios, provedores de storage, leitura/escrita, consistencia dos dados, fallback e impacto em sincronizacao/importacao.

## Criterio de saida
Nenhuma entrega com codigo novo deve ser encerrada sem:
- teste da logica adicionada
- validacao de regressao do que foi impactado
- execucao de lint
- cobertura critica e validacao funcional quando aplicaveis
- trilha especifica executada quando a mudanca tocar React, backend ou persistencia