# Flow Finance — SaaS Foundation v0.9.x

## Estrutura inicial criada para:
- Autenticação robusta (JWT, refresh token, OAuth)
- Multi-tenant (isolamento de workspaces/empresas)
- Painel de administração (gestão de usuários, planos, auditoria)
- Billing real (Stripe; exportacao de dados ainda nao disponivel)

### Próximos passos sugeridos:
1. Implementar endpoints REST para autenticação e tenants
2. Definir modelos de dados para usuários, tenants e billing
3. Integrar Stripe e manter exportacao de dados (PDF/Excel) fora do plano pago ate existir backend real
4. Criar painel admin web (React ou similar)
5. Adicionar testes unitários e E2E para todos os fluxos críticos
6. Documentar políticas de retenção, LGPD/GDPR e disaster recovery

> Estrutura pronta para evolução incremental até v1.0.
