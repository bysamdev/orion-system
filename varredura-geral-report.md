# Relatório de Varredura Geral do Orion System
**Data da Auditoria:** 13 de Agosto de 2026  
**Ambiente:** Produção (React 18 + TypeScript + Vite + Tailwind + shadcn/ui | Go + Chi no Vercel Edge Serverless | Supabase PostgreSQL com RLS | Agente RMM Windows em Go)  
**Status da Ação:** Auditoria Somente Leitura (Nenhum código foi modificado ou deletado).

---

## 1. Resumo Executivo

Esta auditoria geral foi executada por 4 subagentes especializados operando em paralelo para mapear com precisão o débito técnico, código morto, brechas de segurança, classificação de arquivos de trabalho e validação via histórico Git.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ESTATÍSTICAS DA VARREDURA                         │
├────────────────────────────────┬────────────────────────────────────────────┤
│ 🚨 Achados de Segurança        │ 10 itens (3 Críticos, 2 Altos, 3 Médios,   │
│                                │           2 Baixos)                        │
│ 💀 Código Morto & Órfão        │ 37 scripts/dumps na raiz, 14 componentes   │
│                                │    UI, 12 dependências NPM, 2 funcs Go,    │
│                                │    3 migrations SQL triplicadas            │
│ 🧹 Arquivos para Limpeza       │ 45 Seguro para Deletar (~34.5 MB),         │
│                                │ 6 Precisa Revisão, 12 Não Tocar (Vitais)   │
│ 🔍 Validação Git & CI/CD       │ 96 transações de reflog cruzadas,          │
│                                │ Vercel Serverless & Crons mapeados         │
└────────────────────────────────┴────────────────────────────────────────────┘
```

> [!CAUTION]
> ### ⚠️ DESTAQUE DE SEGURANÇA CRÍTICA (P0 - Risco Imediato)
> 1. **SEC-01 (Cross-Tenant RCE):** O handler `monitoringCreateCommand` (`handler/mon_handlers.go:449`) utiliza `if userRole != "admin"` para liberar checagem de empresa. Isso permite que qualquer administrador de um cliente (**Empresa A**) envie comandos remotos (`cmd /C`, `orion-install`) para máquinas de clientes concorrentes (**Empresas B, C, D**).
> 2. **SEC-02 (RLS Bypass em Gestão de Usuários):** Handlers de administração de contas (`handler/fn_handlers.go` e Edge Functions do Supabase) usam `service_role` sem validar se o `user_id` alvo ou o `company_id` informado pertencem à empresa do administrador solicitante (Cross-Tenant Account Takeover).
> 3. **SEC-03 (Spoofing de Tickets por Email):** A Edge Function `email-to-ticket/index.ts` é pública sem validação de HMAC/secret, permitindo injeção e criação de chamados forjados em nome de qualquer cliente.
>
> *Nota de Governança:* Conforme instrução, estas correções de segurança crítica estão documentadas e devem ser escaladas para tratamento dedicado.

---

## 2. Achados de Segurança (Ordenados por Severidade)

### [CRÍTICO] SEC-01 — Cross-Tenant Remote Code Execution (RCE) via `monitoringCreateCommand`
- **Localização:** [`handler/mon_handlers.go#L449-L455`](file:///C:/Users/suporte.ti/Documents/orion-system/handler/mon_handlers.go#L449-L455)
- **Descrição do Risco:**  
  No agendamento de comandos remotos executados pelo agente RMM (`cmd.exe /C`), a validação de multitenancy isenta qualquer usuário com `role == "admin"`. Em um ambiente multitenant SaaS, cada empresa possui administradores locais. Como resultado, um admin da Empresa A tem permissão para disparar comandos em máquinas de outras empresas.
- **Recomendação:**  
  Substituir a checagem por validação de escopo seguro (`escopo.PodeVerEmpresa(machine.CompanyID)` ou `escopo.Global()`).

---

