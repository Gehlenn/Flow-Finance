# GSD (Get Shit Done) - Flow Finance Edition

## Descrição
Skill customizado para Flow Finance que integra o protocolo de versão com ciclos de release estruturados, auditoria de código, engenharia de testes e atualização documental.

## Quando Usar
- Iniciar ciclo de release (v0.9.x, v1.0.0, etc)
- Auditoria geral de código e lógica de negócio
- Engenharia de testes e validação de cobertura (98% obrigatório)
- Atualização documental (README, ROADMAP, CHANGELOG, BUGLOG)
- Planejamento e execução de fases complexas

## Comando Base
```bash
/gsd-do [descrição da tarefa]
```

## Fluxo Padrão para Release
1. **Auditoria** (`/gsd-audit-fix`) — Code review, segurança financeira, performance
2. **Testes** (`/gsd-add-tests`) — Cobertura crítica 98%, validação de fluxos
3. **Documentação** (`/gsd-docs-update`) — README, CHANGELOG, BUGLOG, ROADMAP
4. **Ship** (`/gsd-ship`) — PR, review, merge
5. **Deploy** (`/land-and-deploy`) — Canary checks, monitoramento

## Integração com Flow Finance
- Respeita protocolo obrigatório de versão (AGENTS.md)
- Valida cobertura mínima de 98%
- Automação com atomic commits
- Rastreamento de progresso via .planning/

## Dicas
- Use `--auto` para decisões automáticas recomendadas
- Use `--power` para bulk question generation
- Consulte BUGLOG.md para padrões de issue tracking

---
**Repositório:** https://github.com/pimzero/get-shit-done
**Documentação Flow Finance:** [AGENTS.md](../../AGENTS.md)
