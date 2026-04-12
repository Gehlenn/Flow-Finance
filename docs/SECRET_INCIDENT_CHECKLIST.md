# Checklist de Incidente com Segredos

## Objetivo

Checklist curto para responder a exposição acidental de chaves, tokens, segredos de webhook ou credenciais equivalentes.

## Ações imediatas

1. revogar e rotacionar as credenciais expostas
2. invalidar sessões, tokens e webhooks relacionados quando aplicável
3. confirmar que nenhum segredo real ficou em arquivo rastreado
4. remover valores sensíveis de arquivos temporários e editores
5. notificar os mantenedores sobre o escopo do incidente

## Verificação do repositório

1. buscar padrões de segredo em arquivos rastreados
2. verificar histórico Git quando houver suspeita de commit indevido
3. confirmar que arquivos `.env` e equivalentes seguem ignorados
4. manter apenas placeholders em arquivos de exemplo

## Validação após rotação

1. atualizar variáveis locais e de ambiente
2. validar autenticação e webhooks nos fluxos afetados
3. rerodar lint e testes impactados
4. rerodar cobertura crítica quando o incidente tocar IA, finanças ou fluxo compartilhado

## Passos específicos para Stripe

1. rotacionar chave secreta e segredo de assinatura de webhook
2. atualizar o backend com os novos valores
3. redisparar eventos quando necessário para validar assinatura
4. validar billing em mock e em sandbox real quando fizer sentido

## Prevenção mínima

1. manter placeholders em `.env.example` e `.env.local.example`
2. não colar segredos reais em markdown ou notas soltas
3. manter arquivos locais de segredo fora do Git
4. usar varredura de segredo no CI quando possível
