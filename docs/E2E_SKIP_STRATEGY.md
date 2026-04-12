# Estratégia de Skip em E2E

## Objetivo

Registrar por que a suíte E2E usa skips condicionais em runtime em vez de skips estáticos e cegos.

## Princípio

Os testes E2E do Flow Finance adaptam a execução ao ambiente real para evitar:

- falso negativo por indisponibilidade transitória
- erro de infraestrutura sendo tratado como bug de produto
- instabilidade inútil em cenários dependentes de backend, fixture ou tipo de dispositivo

## Categorias principais

### 1. Dependência de fixture

Usado quando a interface autenticada ou elementos críticos ainda não ficaram visíveis no momento da checagem.

Objetivo:

- proteger contra flakiness de inicialização

### 2. Dependência de backend

Usado quando o backend ou serviço externo necessário não está disponível.

Objetivo:

- degradar com clareza quando a infraestrutura do teste não responde

### 3. Dependência de dispositivo

Usado quando o cenário é desktop-only ou mobile-only.

Objetivo:

- não forçar o mesmo roteiro em contexto de viewport incompatível

### 4. Decisão de produto

Usado quando a funcionalidade foi congelada ou desligada por direção de produto.

Objetivo:

- explicitar que o skip não é acidente técnico

## Interpretação correta

Um skip legítimo:

- não mascara bug real
- documenta a razão
- mantém a suíte mais honesta

## Diretriz operacional

Skips devem continuar:

- explícitos
- rastreáveis
- limitados a causas legítimas

Skips não devem virar:

- atalho para esconder regressão
- substituto de correção estrutural

## Referências

- [playwright.config.ts](E:\app e jogos criados\Flow-Finance\playwright.config.ts)
- [tests/e2e/helpers](E:\app e jogos criados\Flow-Finance\tests\e2e\helpers)
