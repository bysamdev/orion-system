# Relatório de Limpeza 06 — Supabase (Edge Functions e Objetos de Banco)

**Subagente**: Subagente 6 (Auditor de Edge Functions e Schema Supabase)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Escopo**: `supabase/functions/`, `supabase/migrations/`, chamadores no frontend e backend.  
**Regra Aplicada**: 100% READ-ONLY. Zero comandos DDL/DROP no Supabase.  

---

## 1. Auditoria de Edge Functions (`supabase/functions/`)

Varredura de chamadas via `supabase.functions.invoke('nome')`, chamadas HTTP diretas e referências em código:

| Edge Function | Chamadores Identificados | Status | Recomendação |
| :--- | :--- | :---: | :--- |
| `admin-update-user` | `src/components/admin/UserManagement.tsx` | **VIVA** | Manter |
| `check-rate-limit` | `src/pages/DebugTools.tsx`, `src/pages/NewTicket.tsx` | **VIVA** | Manter |
| `create-new-user` | **NENHUM** (0 chamadores em todo o repositório) | **OBSOLETA** | Substituída por `create-user-credentials` e endpoint Go. Candidata a remoção. |
| `create-user-credentials` | `src/components/admin/UserManagement.tsx` | **VIVA** | Manter |
| `delete-user-admin` | `src/components/admin/UserManagement.tsx`, `merge-users` | **VIVA** | Manter |
| `email-to-ticket` | `src/pages/Settings.tsx` (Exibição de URL de webhook) | **VIVA / PRODUTO** | Manter (Decisão de produto sobre provedor externo) |
| `invite-user-resend` | `src/lib/reports/types.ts`, `src/components/admin/UserManagement.tsx` | **VIVA** | Manter |
| `merge-users` | `src/components/admin/UserManagement.tsx` | **VIVA** | Manter |
| `reset-password-with-token` | `src/pages/SetPassword.tsx` | **VIVA** | Manter |
| `send-password-changed-alert` | `src/pages/Settings.tsx` | **VIVA** | Manter |
| `whatsapp-webhook` | **NENHUM** (Stub vazio que apenas retorna status 200) | **STUB INCOMPLETO** | Arquivar ou manter como placeholder |

---

## 2. Objetos de Banco de Dados e Migrações

1. **`supabase/migrations/` é INTOCÁVEL**:
   - Conforme regra inegociável #3, todas as migrações em `supabase/migrations/` devem ser preservadas para manter o histórico de schema e auditoria.
2. **Funções e Triggers de Banco Documentados**:
   - `fn_auto_route_ticket()`: Função morta no Postgres (o trigger `AFTER INSERT` de produção invoca `tr_auto_route_ticket()`).
   - `knowledge_articles`: Tabela legada sem referências (a tabela oficial do sistema é `knowledge_base_articles`).
   - *Nota*: Nenhum comando DDL será executado contra o banco de dados.
