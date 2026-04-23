# Estrategia de Skip em E2E

## Papel deste documento

Registrar quando skips condicionais em E2E sao aceitaveis e quando viram mascaramento de regressao.

## Principio

Os testes E2E do Flow Finance podem adaptar a execucao ao ambiente real para evitar:

- falso negativo por indisponibilidade transitória
- erro de infraestrutura sendo tratado como bug de produto
- execucao de roteiro desktop em viewport mobile ou o inverso

## Categorias legitimas

### Dependencia de fixture

Usada quando a interface autenticada ou elementos criticos ainda nao ficaram visiveis no momento da checagem.

### Dependencia de backend

Usada quando backend ou servico externo necessario nao esta disponivel.

### Dependencia de dispositivo

Usada quando o cenario e desktop-only ou mobile-only.

### Decisao de produto

Usada quando a funcionalidade foi congelada, desligada ou removida por direcao de produto.

## Regra operacional

Um skip legitimo:

- explica a causa
- nao mascara bug real
- e limitado ao contexto que justifica o skip

Um skip invalido:

- esconde regressao
- vira substituto de correcao estrutural
- permanece indefinidamente sem motivo verificavel

## Referencias

- [playwright.config.ts](E:\app e jogos criados\Flow-Finance\playwright.config.ts)
- [tests/e2e/helpers](E:\app e jogos criados\Flow-Finance\tests\e2e\helpers)
