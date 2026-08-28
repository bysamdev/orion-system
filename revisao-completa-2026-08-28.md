# Revisão Completa do Código — Orion System (28/08/2026)

## Como este relatório foi produzido

Já existiam 30 relatórios de auditoria anteriores no repositório: `reports/` (8 subagentes, 11/08/2026) e `audit-reports/` (20 relatórios focados, 14/08/2026). Em vez de repetir essa pesquisa do zero, cada achado dos 30 relatórios foi conferido contra o estado atual do código (e, quando aplicável, contra o banco de produção ao vivo via MCP do Supabase e contra a resposta HTTP real de `https://orion.bysam.dev/`). Pesquisa nova foi feita apenas nos pontos que os relatórios antigos não cobriam com profundidade suficiente: N+1/re-renders/chamadas de API redundantes, e tratamento de erros nos fluxos de criação de ticket, monitoramento e notificações.

Boa parte dos achados antigos já foi corrigida — inclusive nesta mesma sessão (auditoria de segurança de 25/08, mais um commit de performance/resiliência). Este documento lista apenas o que **ainda é real hoje**, organizado pelos 5 focos pedidos, por severidade. Nenhuma correção foi aplicada — isto é só o relatório, para priorização.

---

## 1. Qualidade e Consistência do Código

### Importante
- `src/components/ticket/TimeTracker.tsx:72` — faz `supabase.from('time_entries').insert(...)` direto dentro de um componente de UI, diferente do resto do projeto (que delega a hooks em `src/hooks/`). Padrão inconsistente que deveria seguir a mesma convenção.
- Padrão duplicado de `toast({title:'Sucesso'|'Erro'})` + `queryClient.invalidateQueries` sem helper compartilhado, repetido em três telas administrativas: `src/components/admin/CompanyManagement.tsx:134-247`, `src/components/admin/UserManagement.tsx:199-448`, `src/components/admin/SLAConfiguration.tsx:73-91`.

### Menor
- Exports não usados (sem nenhuma referência em outro arquivo): `src/components/ui/badge.tsx:23` (`BadgeProps`), `src/components/ui/button-primary.tsx:5` (`ButtonPrimaryProps`), `src/components/ui/calendar.tsx:8` (`CalendarProps`), `src/components/ui/chart.tsx:9` (`ChartConfig`), `src/components/ui/textarea.tsx:5` (`TextareaProps`), `src/hooks/use-toast.ts:71` (`reducer`), `src/hooks/useAutomation.ts:15` (`AutomationLog`), `src/hooks/useCompanies.ts:4` (`CompanyOption`), `src/hooks/useDeviceInventory.ts:4,5,7,34,203` (`DeviceType`, `DeviceStatus`, `DeviceInventoryItem`, `FALLBACK_DEVICES`, `UseDeviceInventoryOptions`).
- Arquivos órfãos (nenhum import em lugar nenhum): `src/components/ui/accordion.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/hooks/useHistoricalStats.ts`.
- `audit-reports/01-dead-exports.md` e `audit-reports/17-typescript-coverage.md` declaram totais nos seus próprios sumários (53 e 96 achados) mas só listam 15 cada um no corpo — a cobertura real desses dois temas é maior do que o que já foi documentado.
- 15 usos de `any`/`as any` confirmados ainda presentes (linhas exatas mudaram de posição, mas o padrão continua): `src/App.tsx:44`, `src/components/admin/RoutingRulesManagement.tsx:122,372`, `src/components/monitoring/InventoryTab.tsx:10`, `src/components/monitoring/MachineDrawer.tsx:537,551`, `src/components/monitoring/MonitoringOnboarding.tsx:24,32,139`, `src/components/monitoring/PerformanceChart.tsx:33,38`, `src/components/monitoring/RemoteTerminal.tsx:195`, `src/components/patch/DeployDialog.tsx:52`, `src/components/patch/NewPackageDialog.tsx:53,74`, `src/components/ticket/TimeTracker.tsx:33`.

