# Diagnostico do Problema de Purge no Tailwind CSS

**Data original:** 2026-03-10  
**Contexto:** Flow Finance v0.4.0  
**Status historico:** incidente critico ja identificado e tratado no ciclo correspondente

## Resumo do problema

Em um corte anterior do projeto, a aplicacao compilou sem classes visuais essenciais do Tailwind. O resultado pratico foi uma UI sem cores, sombras e variacoes de estado, apesar de o CSS base estar sendo carregado.

## Causa raiz identificada

O problema principal era o uso extensivo de classes dinamicas em template literals e retornos de funcao, o que impedia a analise estatica do Tailwind durante a compilacao.

Padroes problemáticos encontrados naquele momento:

- ternarios dentro de `className`
- classes retornadas por funcoes utilitarias
- ausencia de `safelist` para classes sensiveis a purge

## Efeito observado

- classes de layout continuavam presentes
- classes de cor, tipografia e variantes dark desapareciam
- a aplicacao ficava visualmente quebrada mesmo sem erro fatal de runtime

## Arquivos impactados no recorte original

- `App.tsx`
- `Dashboard.tsx`
- `TransactionList.tsx`
- `SpendingAlerts.tsx`
- `Settings.tsx`
- paines auxiliares de debug e monitoramento

## Correcao recomendada no incidente

1. Adicionar `safelist` no `tailwind.config.cjs`.
2. Extrair variacoes de classe para mapas estaticos e enums.
3. Recompilar e verificar o CSS gerado.
4. Evitar dependencia de ternarios extensos em `className`.

## Padrao de correcao aprovado

Em vez de construir classes diretamente no template:

- definir mapas estaticos de estado
- selecionar chaves como `active`, `inactive`, `warning`, `danger`
- manter as strings de classe visiveis para o compilador

## Valor atual deste documento

Este material permanece util como memoria tecnica de um incidente de build/frontend. Ele e historico e serve como referencia para evitar regressao semelhante em novas alteracoes de UI.
