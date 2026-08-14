# Relatório de Auditoria: RLS e RBAC no Supabase Postgres (Subagente 8)

## Escopo
Auditoria completa de segurança em `supabase/migrations/` e regras de Row Level Security.

## Achados

### [Critical] Funções SECURITY DEFINER sem `SET search_path = public`
- **Arquivo:Linha**: Migrações históricas (`supabase/migrations/*.sql`)
- **Descrição**: Funções com privilégio `SECURITY DEFINER` que não fixam explicitamente `SET search_path = public` são vulneráveis a ataques de sequestro de schema (search_path injection) caso executadas com privilégios de superusuário.
- **Recomendação**: Garantir que todas as funções SECURITY DEFINER no banco possuam `SET search_path = public` (já parcialmente corrigido em migrações recentes).

### [High] Políticas RLS que utilizam Funções Utilitárias sem GRANT EXECUTE
- **Arquivo:Linha**: `supabase/migrations/20260813180000_restore_rls_helpers.sql`
- **Descrição**: Políticas RLS em `profiles` e `tickets` dependem de `has_role()` e `ticket_belongs_to_user_company()`. Se o role `authenticated` não tiver permissão `EXECUTE`, as queries falham com `403 Permission Denied`.
- **Recomendação**: Manter a migração `20260813180000_restore_rls_helpers.sql` ativa e garantir que novos helpers de RLS recebam `GRANT EXECUTE TO authenticated`.

### [Medium] Tabelas com Colunas de Tenant Nuláveis em Regras RLS
- **Arquivo:Linha**: `supabase/migrations/20251022011630_*.sql` (tabela `audit_log`)
- **Descrição**: A coluna `changed_by` em `audit_log` e `ticket_status_history` é anulável para suportar ações do sistema. Políticas que fazem `changed_by = auth.uid()` devem ter tratamento explícito para `IS NULL` por segurança.
- **Recomendação**: Usar `(changed_by = (select auth.uid()) OR (select auth.uid()) IS NULL)` apenas em contextos administrativos específicos.

## RESUMO EXECUTIVO
- **Critical**: 1
- **High**: 1
- **Medium**: 1
- **Low**: 0
- **Total de Achados**: 3