### Já corrigido (não precisa de ação)
`getStatusLabel`/`ButtonProps` agora usados; duplicação de cálculo de SLA entre `SLABadge.tsx` e `TechnicianDashboard.tsx` centralizada em `src/lib/ticket-helpers.ts`; CORS centralizado numa única `corsMiddleware` em `handler/router.go` (não mais espalhado por handler).

---

## 2. Segurança

### Crítico
- **`public.sync_company_domain_from_machine()` sem `SET search_path`** — `supabase/migrations/20260825150000_auto_sync_company_domain_from_machines.sql:2-18`. É a única função `SECURITY DEFINER` de todo o banco de produção sem essa proteção (confirmado agora pelo linter oficial do Supabase); foi introduzida no mesmo dia dos outros fixes de segurança desta sessão e ficou de fora.

### Importante
- **RLS `USING(true)` em `public.knowledge_articles` nunca foi corrigida** — `supabase/migrations/20260314070000_add_knowledge_base.sql:28-32`. A migration de remediação de 25/08 pulou esse fix por engano (confundiu com a tabela `knowledge_base_articles`, que é diferente e já está corretamente escopada). A tabela `knowledge_articles` **não existe hoje** no banco de produção, então não há exposição ativa neste momento — mas é referenciada em `src/pages/TicketDetails.tsx:234`, e se a migration for reaplicada em qualquer ambiente novo, a falha volta. Tratar como limpeza técnica prioritária.
- `Access-Control-Allow-Origin: *` na resposta HTML raiz de produção (comportamento padrão do Vercel para estáticos, não está em `vercel.json`). Sem cookies/credentials nessa origem específica, risco prático baixo, mas tecnicamente ainda presente.
- Token de acesso de máquina via `http://127.0.0.1:8081/token` + `localStorage.setItem('orion_machine_token', ...)` — `src/pages/Auth.tsx:236,301,329,375`. Decisão arquitetural do Orion Agent (comunicação local não criptografada), mitigada parcialmente pelo CSP atual, mas ainda vale revisar se há alternativa mais segura.

### Já corrigido (verificado, não precisa de ação)
Todos os itens de `audit-reports/06,07,09,10` e a maior parte de `08` e `reports/03,06,07`: segredo hardcoded, chave de serviço, bypass de teste, vulnerabilidades de dependência (`vite`, `esbuild`), `search_path` das demais funções, grants de RLS helpers, headers de segurança em produção, SQLi em `lib/monitoring.go`, RLS `USING(true)` em `machine_commands` (o mesmo achado citado como "RCE" no SUMMARY antigo — hoje validado por role **e** tenancy em `handler/mon_handlers.go:890-898` e na RLS), open redirect em `machineLogin`, `assigned_to`/`assigned_to_user_id` sincronizados por trigger (ver ressalva na seção 4), dois clientes Supabase Auth (só existe um hoje), `api_keys`/`remote_password` criptografados.

---

## 3. Performance

