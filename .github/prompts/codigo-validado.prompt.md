---
name: Codigo Validado
description: "Executa o workflow de validacao para codigo novo com testes unitarios, regressao, lint, cobertura critica e validacao funcional quando houver fluxo sensivel."
argument-hint: "Descreva a mudanca, os arquivos afetados e se ha fluxo critico ou compartilhado"
agent: "agent"
model: "GPT-5 (copilot)"
---

Execute o workflow `codigo-validado` para esta mudanca.

Objetivo:
- garantir que qualquer codigo novo tenha teste unitario
- validar regressao nas classes, funcoes e modulos afetados
- executar lint
- exigir cobertura critica e validacao funcional quando a mudanca tocar fluxo sensivel
- obrigar a trilha correta quando a mudanca tocar React, backend/API ou persistencia

Siga obrigatoriamente esta ordem:

1. Identifique os arquivos de producao alterados e o impacto da mudanca.
2. Verifique se houve adicao de logica nova.
3. Se houve logica nova, crie ou atualize testes unitarios cobrindo comportamento esperado, erro, fallback e casos limite relevantes.
4. Rode os testes diretamente impactados.
5. Rode a regressao necessaria para os modulos compartilhados e classes afetadas.
6. Rode `npm run lint`.
7. Se a mudanca tocar React ou UI, valide componentes, hooks, eventos, estados, acessibilidade basica, foco, mensagens, navegacao por teclado e rode `npm run test:e2e` ou regressao visual quando a jornada, navegacao ou apresentacao for afetada.
8. Se a mudanca tocar backend ou contratos HTTP, valide handlers, payloads, erros, retries, fallbacks e health checks aplicaveis.
9. Se a mudanca tocar persistencia, storage, repositorios, sync, cache ou banco, valide leitura, escrita, consistencia, idempotencia e recuperacao de falha.
10. Se a mudanca tocar fluxo critico, integracao, persistencia, autenticacao, IA, open banking, calculo financeiro ou comportamento compartilhado, rode tambem `npm run test:coverage:critical` e a validacao funcional aplicavel, incluindo `npm run test:e2e` quando fizer sentido.
11. Nao trate a tarefa como concluida se qualquer validacao obrigatoria nao tiver sido executada ou se houver falhas.

Formato de saida esperado:
- arquivos de producao alterados
- testes criados ou atualizados
- comandos executados
- trilha de camada executada
- resultado de cada validacao
- riscos residuais ou bloqueios, se existirem