# Archive de Documentacao

Este diretorio reune documentos historicos de versoes anteriores para reduzir ruido no fluxo principal de leitura.

## Criterio

- Arquivos de releases antigas (v0.3.x ate v0.8.x) podem ser movidos para este diretorio.
- Sumarios de PR, checkpoints antigos, prompts de go/no-go e diagnosticos tecnicos que ja nao participam da trilha viva tambem podem ser movidos para este diretorio.
- Documentos historicos de buglog, UX conceitual antiga e planos pausados tambem podem ser mantidos aqui quando nao orientarem mais a operacao atual.
- O historico permanece preservado no Git.
- Documentacao ativa deve permanecer em `docs/` e na raiz quando aplicavel.

## Observacao

Se algum link externo estiver apontando para o caminho antigo em `docs/`, atualize o link para `docs/archive/`.

## Conteudo arquivado

### Auditorias e avaliacoes de codigo

- `AUDITORIA_THOROUGH_2026-03-11.md` — auditoria de maturidade marco/26 (movido 2026-04-12)
- `SECURITY_UPDATES_v0.1.0.md` — hardening inicial v0.1.0 (movido 2026-04-12)
- `SECURITY_REVIEW_CLINIC_v0.9.2.md` — revisao de seguranca da integracao clinica; todos os achados ja foram fechados no codigo (movido 2026-04-12)
- `AUDIT_REPORT_v0.3.0.md` a `AUDIT_REPORT_v0.6.1.md` — auditorias de versoes anteriores

### Fechamentos de ciclo e assessments

- `ASSESSMENT_PHASES_1_TO_6_2026-04-11.md` — fechamento v0.6.x fases 1-6 (movido 2026-04-12)
- `ASSESSMENT_V0_6X_CLOSURE_CODE_REALITY_2026-04-11.md` — avaliacao de codigo da linha v0.6.x (movido 2026-04-12)
- `CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md` — matriz de ciclo encerrado v0.6-v0.9 (movido 2026-04-12)
- `CHECKLIST_EXECUCAO_PRIORIZADA_v0.7_v0.9_2026-04-11.md` — todos P0 concluidos, ciclo 0.9.6 GO (movido 2026-04-12)
- `PRODUCTION_RISK_REVIEW_2026-04-11.md` — risco residual ciclo 0.9.x; addendum de 2026-04-12 encerrou item de billing (movido 2026-04-12)

### Releases e checkpoints

- `PR_SUMMARY_0.9.6.md` — sumario do PR de release 0.9.6
- `PR_SUMMARY_0.9.5.md` — sumario do PR de release 0.9.5
- `RELEASE_SUMMARY_v0.5.2v.md` — resumo de release v0.5.2
- `PROMPT_FINAL_GO_NO_GO_CROSS_BROWSER_v0.9.x.md` — gate go/no-go cross-browser v0.9.x
- `GO_NO_GO_v0.5.1v.md` — gate go/no-go v0.5.1
- `DEPLOY_CHECKLIST_v0.4.0.md`, `DEPLOY_STAGING_CHECKLIST_v0.6.8.md` — checklists de deploy de versoes anteriores
- `V0.4.1_PROGRESS.md` — progresso v0.4.1

### Diagnosticos tecnicos e planos pausados

### Lancamento v0.9.6 (2026-04-12)

- `GO_NO_GO_DECISION_2026-04-12.md` — decisao GO WITH KNOWN LIMITATION; todos os gates aprovados
- `LANCAMENTO_OFICIAL_2026-04-12.md` — anuncio oficial de lancamento
- `PRELAUNCH_CHECKLIST_2026-04-12.md` — checklist pre-lancamento; zero bloqueadores
- `RELEASE_NOTES_0.9.6_PT-BR.md` — notas de release em PT-BR para usuarios
- `DIA_2_BETA_TESTING_PLAN.md` — plano de beta testing com testers selecionados
- `EXECUCAO_AMBOS_SENTRY_BETA.md` — plano de execucao paralela Sentry + beta (aguarda DSN)
- `PLANO_LANCAMENTO_10_DIAS_2026-04-12.md` — plano de 10 dias; bloqueio honesto documentado (ambiente Vercel)

### Ciclos de sprint encerrados

- `PR_CHECKLIST_SPRINT2_D1_D2.md` — checklist de PR do sprint 2 (D1 + D2 concluidos)
- `UI_SIMPLIFICACAO_CICLO_1.md` — registro de execucao do ciclo 1 de simplificacao de UI


- `TAILWIND_ISSUE_DIAGNOSIS.md` — diagnostico de problema de Tailwind resolvido
- `OPEN_FINANCE_GO_LIVE_PLAN.md` — plano de go-live Open Finance (em standby estrategico)
- `NEXT_STEPS.md` — proximos passos de ciclo anterior
- `WORKTREE_CURATION_2026-04-02.md` — curadoria de worktrees de abril

### Historico de versoes anteriores

- `README_v0.3.0.md` — README da v0.3.0
- `TEST_SUITE_v0.3.0.md` — suite de testes da v0.3.0
- `BUGLOG.md` — log historico de bugs
- `GDD.md` — design document de versoes anteriores