### Importante
- **N+1 de escrita, comandos remotos**: `handler/mon_handlers.go:1036-1038` — um `UPDATE` sequencial por comando pendente a cada ciclo de polling do agente, em vez de um `UPDATE ... WHERE id = ANY($1)`.
- **N+1 de escrita, UptimeRobot sync**: `handler/uptime_handlers.go:207-228` — uma goroutine fire-and-forget por endpoint que mudou de status, sem limite de concorrência, em vez de um `UPDATE` em lote.
- **N+1 de escrita, probe de rede**: `lib/network_links.go:422-435` — uma goroutine por link após o probing (que em si é corretamente limitado por semáforo), sem limite de concorrência na persistência.
- **Re-render em cascata no monitoramento**: `src/pages/Monitoring.tsx:652-655` — `handleSelectMachine` recriada a cada render (sem `useCallback`), quebra o `React.memo` de `MachineCard`; qualquer heartbeat re-renderiza todos os cards da frota, não só o que mudou.
- **Re-render, fila de chamados não atribuídos**: `src/components/dashboard/TechnicianDashboard.tsx:655-691` — lista renderizada inline sem memoização nem `useCallback` nos handlers, diferente das outras abas do mesmo componente (que usam `TicketRow` memoizado); qualquer re-render do pai (digitação na busca, poll de qualquer uma das 6 queries irmãs) recria a árvore inteira.
- **Componente monolítico sem memo**: `src/pages/TicketDetails.tsx` (1458 linhas, zero `React.memo`, um único `useMemo`) — o textarea de nova atualização (linha 868, estado `newUpdateText` linha 223) re-renderiza a página inteira a cada tecla digitada.
- **6 queries sobrepostas no dashboard técnico**: `src/hooks/useMyTickets.ts` + `src/components/dashboard/TechnicianDashboard.tsx:177-182` — `useMyActiveTickets`, `useAllActiveTickets`, `useSLAAtRiskTickets`, `useUnassignedTicketsEnhanced`, `useMyRecentClosedTickets`, `useActiveAgentsCount`, cada uma com `queryKey` própria e filtros fortemente sobrepostos na mesma tabela `tickets`, cada uma com seu próprio `refetchInterval` de 30-60s.
- **Polling duplicado com Realtime, tickets**: os mesmos hooks de `useMyTickets.ts` continuam com `refetchInterval` de 30-60s rodando ao mesmo tempo que `useRealtimeTickets.ts:14-27` já invalida as mesmas `queryKey`s a cada mudança via Supabase Realtime. O mesmo padrão **já foi corrigido** para monitoramento de máquinas (`src/hooks/useMonitoring.ts:198-205`, comentário explícito sobre isso) — só não foi replicado em tickets.
- **Polling duplicado com Realtime, mais agressivo**: `src/hooks/useWebMonitoring.ts:45-105` — assina Realtime em `monitored_endpoints` (invalida cache na linha 61) **e** mantém `refetchInterval: 15000` (linha 104) simultaneamente.

### Menor
- `recharts` ainda importado estaticamente no topo de `src/pages/Reports.tsx:54`, `src/components/ui/chart.tsx:2`, `TechnicianComparisonChart.tsx`, `PerformanceChart.tsx`, `WebTelemetryTab.tsx`, `WebMonitoring.tsx:22`; `lucide-react` continua dentro de `vendor-ui` no `vite.config.ts:45`, bloqueando tree-shaking.
- `src/components/ticket/UnifiedTimeline.tsx:178` — `buildTimeline(...)` chamado direto no corpo do render, sem `useMemo`.
- `src/pages/WebMonitoring.tsx:669-717` — lista de endpoints via `.map()` inline sem memoização; expandir o diagnóstico de um endpoint recalcula todos os cards.
- `src/hooks/useTicketAttachments.ts:63-87` — uma chamada de signed-URL por anexo (`Promise.all` paraleliza, mas ainda são N requisições HTTP; o SDK do Supabase Storage tem `createSignedUrls()` em lote, não usado).
- `lib/grafana_metrics.go:200-206` — 5 chamadas HTTP sequenciais ao Grafana (uma por métrica) em vez de paralelas; só pesa em cache-miss.
- `src/pages/TicketDetails.tsx:265-277` + `src/hooks/useTickets.ts:140-149` — busca redundante da mesma linha de `companies` (uma dentro de `useTicket`, outra separada só para `has_contract`).
- `handler/mon_handlers.go:1469-1513` — até 2 queries sequenciais por alerta recebido do Grafana webhook, sem batelar (só pesa em quedas em massa).

### Já corrigido (verificado, não precisa de ação)
Lazy loading de PDF/gráficos, `manualChunks` do Vite, paginação/limite em `useTickets.ts`, índices de performance no banco, rate limiting completo (memória + Postgres), timeouts e graceful shutdown, pool de conexão dinâmico, polling duplicado já resolvido para máquinas (referência de como fazer certo nos itens acima).

---

## 4. Tratamento de Erros e Edge Cases nos Fluxos Críticos

### Crítico
- **Trigger de notificação crasha e trava o chamado** — `supabase/migrations/20260811000000_notify_on_status_change.sql:37-41,86-87`. `create_notification_on_ticket_update()` faz `SELECT ... INTO` via `JOIN` com `profiles` sem checar linha encontrada. Como `tickets.user_id` é nullable, um chamado com `user_id NULL` faz o `JOIN` retornar zero linhas — o `INSERT` seguinte em `notifications` (que exige `user_id NOT NULL`) estoura violação de constraint, a exceção não é tratada, e **toda a transação do trigger é revertida**. Resultado: qualquer comentário ou mudança de status feito por um técnico nesse chamado específico trava com erro bruto do Postgres, chamado fica impossível de atualizar até alguém corrigir o dado.