### [CRÍTICO] SEC-02 — RLS Bypass e Falta de Validação Multitenant em User Management
- **Localização:**  
  - [`handler/fn_handlers.go#L19-L272`](file:///C:/Users/suporte.ti/Documents/orion-system/handler/fn_handlers.go#L19-L272) (`adminUpdateUser`, `deleteUserAdmin`, `createUserCredentials`)
  - [`supabase/functions/admin-update-user/index.ts#L65-L218`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/admin-update-user/index.ts#L65-L218)
  - [`supabase/functions/create-user-credentials/index.ts#L83-L170`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/create-user-credentials/index.ts#L83-L170)
  - [`supabase/functions/delete-user-admin/index.ts#L57-L126`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/delete-user-admin/index.ts#L57-L126)
  - [`supabase/functions/invite-user-resend/index.ts#L52-L152`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/invite-user-resend/index.ts#L52-L152)
- **Descrição do Risco:**  
  As operações de criação, alteração e exclusão de usuários executam com cliente `service_role` (bypass de RLS). O código apenas confere se quem chamou é `admin`, mas não valida se o usuário alvo ou o `company_id` passado no payload pertencem à empresa do solicitante. Isso viabiliza Account Takeover e criação de admins em empresas terceiras.
- **Recomendação:**  
  Forçar que `company_id` seja estritamente comparado com `scope.CompanyID` (a menos que `scope.Global()`) e que o perfil alvo seja verificado antes de invocar `auth.admin`.

---

### [CRÍTICO] SEC-03 — Webhook de Email sem Autenticação / Injeção Arbitrária de Tickets
- **Localização:** [`supabase/functions/email-to-ticket/index.ts#L9-L64`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/email-to-ticket/index.ts#L9-L64)
- **Descrição do Risco:**  
  A Edge Function `email-to-ticket` está configurada com `verify_jwt = false` e não valida assinaturas HMAC (SendGrid/Mailgun/Postmark) nem token de segredo. Qualquer requisição HTTP POST externa pode criar chamados em nome de qualquer cliente.
- **Recomendação:**  
  Implementar validação de assinatura criptográfica HMAC ou token estático de cabeçalho (`X-Webhook-Secret`).

---

### [ALTO] SEC-04 — Chave de Criptografia Simétrica PGP Hardcoded em Migration SQL
- **Localização:** [`supabase/migrations/20260811000002_phase3_security.sql#L25-L59`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260811000002_phase3_security.sql#L25-L59)
- **Descrição do Risco:**  
  A rotina de criptografia de senhas de acesso remoto (`pgp_sym_encrypt` e `pgp_sym_decrypt`) utiliza a passphrase estática `'orion-secret-256'` hardcoded no arquivo `.sql` versionado no Git.
- **Recomendação:**  
  Migrar a chave para o Supabase Vault (`vault.decrypted_secrets`) ou ler via `current_setting('app.settings.encryption_key', true)`.

---

### [ALTO] SEC-05 — Política RLS de `api_keys` Permite que Admins de Tenants Gerenciem Chaves Alheias
- **Localização:** [`supabase/migrations/20260812160000_fix_api_keys_rls_policy.sql#L4-L17`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260812160000_fix_api_keys_rls_policy.sql#L4-L17)
- **Descrição do Risco:**  
  A política RLS concede acesso total para qualquer usuário autenticado com papel `admin`. Não há cláusula restringindo por `company_id = get_user_company_id(auth.uid())`.
- **Recomendação:**  
  Ajustar a policy para exigir correspondência de `company_id` para administradores não-globais.

---

### [MÉDIO] SEC-06 — Exclusão de Links de Rede sem Checagem de Papel & Risco Cross-Tenant
- **Localização:** [`handler/network_links_handlers.go#L116-L143`](file:///C:/Users/suporte.ti/Documents/orion-system/handler/network_links_handlers.go#L116-L143) e [`lib/network_links.go#L176-L184`](file:///C:/Users/suporte.ti/Documents/orion-system/lib/network_links.go#L176-L184)
- **Descrição do Risco:**  
  A rota `DELETE /api/monitoring/network/links/{id}` não exige papel de técnico/admin (qualquer usuário autenticado pode chamar). Além disso, em `lib/network_links.go`, se `companyID` for vazio/nulo, executa `DELETE FROM network_links WHERE id = $1` sem escopo de empresa.
- **Recomendação:**  
  Exigir `requireAdminOrDeveloper` no handler e travar deleção sem `company_id`.

---

### [MÉDIO] SEC-07 — Enumeração Cross-Tenant de Tickets via `ticketResolveHandler`
- **Localização:** [`handler/ticket_handlers.go#L18-L63`](file:///C:/Users/suporte.ti/Documents/orion-system/handler/ticket_handlers.go#L18-L63)
- **Descrição do Risco:**  
  A rota `/api/tickets/resolve/{id}` resolve números sequenciais de ticket (`1001`, `1002`) para UUID sem validar se o ticket pertence à empresa do chamador.
- **Recomendação:**  
  Validar a empresa do ticket resolvido contra o `UserScope`.

---

### [MÉDIO] SEC-08 — Gateway Supabase com `verify_jwt = false` em Funções Administrativas
- **Localização:** [`supabase/config.toml#L6-L26`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/config.toml#L6-L26)
- **Descrição do Risco:**  
  Várias funções administrativas estão com verificação de JWT desabilitada na borda do gateway, transferindo toda a segurança para a validação manual do código Deno.
- **Recomendação:**  
  Habilitar `verify_jwt = true` em todas as funções que exigem sessão de usuário.

---

### [BAIXO] SEC-09 — Credenciais de Teste em Texto Puro em Scripts
- **Localização:**  
  - `test_routing_categories.js:11-12` (`cliente@orionsystem.com` / `password123`)  
  - `test_round_10.py:21, 35, 49` (`admin@orionsystem.com` / `test123456`, `tecnico@...`)
- **Descrição do Risco:**  
  Contas e senhas estáticas expostas em scripts de teste na raiz.
- **Recomendação:**  
  Remover scripts temporários da raiz e utilizar variáveis em `.env.test`.

---

### [BAIXO / BUG] SEC-10 — Erros de Referência (`ReferenceError`) em Edge Functions
- **Localização:**  
  - [`supabase/functions/admin-update-user/index.ts#L88`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/admin-update-user/index.ts#L88): `callerRole` não declarado.  
  - [`supabase/functions/invite-user-resend/index.ts#L67`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/functions/invite-user-resend/index.ts#L67): `roleData` não declarado.
- **Descrição do Risco:**  
  Acessos a variáveis inexistentes em logs após a autenticação disparam exceções 500 em tempo de execução.
- **Recomendação:**  
  Ajustar os logs para a variável correta (`userRoles`).

---

## 3. Código Morto e Débito Técnico

### 3.1. Confiança ALTA (Claramente Morto / Órfão)

| Caminho do Arquivo / Símbolo | Motivo da Classificação |
| :--- | :--- |
| **Componentes Shadcn/UI (14 arquivos):**<br>• `src/components/ui/aspect-ratio.tsx`<br>• `src/components/ui/breadcrumb.tsx`<br>• `src/components/ui/carousel.tsx`<br>• `src/components/ui/context-menu.tsx`<br>• `src/components/ui/drawer.tsx`<br>• `src/components/ui/hover-card.tsx`<br>• `src/components/ui/input-otp.tsx`<br>• `src/components/ui/menubar.tsx`<br>• `src/components/ui/navigation-menu.tsx`<br>• `src/components/ui/pagination.tsx`<br>• `src/components/ui/radio-group.tsx`<br>• `src/components/ui/resizable.tsx`<br>• `src/components/ui/slider.tsx`<br>• `src/components/ui/toggle.tsx`, `toggle-group.tsx` | Componentes instalados na biblioteca de UI que não possuem nenhum `import` em toda a base de código do frontend (`src/`). |
| **Dependências NPM Órfãs (`package.json`):**<br>• `embla-carousel-react`<br>• `input-otp`<br>• `react-resizable-panels`<br>• `vaul`<br>• 9 pacotes `@radix-ui/react-*` associados aos componentes acima | Dependências instaladas para dar suporte aos componentes de UI listados acima, sem uso no código ativo. |
| **Dependência Fantasma:**<br>• `lodash/debounce` em [`src/hooks/useTimerGuard.ts#L4`](file:///C:/Users/suporte.ti/Documents/orion-system/src/hooks/useTimerGuard.ts#L4) | Importa `lodash/debounce`, mas `lodash` não está listado em `dependencies` no `package.json` (risco de falha em instalação limpa). |
| **Posicionamento Incorreto:**<br>• `@types/dompurify` | Declarado em `dependencies` de produção (deve estar em `devDependencies`). |
| **Funções Go Não Chamadas:**<br>• `InsertAlert` ([`lib/monitoring.go#L366`](file:///C:/Users/suporte.ti/Documents/orion-system/lib/monitoring.go#L366))<br>• `MachineCount` ([`lib/monitoring.go#L567`](file:///C:/Users/suporte.ti/Documents/orion-system/lib/monitoring.go#L567)) | `InsertAlert` foi substituído por `InsertAlertIfNotExists`. `MachineCount` foi substituído por `DashboardSummaryData`. |
| **Triplicata de Migrations SQL:**<br>• `supabase/migrations/20251022014746_11d5f38a...sql`<br>• `supabase/migrations/20251022014817_28d54271...sql` | Arquivos de 34.1 KB com conteúdo byte-a-byte idêntico à migration `20251022014710_2d6838e4...sql`. |
| **Edge Function Obsoleta:**<br>• `supabase/functions/create-new-user/index.ts` | Substituída integralmente por `create-user-credentials` e pelo endpoint Go `createUserCredentials`. |
| **Edge Function Incompleta:**<br>• `supabase/functions/whatsapp-webhook/index.ts` | Stub vazio que apenas retorna status 200 sem lógica de negócio. |
| **Script DDL Avulso:**<br>• `migrate_endpoints.go` (na raiz) | Script avulso em Go para criar tabela `monitored_endpoints`. A migration oficial já está versionada em `supabase/migrations/20260630000000_monitored_endpoints.sql`. |

### 3.2. Confiança MÉDIA (Duplicações e Padrões Concorrentes)

| Caminho do Arquivo / Símbolo | Motivo da Classificação |
| :--- | :--- |
| **Rotas Go Concorrentes:**<br>• `/api/monitoring/network/links`<br>• `/api/monitoring/network-links` ([`handler/router.go#L171-L176`](file:///C:/Users/suporte.ti/Documents/orion-system/handler/router.go#L171-L176)) | Ambas as rotas apontam para os mesmos handlers (GET, POST, DELETE) para compatibilidade de transição. |
| **Duplicação Arquitetural de 7 Funções:**<br>• Go (`handler/fn_handlers.go`) vs Supabase Edge Functions (`supabase/functions/`) | O cliente em `src/lib/orion-functions.ts` mantém fallback duplo. Ambas as versões executam regras de negócio semelhantes em linguagens e runtimes diferentes. |
| **`setTimeout(resolve, 500)` em Edge Functions:**<br>• `create-user-credentials/index.ts#L165`<br>• `invite-user-resend/index.ts#L116` | Espera artificial de 500ms para aguardar trigger de banco. Causa de bugs intermitentes sob latência. |

### 3.3. Confiança BAIXA (Necessita Confirmação de Negócio)

| Item | Motivo |
| :--- | :--- |
| `lovable-tagger` (`package.json`) | Plugin Vite de integração com a IDE Lovable. Pode ser removido se o time não utilizar mais o editor Lovable. |

---

## 4. Classificação de Arquivos para Limpeza

### 🟢 SEGURO PARA DELETAR (45 Itens — ~34.5 MB)
*Arquivos sem nenhuma referência ativa no código, build, CI/CD ou runtime.*

1. **Binários e Dumps:**
   - `orion-api.exe` (13.56 MB) — Executável Go compilado na raiz.
   - `orion-agent/orion-agent.exe` (11.06 MB) — Executável compilado dentro da pasta de código do agente.
   - `functions_list.txt` (199.5 KB) — Dump bruto de funções PostgreSQL.
   - `schema_analysis.txt` (55.9 KB) — Dump textual de esquema.
   - `supabase/queries/test_sla.sql` (41 B) — Query manual isolada.
   - `.vscode/settings.json` (2 B) — Arquivo de config vazio (`{}`).

2. **Scripts de Patching / Autofix Antigos (Já incorporados no código):**
   - `fix_NewTicket.py`, `fix_StatsReport.py`, `fix_TicketDetails.py`, `fix_autocomplete.py`, `fix_notifications.py`, `fix_useStats.py`, `patch_stats.js`, `migrate_endpoints.go`

3. **Scripts de Inspeção e Diagnósticos Avulsos:**
   - `analyze.py`, `analyze_schema.py`, `fetch_profiles.cjs`, `fetch_roles.py`, `fetch_tickets.js`, `click_ticket_spy.py`, `debug_error.py`, `debug_ticket.py`, `spy_network.py`

4. **Testes Pontuais e Redundantes na Raiz:**
   - `qa_simplificado.py`, `qa_validation.py`, `run_validation.py`, `test_canned.js`, `test_db.js`, `test_login.py`, `test_modal_2.py`, `test_network.py`, `test_orion.py`, `test_orion_2.py`, `test_round_10.py`, `test_routing_categories.js`, `test_sidebar.py`, `test_ticket.py`, `test_ticket_playwright.py`, `test_ui.py` (A suíte canônica oficial está centralizada em `scripts/qa/run_orion_qa_suite.mjs`).

5. **Artefatos e Diretórios Temporários de IA:**
   - `brain/` (pasta local residual contendo `find_unused_files.py`).
   - `scripts/qa/legacy/` (4 arquivos de QA substituídos).
   - `scripts/qa/reports/qa-report.md` (log antigo).
   - `scratch/error.png`, `scratch/reports_audit.md`, `scratch/reports_design.md`, `scratch/test_prod.mjs`.

---

### 🟡 PRECISA REVISÃO (6 Itens)

1. **`bun.lock` (125 KB) e `bun.lockb` (197 KB):**  
   Concorrem com `package-lock.json`. A Vercel utiliza `npm install`. Recomenda-se apagar os locks do Bun se o npm for o padrão da equipe.
2. **`orion-agent/dist/` (~20.6 MB):**  
   Contém `OrionAgentSetup.exe` e `OrionAgent.msi` gerados pelo WiX. Podem ser excluídos localmente caso não sejam necessários para download manual imediato.
3. **`qa_comprehensive.py` e `qa_ux_validation.py`:**  
   Suítes Python detalhadas. Se não forem usadas em favor do Node/Playwright (`run_orion_qa_suite.mjs`), podem ser removidas ou movidas para `scripts/qa/python/`.
4. **`scripts/qa/tools/` (`take_screenshots.mjs`):**  
   Utilitário de screenshots para homologação visual. Manter se o time de QA utilizar.
5. **`relatorios-refinamento-proposta.md`:**  
   Especificação de novos relatórios. Recomenda-se mover para `docs/`.
6. **Migrations duplicadas (`20251022014746_...`, `20251022014817_...`):**  
   Remover apenas após confirmar se o histórico remoto do Supabase já aplicou a triplicata.

---

### 🔴 NÃO TOCAR (Arquivos Vitais / Risco de Quebra)

| Arquivo / Diretório | Justificativa Técnica |
| :--- | :--- |
| `src/mocks/tickets.ts` | ⚠️ **Importado diretamente em `src/hooks/useTickets.ts`** para execução em modo de desenvolvimento (`import.meta.env.DEV`). Sua exclusão quebra a compilação do Vite/TypeScript! |
| `api/router.go`, `handler/*.go`, `lib/*.go`, `go.mod`, `go.sum` | ⚠️ **É a API Serverless Go da Vercel** para todas as rotas `/api/*` e Crons configurados no `vercel.json`. Não é código morto. |
| `orion-agent/` (exceto `.exe` compilados) | Código-fonte do Agente RMM Windows em Go. Ignorado no build da Vercel via `.vercelignore`, mas ativo no repositório. |
| `.agents/skills/` e `.claude/skills/` | Definições de skills para Antigravity e Claude Code CLI. |
| `graphify-out/` e `.obsidian/` | Grafo semântico e visual do projeto utilizado por agentes de IA. |
| `reports/` (10 relatórios + `SUMMARY.md`) | Documentação formal da auditoria técnica do sistema de Agosto de 2026. |
| `docs/SECURITY-STRIX-2026-08-12.md` | Relatório oficial de triagem e conformidade de segurança. |
| `scripts/audit.sh` | Script shell de auditoria de integridade do banco PostgreSQL. |
| `scripts/qa/run_orion_qa_suite.mjs` | Suíte consolidada oficial de testes E2E do projeto. |

---

## 5. Validação Git & CI/CD dos Itens Marcados para Deletar

O cruzamento entre a árvore de arquivos e o histórico Git confirmou:

1. **Inexistência de Vínculos em CI/CD:**
   - Nenhum dos 45 arquivos marcados como `SEGURO PARA DELETAR` é referenciado em `vercel.json`, `package.json` (scripts), `.github/workflows` ou `vite.config.ts`.
2. **Histórico de Commits e Falsos Positivos:**
   - Os scripts `fix_*.py` foram commits pontuais criados em branches antigas e abandonados após a aplicação dos patches em `.tsx`.
   - O commit `d766892` (*refactor(cleanup)*) já havia tentado remover parte desses arquivos, confirmando a intenção de higiene da equipe.
   - O `.vercelignore` já possui as regras estritas ancoradas na raiz (`/brain`, `/reports`, `/scratch`, `/scripts/qa/reports`, `/orion-agent`), prevenindo que esses resíduos afetem o bundle de produção.
3. **Compilação e Integridade:**
   - A remoção dos 45 itens não afeta o comando `npm run build` nem o comando `go build`.

---

## 6. Próximos Passos e Recomendações de Governança

1. **Aprovação de Limpeza:** Aguardar aprovação do usuário para a execução da limpeza dos 45 arquivos da raiz (~34.5 MB).
2. **Escalação de Segurança:** Tratar os achados **SEC-01** (Cross-Tenant RCE), **SEC-02** (RLS Bypass em User Management), **SEC-03** (Email Webhook) e **SEC-04/05** (PGP Key & RLS Policies) em fluxo dedicado de engenharia de segurança via Claude Code / Antigravity.
3. **Padronização de Runtime:** Unificar a arquitetura de backend nas rotas Go Serverless, aposentando as Edge Functions duplicadas em Deno.

---
*Relatório consolidado e salvo em `varredura-geral-report.md` na raiz do projeto.*
