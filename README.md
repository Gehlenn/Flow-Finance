# Flow Finance

## Status de transicao 0.9.6.1v (2026-04-12)

- Status geral: BLOQUEADO por regressao na suite global.
- Gates aprovados:
	- lint e type-check
	- security scan de segredos
	- npm audit de producao (0 vulnerabilidades)
	- health runtime web e mobile
	- cobertura critica: 99.72% statements, 98.89% branches
	- firestore rules: 8/8 testes aprovados no emulator
- Gate bloqueante:
	- suite global com cobertura apresentou 9 arquivos de teste com falhas, impedindo conclusao segura da transicao.

Versao-alvo operacional deste checkpoint documental: 0.9.6.1v.

Flow Finance is a SaaS financial management app with AI.

This repository contains the application code. The durable project context lives in the Obsidian vault:

- [Project Rules](obsidian-vault/Flow/Project Rules.md)
- [Product Plan](obsidian-vault/Flow/Product Plan.md)
- [Code Tasks](obsidian-vault/Flow/Code Tasks.md)
- [Project Stack Guide](obsidian-vault/Flow/Project Stack Guide.md)
- [30-Day Plan](obsidian-vault/Flow/30-Day Plan.md)

Current scope:

- cash flow
- transactions
- projected and realized revenue
- consultative AI
- operational linkage for service businesses

The dental clinic is only a validation case. Parallel automation work belongs to a separate project.
