# Contrato de Tipografia e Cor (Flow Finance)

Data: 2026-05-12
Escopo inicial: app web/mobile (telas principais e secundarias do produto)

## Objetivo

Estabelecer um contrato simples e auditavel para evitar regressao visual e manter legibilidade operacional.

## 1) Tipografia

Escala permitida para UI operacional:
- `text-xs`
- `text-sm`
- `text-base`
- `text-lg`
- `text-xl`
- `text-2xl`

Regras:
- Evitar tamanhos arbitrarios em px para copy funcional.
- Titulos de secao: `text-lg` ou `text-xl`.
- Labels auxiliares e badges: `text-xs`.
- Conteudo de leitura principal: `text-sm` ou `text-base`.

Pesos permitidos:
- `font-medium`
- `font-semibold`
- `font-bold`
- `font-black` (somente titulos/chamadas curtas)

Nao permitido em novas telas:
- `text-[7px]`, `text-[8px]`, `text-[9px]`, `text-[10px]` para texto funcional.

## 2) Cor

Diretriz:
- Priorizar tokens/classes sem hex hardcoded em estrutura de layout.
- Reservar hex/rgb apenas para casos tecnicos de grafico/engine visual quando estritamente necessario.

Paleta de UI (semantica):
- Primaria: `indigo`
- Neutros: `slate`
- Sucesso: `emerald`
- Alerta: `amber`
- Critico: `rose`

Regras:
- Header/hero padronizado com classes Tailwind sem hex inline.
- Estados (sucesso, alerta, erro) devem usar semantica consistente em todas as telas.
- Evitar combinacoes de gradientes ad-hoc fora do padrao do app.

## 3) Estados UX

Todo fluxo deve cobrir, com consistencia:
- loading
- vazio
- erro
- sucesso

Regras:
- Mensagem curta e objetiva.
- Sempre incluir proximo passo quando houver erro.

## 4) Navegacao e semantica de produto

Navegacao principal alvo:
- Caixa
- Transacoes
- Receitas
- Consultor IA
- Ajustes

Regra:
- Funcionalidades avancadas devem entrar por contexto dentro de telas nucleares.

## 5) Checklist de PR para UI

Antes de concluir uma mudanca visual:
- Verificar se nao introduziu `text-[7px|8px|9px|10px]` em UI operacional.
- Verificar se nao introduziu gradiente/hex hardcoded em layout principal.
- Confirmar estados de loading/vazio/erro/sucesso no fluxo alterado.
- Rodar lint e testes do recorte impactado.
