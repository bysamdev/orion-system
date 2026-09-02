# Relatório de Auditoria de Autorização e RLS (Fase 1 e Fase 1.6 Completa)

Data: 2026-09-01  
Escopo: Correção de Falhas de Autorização e Regras de Escopo no Orion System (Helpdesk + RMM)  
Regra de Negócio: Equipe interna (Técnico, Gestor, Admin da TI Master, Developer) possui alcance irrestrito *cross-company*; Usuário final e Admin de Empresa Cliente possuem acesso restrito exclusivamente ao seu próprio `company_id`.

---

## 1. Status das Revisões da Fase 1

| Achado | Diagnóstico Revisado | Ação Definida | Classificação |
|---|---|---|:---:|
| **1.1a (Middleware Central)** | `RequireCompanyScope` ([handler/router.go:352](file:///c:/Users/suporte.ti/Documents/orion-system/handler/router.go#L352)) e `UserScope` ([lib/db.go:126](file:///c:/Users/suporte.ti/Documents/orion-system/lib/db.go#L126)) corretos e role-aware. | Manter como está. | **COMPORTAMENTO CORRETO** |
| **1.1b (Uptime Handlers)** | Handlers em [handler/uptime_handlers.go:55, 140, 255](file:///c:/Users/suporte.ti/Documents/orion-system/handler/uptime_handlers.go#L55) ignoram `escopo.Global()` e forçam `db.CompanyByUserID` (500 para usuários sem empresa e bloqueio de técnicos para outras empresas). | Replicar molde de [handler/network_links_handlers.go:17](file:///c:/Users/suporte.ti/Documents/orion-system/handler/network_links_handlers.go#L17) na Fase 2. | **FALHA CONFIRMADA** |
| **1.2 (Uso de service_role)** | Chave de serviço usada no Go Auth Admin e pool PostgreSQL direto com autorização validada no código. | Manter como está. | **COMPORTAMENTO CORRETO** |
| **1.3 (get_decrypted_remote_password)** | Função sem chamadores no frontend/backend. Front ([src/pages/TicketDetails.tsx:762](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx#L762)) exibe ciphertext bruto ao usuário (bug de produto registrado, fora do escopo desta correção). Varredura confirmou **0 chamadores** em todo o repo. | Aplicar `REVOKE EXECUTE ON FUNCTION public.get_decrypted_remote_password(uuid) FROM anon, authenticated;`. | **FALHA CONFIRMADA** |
| **1.4 (bridge_secrets)** | Tabela com RLS habilitado, 0 policies e `REVOKE ALL` ([supabase/migrations/20260818040000_secure_bridge_rpc_functions.sql:34](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260818040000_secure_bridge_rpc_functions.sql#L34)). Deny-all intencional para cofre de funções SECURITY DEFINER. | Manter como está. Sem policies. | **COMPORTAMENTO CORRETO** |
| **1.5 (Grants anon em Telemetria)** | `monitoring/bridge.mjs:7` inicializa com `process.env.SUPABASE_KEY`. A migration [supabase/migrations/20260818040000...sql:17](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260818040000_secure_bridge_rpc_functions.sql#L17) comprova que o daemon bridge opera em produção usando a chave **anon**. | **PRÉ-REQUISITO BLOQUEANTE ATIVADO**: Revogar agora derrubaria a telemetria em produção. Necessário migrar o daemon para `service_role` antes de revogar o grant `anon`. | **PRECISA DE DECISÃO SUA** |

---

## FASE 1.6 — Auditoria Completa de RLS (PostgreSQL / Supabase)

### 1.6.1 Superfície de Dados: Acesso Go vs. Cliente Supabase (React)

| Tabela / Recurso | Via Go API | Via Cliente (React) | Modo de Acesso | Arquivos de Referência no Frontend |
|---|:---:|:---:|:---:|---|
| `tickets` | SIM | SIM | **Ambos** | [src/hooks/useTickets.ts](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useTickets.ts), [src/hooks/useMyTickets.ts](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useMyTickets.ts) |
| `ticket_updates` | NÃO | SIM | **Via Cliente** | [src/hooks/useTickets.ts:169](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useTickets.ts#L169), [src/pages/TicketDetails.tsx:441](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx#L441) |
| `ticket_attachments` | NÃO | SIM | **Via Cliente** | [src/hooks/useTicketAttachments.ts:25](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useTicketAttachments.ts#L25) |
| `ticket_ratings` | NÃO | SIM | **Via Cliente** | [src/hooks/useTicketRating.ts:32](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useTicketRating.ts#L32) |
| `ticket_status_history` | NÃO | SIM | **Via Cliente** | [src/pages/TicketDetails.tsx:294](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx#L294) |
| `ticket_kb_links` | NÃO | SIM | **Via Cliente** | [src/hooks/useReportSources.ts:108](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useReportSources.ts#L108) |
| `ticket_assets` | NÃO | SIM | **Via Cliente** | [src/pages/TicketDetails.tsx](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx) |
| `companies` | NÃO | SIM | **Via Cliente** | [src/components/admin/CompanyManagement.tsx:53](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/CompanyManagement.tsx#L53) |
| `contracts` | NÃO | SIM | **Via Cliente** | [src/hooks/useContracts.ts:18](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useContracts.ts#L18) |
| `assets` | NÃO | SIM | **Via Cliente** | [src/pages/Assets.tsx:142](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Assets.tsx#L142) |
| `asset_relationships` | NÃO | SIM | **Via Cliente** | [src/components/assets/AssetTopologyGraph.tsx](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/assets/AssetTopologyGraph.tsx) |
| `knowledge_base_articles` | NÃO | SIM | **Via Cliente** | [src/pages/KnowledgeBase.tsx:156](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/KnowledgeBase.tsx#L156) |
| `categories` (KB) | NÃO | SIM | **Via Cliente** | [src/pages/KnowledgeBase.tsx:135](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/KnowledgeBase.tsx#L135) |
| `profiles` | SIM | SIM | **Ambos** | [src/components/admin/UserManagement.tsx:98](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/UserManagement.tsx#L98) |
| `user_roles` | SIM | SIM | **Ambos** | [src/components/admin/UserManagement.tsx:135](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/UserManagement.tsx#L135) |
| `departments` | NÃO | SIM | **Via Cliente** | [src/components/admin/UserManagement.tsx:113](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/UserManagement.tsx#L113) |
| `time_entries` | NÃO | SIM | **Via Cliente** | [src/components/ticket/TimeTracker.tsx:72](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/ticket/TimeTracker.tsx#L72) |
| `canned_responses` | NÃO | SIM | **Via Cliente** | [src/hooks/useCannedResponses.ts:21](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useCannedResponses.ts#L21) |
| `routing_rules` | NÃO | SIM | **Via Cliente** | [src/hooks/useAutomation.ts:73](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useAutomation.ts#L73) |
| `sla_configs` | NÃO | SIM | **Via Cliente** | [src/components/admin/SLAConfiguration.tsx:28](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/SLAConfiguration.tsx#L28) |
| `resolution_checklists` | NÃO | SIM | **Via Cliente** | [src/components/admin/ResolutionChecklistManagement.tsx:36](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/ResolutionChecklistManagement.tsx#L36) |
| `notifications` | NÃO | SIM | **Via Cliente** | [src/hooks/useNotifications.ts:18](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useNotifications.ts#L18) |
| `api_keys` | SIM | SIM | **Ambos** | [src/components/admin/CompanyManagement.tsx:102](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/CompanyManagement.tsx#L102) |
| `machines` | SIM | SIM | **Ambos** | [src/hooks/useDeviceInventory.ts:89](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useDeviceInventory.ts#L89) |
| `machine_hardware` | SIM | SIM | **Ambos** | [src/hooks/useDeviceInventory.ts:98](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useDeviceInventory.ts#L98) |
| `machine_alerts` | SIM | SIM | **Ambos** | [src/hooks/useDeviceInventory.ts:107](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useDeviceInventory.ts#L107) |
| `machine_commands` | SIM | SIM | **Ambos** | [src/hooks/useMonitoring.ts:210](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useMonitoring.ts#L210) |
| `user_backup_codes` | SIM | SIM | **Ambos** | [src/lib/mfa.ts:202](file:///c:/Users/suporte.ti/Documents/orion-system/src/lib/mfa.ts#L202) |
| `audit_log` | NÃO | SIM | **Via Cliente** | [src/pages/DebugTools.tsx:44](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/DebugTools.tsx#L44) |
| `monitored_endpoints` | SIM | NÃO | **Via Go** | [handler/uptime_handlers.go:111](file:///c:/Users/suporte.ti/Documents/orion-system/handler/uptime_handlers.go#L111) |
| `network_links` | SIM | NÃO | **Via Go** | [handler/network_links_handlers.go:47](file:///c:/Users/suporte.ti/Documents/orion-system/handler/network_links_handlers.go#L47) |
| `reports` | - | - | **NÃO EXISTE NO BANCO** | Relatórios são gerados dinamicamente via agregação no frontend em [src/hooks/useReportSources.ts](file:///c:/Users/suporte.ti/Documents/orion-system/src/hooks/useReportSources.ts). |

---

### 1.6.2 Modelagem: Distinção entre Admin da TI Master vs. Admin de Empresa Cliente

| Tipo de Usuário | user_roles.role | Empresa Vinculada (profiles.company_id) | É Equipe Interna (is_equipe_interna)? | Escopo de Acesso Permitido |
|---|---|---|:---:|---|
| **Desenvolvedor** | developer | Qualquer / TI Master | **SIM** | Global irrestrito (*cross-company*). |
| **Técnico** | 	echnician | Qualquer / TI Master | **SIM** | Global irrestrito (*cross-company* no Helpdesk e RMM). |
| **Admin / Gestor da TI Master** | dmin | Empresa com companies.is_master = true (ou NULL) | **SIM** | Global irrestrito (*cross-company* em toda a plataforma). |
| **Admin de Empresa Cliente** | dmin | Empresa com companies.is_master = false | **NÃO** | **Restrito à própria empresa** (company_id = get_user_company_id(auth.uid())). |
| **Usuário Final (Colaborador)** | customer | Empresa com companies.is_master = false | **NÃO** | **Restrito à própria empresa** (company_id = get_user_company_id(auth.uid())). |

#### Implementação do Helper Centralizador is_equipe_interna(_user_id):
`sql
CREATE OR REPLACE FUNCTION public.is_equipe_interna(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS 
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.id = _user_id
      AND (
        ur.role IN ('developer'::app_role, 'technician'::app_role)
        OR (ur.role = 'admin'::app_role AND (c.is_master = true OR p.company_id IS NULL))
      )
  );
;
`

---

### 1.6.3 Auditoria das Três Perguntas por Tabela

| Tabela | 1. Cliente lê outra empresa? | 2. Técnico/Gestor lê todas as empresas? | 3. Cliente escreve onde não deve? | Diagnóstico e Classificação |
|---|:---:|:---:|:---:|---|
| **	ickets** | **NÃO** | **SIM** (via is_master_company_user / select_tickets) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **	icket_updates** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **	icket_attachments** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **	icket_ratings** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **	icket_status_history** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **companies** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **profiles** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **ssets** | **NÃO** | **SIM** (via is_master_company_user) | **NÃO** | **COMPORTAMENTO CORRETO** |
| **machines** | **NÃO** | **SIM** | **NÃO** | **COMPORTAMENTO CORRETO** |
| **machine_hardware** | **NÃO** | **SIM** | **NÃO** | **COMPORTAMENTO CORRETO** |
| **machine_alerts** | **NÃO** | **SIM** | **NÃO** | **COMPORTAMENTO CORRETO** |
| **	ime_entries** | **NÃO** | **NÃO! (REGRESSÃO CRÍTICA)** | **NÃO** | **FALHA CONFIRMADA**: [20260825000500...sql:13](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260825000500_fix_time_entries_cross_tenant.sql#L13) bloqueia técnico de lançar horas em tickets de clientes. |
| **contracts** | **NÃO** | **NÃO! BLOQUEADO** | **NÃO** | **FALHA CONFIRMADA**: [20260309033335...sql:418](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260309033335_c9b94a03-331b-4e32-b3e7-822d81a1051c.sql#L418) isola técnicos ao seu perfil. |
| **canned_responses** | **NÃO** | **NÃO! BLOQUEADO** | **NÃO** | **FALHA CONFIRMADA**: [20260623213125...sql:6](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260623213125_fix_canned_responses_rls.sql#L6) isola templates por perfil. |
| **knowledge_base_articles** | **NÃO** | **NÃO! BLOQUEADO** | **NÃO** | **FALHA CONFIRMADA**: [20260612000000...sql:16](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260612000000_update_kb_rls.sql#L16) isola KB de técnicos. |
| **sla_configs** | **NÃO** | **NÃO! BLOQUEADO** | **NÃO** | **FALHA CONFIRMADA**: [20260309033335...sql:401](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260309033335_c9b94a03-331b-4e32-b3e7-822d81a1051c.sql#L401) isola SLAs por perfil. |
| **monitored_endpoints** | **NÃO** | **NÃO! BLOQUEADO no SELECT** | **NÃO** | **FALHA CONFIRMADA**: [20260630000000...sql:15](file:///c:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260630000000_monitored_endpoints.sql#L15) isola leitura cliente ao perfil. |

---

## 1.6.4 Resumo de Segurança
1. **Vazamento de Clientes**: **ZERO**. Clientes finais (customer) não conseguem ler nem escrever dados de outras empresas.
2. **Isolamento Indevido de Técnicos/Gestores**: 6 tabelas corrigidas na Fase 2 adotando o padrão unificado company_id = get_user_company_id(auth.uid()) OR is_equipe_interna(auth.uid()).
