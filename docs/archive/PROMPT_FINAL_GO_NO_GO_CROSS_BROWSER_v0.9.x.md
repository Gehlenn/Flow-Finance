# Prompt final: Go / No-Go cross-browser

Quero executar a ultima etapa de fechamento de release da linha v0.9.x do Flow Finance: validacao E2E final para decisao de Go / No-Go.

## Contexto
- A linha v0.9.x ja esta validada operacionalmente no recorte critico executado.
- Dominio, integracoes e gates de qualidade ja ficaram verdes.
- O bloqueio remanescente para fechamento final e a ampliacao da validacao E2E para matriz cross-browser/device.
- Nao quero reabrir auditoria de codigo nem reavaliar arquitetura inteira.
- Quero foco exclusivo em evidencia final de release.

## Objetivo desta sessao
Executar e consolidar a matriz E2E final do recorte critico para emitir uma decisao objetiva de Go / No-Go.

## Escopo
1. Executar o mesmo recorte critico ja validado em:
   - Chromium
   - Firefox
   - WebKit
2. Repetir o recorte principal em viewport mobile relevante.
3. Classificar cada fluxo como:
   - GREEN
   - FAIL REAL
   - NOT VALIDATED BY ENVIRONMENT
4. Corrigir apenas falhas pontuais, locais e claramente dentro do escopo.
5. Se nao for possivel corrigir, registrar como risco residual explicito.
6. Encerrar com decisao unica:
   - GO
   - GO WITH KNOWN LIMITATIONS
   - NO-GO

## Fluxos minimos que precisam entrar no recorte final
- auth / entrada na aplicacao
- dashboard
- billing / admin principal
- pelo menos um fluxo critico de transacao/importacao se ja houver E2E confiavel para isso
- qualquer outro fluxo ja considerado parte do recorte critico nas sessoes anteriores

## Regras importantes
- Nao contar como verde algo que nao rodou.
- Separar claramente bug real, flake, limitacao de ambiente e falta de cobertura.
- Se houver falha so em browser especifico, registrar isso como risco de release.
- Se o ambiente impedir execucao em algum browser/device, marcar explicitamente como nao validado.

## Validacoes esperadas
- Playwright/E2E por browser
- viewport mobile do recorte principal
- manter registro dos testes executados e seus resultados
- no final, rerodar:
  - npm run lint
  - npm run test:coverage:critical
  apenas se houver mudanca de codigo

## Formato de saida desejado
1. Matriz final por browser/device
2. Fluxos verdes
3. Falhas reais encontradas
4. Limitacoes de ambiente
5. Correcoes feitas na sessao, se houver
6. Riscos residuais
7. Decisao final:
   - GO
   - GO WITH KNOWN LIMITATIONS
   - NO-GO

## Criterio de decisao
- GO:
  matriz critica verde e sem risco relevante aberto
- GO WITH KNOWN LIMITATIONS:
  nucleo verde, com limitacao residual controlada e explicitamente documentada
- NO-GO:
  qualquer falha real em fluxo critico sem correcao aceitavel nesta sessao

## Recomendacao
O alvo mais realista para a proxima sessao nao e GO puro. E:

- GO WITH KNOWN LIMITATIONS, se o nucleo ficar verde e houver alguma limitacao de browser/ambiente controlada.
- GO, so se a matriz fechar limpa mesmo.