### Importante
- **Criação de ticket, duplo submit**: `src/pages/NewTicket.tsx:257,446-455` — o `onKeyDown` do form dispara `onSubmit` no Enter sem checar o estado `disabled` do botão; segurar Enter antes do primeiro re-render gera dois `INSERT`s para a mesma intenção.
- **Criação de ticket, upload de anexo falha em silêncio**: `src/pages/NewTicket.tsx:293-308` (linha 298: `if (uploadError) continue;`) — falha de upload não gera toast nem log; o chamado é criado normalmente e o usuário acredita que a evidência foi anexada.
- **Criação de ticket, rate limit fail-open**: `src/pages/NewTicket.tsx:262-267` + `src/lib/orion-functions.ts:81-86` — falha de rede na checagem de rate limit é tratada como "permitido" em vez de bloquear.
- **Monitoramento, falso "offline"**: `lib/network_links.go:277-289` — alvos `http://`/`https://` fazem uma única tentativa e retornam "offline" em qualquer erro, sem os 3 fallbacks (ping/TCP em portas 80/443/53) que alvos IP/hostname puro têm.
- **Monitoramento, condição de corrida entre ciclos de probe**: worker in-process (`handler/router.go:90-105`, a cada 300s) e cron do Vercel (`handler/network_links_handlers.go:160-182`) chamam `ProbeAllNetworkLinks` de forma independente; `lib/network_links.go:249-265` não verifica `last_checked_at` antes de sobrescrever — um resultado mais antigo pode sobrescrever um mais recente se os ciclos se sobrepuserem.
- **Monitoramento, falso positivo permanente em endpoint web**: `src/hooks/useWebMonitoring.ts:111-141` (linha 134) — se a chamada à API Go falhar por qualquer motivo, o fallback insere direto no Supabase com `status: 'online'` hardcoded e sem `uptimerobot_monitor_id`; o endpoint nasce marcado como monitorado com sucesso mas nunca mais é verificado de verdade.
- **Notificações, marcar como lida falha em silêncio**: `src/hooks/useNotifications.ts:40-52,55-70` — nem `markAsReadMutation` nem `markAllAsReadMutation` têm `onError`; se o `UPDATE` falhar, o usuário acha que marcou como lida mas o estado real não muda, sem nenhum sinal de erro.
- **Desincronização `assigned_to` × `assigned_to_user_id` ao escalar**: `src/hooks/useTickets.ts:764-775` (`useEscalateTicket`) + `src/pages/TicketDetails.tsx:557-564`. Ao escalar um chamado para "Fila Geral (Nenhum)", a busca por técnico via `full_name` retorna `undefined`, e como o código só inclui `assigned_to_user_id` no `UPDATE` quando o valor não é `undefined`, o campo não é atualizado: `assigned_to` vira `NULL` mas `assigned_to_user_id` mantém o UUID antigo — UI mostra "não atribuído" enquanto RLS/filtros por UUID ainda tratam o chamado como do técnico anterior. (Existe um segundo ponto idêntico em `handleAssignmentChange`/`useUpdateTicketAssignment`, mas está morto — nenhum componente o invoca hoje.)
- **Botão "Assumir" engole falha sem avisar nem reverter**: `src/hooks/useTickets.ts:518` (`useAssumeTicket`) — se o `UPDATE` do ticket tiver sucesso mas o `INSERT` em `ticket_updates` falhar, o código só faz `console.warn`; usuário recebe toast de sucesso, o ticket muda de dono normalmente, mas nenhuma notificação é disparada (o trigger de notificação depende desse `INSERT`) e não sobra registro na timeline/auditoria.

