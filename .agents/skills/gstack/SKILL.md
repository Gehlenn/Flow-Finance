# Gstack - Flow Finance Edition

## Descrição
Skill de QA automation, performance monitoring, e deployment verification. Integrado ao Flow Finance para validação de critérios de release (98% cobertura, health checks, canary deployment).

## Quando Usar
- QA testing antes de ship (encontra bugs, gera relatórios com screenshots)
- Performance benchmarking (Core Web Vitals, bundle size, load times)
- Canary deployment monitoring (post-deploy health checks)
- Teste de fluxos E2E críticos (autenticação, transações, cálculos financeiros)
- Dogfooding de features antes de release

## Comandos Principais
```bash
/qa                      # QA completo + fix automático
/qa-only                # QA com relatório apenas (sem fixes)
/browse [URL]           # Navegação headless para testing
/setup-browser-cookies  # Importar cookies para testes autenticados
/canary                 # Monitor pós-deploy
/benchmark              # Performance baseline e tracking
```

## Integração com Flow Finance
- Valida antes de `/gsd-ship`
- Alimenta AUDIT_REPORT com resultados
- Rastreia Core Web Vitals contra baselines
- Suporta testes de transações e cálculos críticos

## Critérios de Health
- ✅ Lighthouse score > 80
- ✅ Core Web Vitals green
- ✅ Sem console errors críticos
- ✅ Fluxo financeiro funcional E2E

---
**Repositório:** https://github.com/gstack-ai/gstack
**Documentação Flow Finance:** [AUDIT_REPORT_*.md](../../)