### Menor
- `src/pages/NewTicket.tsx:274` — `full_name` vazio (string, não NULL) passa na validação e cria chamado com `requester_name` em branco.
- `src/components/ticket/FileUpload.tsx:51,72,83` — o limite de 5 arquivos não soma com imagens já coladas via Ctrl+V (limite independente em `NewTicket.tsx:197-206`); dá pra passar do limite anunciado.
- `src/hooks/useNotifications.ts:20-37` — badge de não-lidas calculado só sobre as 100 notificações mais recentes; usuário com mais de 100 acumuladas pode ver contagem subestimada.

### Já corrigido / mudou (verificado)
Bugs do motor de roteamento automático (trigger desvinculado, `UPDATE` inválido, round-robin quebrado) corrigidos; expiração de URL de anexo corrigida (signed URL gerada por leitura); cobertura de testes real (7 arquivos frontend + dezenas no Go/agent, não é 0% como um relatório antigo alegava); RCE de comandos remotos corrigido (validação de role + tenancy); race condition em mutações de ticket parcialmente corrigida (há controle de concorrência otimista e reversão automática na maioria dos fluxos, exceto `useAssumeTicket` acima); Error Boundary deixou de ser único (agora há um por rota protegida + locais em telas específicas), mas o guard de parsing de data seguro (`isNaN` antes de `formatDistanceToNow`) só existe em `TicketDetails.tsx:629` — não é um utilitário compartilhado, outros ~21 arquivos que usam `date-fns` podem não ter o mesmo guard.

---

## 5. Débito Técnico

### Importante
- **Componentes gigantes concentrando fetch + mutation + lógica de negócio + UI**: `src/pages/WebMonitoring.tsx` (1496 linhas), `src/pages/TicketDetails.tsx` (1458), `src/pages/Monitoring.tsx` (1278), `src/components/monitoring/MachineDrawer.tsx` (1225), `src/pages/Reports.tsx` (1194), `src/pages/Assets.tsx` (1125), `src/components/admin/UserManagement.tsx` (1015). Candidatos claros a quebra em subcomponentes/hooks — cresceram desde o relatório de 11/08 (`TicketDetails` tinha 1244 linhas, `Reports` tinha 793).
- **`handler/mon_handlers.go` com 1545 linhas** — maior arquivo do backend Go por larga margem (2,5x o segundo maior). Concentra provavelmente vários domínios de monitoramento (heartbeat, hardware, alertas, comandos) num único handler.

### Menor
- `public/sitemap.xml` não existe; qualquer requisição cai no HTML da SPA com status 200 (o `vercel.json` não tem exceção pro catch-all).
- `src/components/admin/ResolutionChecklistManagement.tsx:174` — botão de remover item do checklist sem `aria-label`.
- `src/pages/WebMonitoring.tsx` (~linhas 787, 1366) — botões de excluir endpoint/link com `title` mas sem `aria-label` (não é substituto confiável em todos os leitores de tela).

*(Nota: acessibilidade não estava entre os 5 focos pedidos pelo usuário, mas os 2 itens acima sobraram do relatório 19 antigo (que teve 11 de 13 achados já corrigidos) e ficaram registrados aqui por completude.)*

---

## Resumo executivo

| Foco | Crítico | Importante | Menor |
|---|---|---|---|
| 1. Qualidade/consistência | 0 | 2 | ~20 |
| 2. Segurança | 1 | 3 | 0 |
| 3. Performance | 0 | 9 | 7 |
| 4. Erros/edge cases | 1 | 9 | 3 |
| 5. Débito técnico | 0 | 2 | 3 |
| **Total** | **2** | **25** | **~33** |

Os dois **críticos** são baratos de corrigir isoladamente (um `SET search_path` de uma linha; um `IF NOT FOUND` no trigger de notificação) e valem prioridade imediata — o segundo em especial trava um fluxo real de atendimento (comentar/atualizar um chamado) sem aviso claro pro usuário.

Entre os **importantes**, o padrão mais recorrente é "cobre o caminho feliz, mas falha em silêncio quando algo dá errado" — upload de anexo, rate limit, criação de endpoint web, marcar notificação como lida: todos esses têm um `catch`/fallback que engole o erro em vez de avisar ou reverter. Vale tratar como um grupo (mesma causa raiz: falta de padrão consistente de `onError` + reversão), não item por item.
