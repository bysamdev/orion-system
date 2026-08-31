# Inventário Completo de Renderização de Estados e Design Tokens
**Orion System — Auditoria de Design System e Cores de Estado**
**Data:** 31/08/2026 | **Fase:** 1 (Diagnóstico & Inventário — Estritamente Read-Only)
**Subagente:** Subagente B — Inventário de Renderização de Estados

---

## 1. Sumário Executivo

A auditoria de renderização de estados no código-fonte (`src/`) do Orion System identificou uma **fragmentação severa** na forma como estados operacionais, prioridades, SLAs, telemetria de RMM e entidades do CMDB são representados visualmente.

Embora o design system do projeto (`src/index.css` e `tailwind.config.ts`) defina uma arquitetura semântica de tokens em camadas (`--primary`, `--success`, `--warning`, `--destructive`, `--info`, `--muted`, `--accent`), a maior parte dos componentes e páginas da aplicação **ignora os tokens semânticos** ou **reimplementa mapas de cores arbitrários localmente** usando classes utilitárias do Tailwind com cores literais (`emerald-500`, `amber-500`, `rose-500`, `sky-500`, `indigo-500`, `purple-500`, `blue-500`, `red-500`) ou valores hexadecimais brutos injetados diretamente em bibliotecas como Recharts e SVG.

### Principais Diagnósticos:
1. **Componente Canônico de Status Órfão:** O componente `src/components/ui/status-badge.tsx` (baseado em CVA com variantes semânticas `online`, `offline`, `warning`, `info`, `muted`, `success`, `destructive`) possui **zero imports** em toda a aplicação.
2. **Divergência Crítica de Semântica entre Tabela e Gráficos:**
   - No `StatusBadge.tsx` (componente compartilhado), o status `open` é azul (`bg-blue-500`), `in-progress` é amarelo (`bg-yellow-500`), e `reopened` é laranja (`bg-orange-500`).
   - No gráfico `WorkloadChart.tsx` (alimentado por `useTechnicianStats.ts`), o status `open` recebe `hsl(var(--warning))` (amarelo), `in-progress` recebe `hsl(var(--primary))` (roxo), e `reopened` recebe `hsl(var(--destructive))` (vermelho).
   - No `Reports.tsx`, o status `open` recebe `#3b82f6` (azul), `in-progress` recebe `#906090` (roxo da marca), e `reopened` recebe `#ec4899` (rosa).
3. **Multiplicidade de Mapas Locais:** Foram identificadas **31 ocorrências de reimplementação local** de mapas de cores/switches em arquivos de visualização contra apenas **19 consumos de componentes canônicos** (taxa de 62% de reimplementação ad-hoc).

---

## 2. Mapeamento por Dimensão de Estado

---

### 2.1. Status de Tickets

#### Componentes Canônicos Disponíveis:
- **`src/components/shared/StatusBadge.tsx`**: Utiliza `Badge` com `statusConfig` mapeando `open`, `in-progress`, `awaiting-customer`, `awaiting-third-party`, `resolved`, `closed`, `reopened`, `cancelled`. *Problema:* Usa classes Tailwind literais (`bg-blue-500`, `bg-yellow-500`, `bg-purple-500`, etc.) em vez de tokens semânticos.
- **`src/components/ui/status-badge.tsx`**: Componente CVA semântico. *Problema:* Órfão (0 utilizações).

#### Inventário de Ocorrências:

| Arquivo e Linha | Dimensão | Valor Renderizado | Elemento / Cor Aplicada | Tipo de Implementação |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/shared/StatusBadge.tsx:10-51` | Status Ticket | `open` | Dot: `bg-blue-500` \| Badge: `bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400` | Canônico compartilhado (mas com Tailwind literal) |
| `src/components/shared/StatusBadge.tsx:16-20` | Status Ticket | `in-progress` | Dot: `bg-yellow-500` \| Badge: `bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400` | Canônico compartilhado (Tailwind literal) |
| `src/components/shared/StatusBadge.tsx:21-25` | Status Ticket | `awaiting-customer` | Dot: `bg-purple-500` \| Badge: `bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400` | Canônico compartilhado (Tailwind literal) |
| `src/components/shared/StatusBadge.tsx:26-30` | Status Ticket | `awaiting-third-party` | Dot: `bg-indigo-500` \| Badge: `bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-400` | Canônico compartilhado (Tailwind literal) |
| `src/components/shared/StatusBadge.tsx:31-35` | Status Ticket | `resolved` | Dot: `bg-green-500` \| Badge: `bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400` | Canônico compartilhado (Tailwind literal) |
| `src/components/shared/StatusBadge.tsx:36-40` | Status Ticket | `closed` | Dot: `bg-muted-foreground` \| Badge: `bg-muted text-muted-foreground border-border` | Canônico compartilhado (Token semântico) |
| `src/components/shared/StatusBadge.tsx:41-45` | Status Ticket | `reopened` | Dot: `bg-orange-500` \| Badge: `bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400` | Canônico compartilhado (Tailwind literal) |
| `src/components/shared/StatusBadge.tsx:46-50` | Status Ticket | `cancelled` | Dot: `bg-destructive` \| Badge: `bg-destructive/10 text-destructive border-destructive/20` | Canônico compartilhado (Token semântico) |
| `src/components/dashboard/TechnicianDashboard.tsx:145` | Status Ticket | `ticket.status` | `<StatusBadge status={ticket.status} />` | Consumo Canônico |
| `src/components/dashboard/TopBar.tsx:127` | Status Ticket | `ticket.status` | `<StatusBadge status={ticket.status} className="text-[9px] py-0 h-4" />` | Consumo Canônico |
| `src/components/monitoring/MachineTicketsTab.tsx:67` | Status Ticket | `t.status` | `<StatusBadge status={t.status} />` | Consumo Canônico |
| `src/components/ticket/TicketHeroHeader.tsx:179` | Status Ticket | `ticket.status` | `<StatusBadge status={ticket.status} />` | Consumo Canônico |
| `src/components/ticket/TicketHeroHeader.tsx:155` | Ação de Status | `resolved` | Botão: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/TicketHeroHeader.tsx:168` | Ação de Status | `closed` | Botão: `border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/TicketHeroHeader.tsx:253` | Ação de Status | `in-progress` | Botão: `border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/TicketHeroHeader.tsx:264` | Ação de Status | `awaiting-customer` | Botão: `bg-purple-500/10 text-purple-600 border-purple-200` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/UnifiedTimeline.tsx:37-41` | Status Ticket | Todos | `statusLabels` Record local com labels duplicadas | Reimplementação Local (Dicionário) |
| `src/components/ticket/UnifiedTimeline.tsx:103-124` | Evento Timeline | `status_change`, `status_history` | Ícone: `text-yellow-500` \| Container: `bg-yellow-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/UnifiedTimeline.tsx:107` | Evento Timeline | `assignment` | Ícone: `text-purple-500` \| Container: `bg-purple-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/UnifiedTimeline.tsx:113` | Evento Timeline | `comment` | Ícone: `text-green-500` \| Container: `bg-green-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/UnifiedTimeline.tsx:137` | Nota Interna | `isInternal` | Badge: `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/TicketSummaryDialog.tsx:33` | IA Badge | `Copilot` | Badge: `bg-purple-500/10 text-purple-600 border-purple-200` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/TicketSummaryDialog.tsx:48-71` | Seções IA | Problema / Diagnóstico / Ação | Dots/Ícones: `bg-red-500`/`text-red-500`, `bg-amber-500`/`text-amber-500`, `bg-green-500`/`text-green-500` | Reimplementação Local (Tailwind literal) |
| `src/components/ticket/ResolutionDialog.tsx:77` | Resolução | Modal | Ícone: `text-emerald-500` | Reimplementação Local (Tailwind literal) |
| `src/pages/ClientPortal.tsx:191-199` | Card Chamado | `awaiting-customer` | Borda/Fundo: `border-primary/50 bg-primary/5 hover:border-primary` | Reimplementação Local (Tokens) |
| `src/pages/ClientPortal.tsx:194-196` | Card Chamado | `resolved` | Borda/Fundo: `border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500` \| Ícone: `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` | Reimplementação Local (Tailwind literal) |
| `src/pages/ClientPortal.tsx:197-198` | Card Chamado | `in-progress` | Borda/Fundo: `border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60` \| Ícone: `bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20` | Reimplementação Local (Tailwind literal) |
| `src/pages/ClientPortal.tsx:225` | Status Ticket | `ticket.status` | `<StatusBadge status={ticket.status as any} />` | Consumo Canônico |
| `src/pages/TicketHistory.tsx:187, 299` | Status Ticket | `ticket.status` | `<StatusBadge status={t.status} />` | Consumo Canônico |
| `src/pages/Reports.tsx:1155` | Status Ticket | `ticket.status` | `<StatusBadge status={ticket.status} />` | Consumo Canônico |
| `src/pages/Assets.tsx:1081-1092` | Status Ticket | `resolved`/`closed`, `in_progress`, outro | Badge: `variant="success"`, `variant="warning"`, `variant="info"` (usando `getStatusLabel`) | Reimplementação Local (Switch com Shadcn Badge) |
| `src/hooks/useTechnicianStats.ts:136-141` | Status Ticket (Carga) | `open`, `in-progress`, `reopened`, `awaiting-customer`, `awaiting-third-party` | Injeção de cores no Recharts: `'hsl(var(--warning))'`, `'hsl(var(--primary))'`, `'hsl(var(--destructive))'`, `'#906090'`, `'#604878'` | Reimplementação Local (Injeção de Cores em Hook) |

---

### 2.2. Prioridade de Tickets

#### Componentes Canônicos Disponíveis:
- **`src/components/shared/PriorityBadge.tsx`**: Mapeia `urgent`, `high`, `medium`, `low`.

#### Inventário de Ocorrências:

| Arquivo e Linha | Dimensão | Valor Renderizado | Elemento / Cor Aplicada | Tipo de Implementação |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/shared/PriorityBadge.tsx:12-15` | Prioridade | `urgent` | Badge: `bg-destructive/10 text-destructive border-destructive/30` | Canônico (Token semântico) |
| `src/components/shared/PriorityBadge.tsx:16-19` | Prioridade | `high` | Badge: `bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30` | Canônico (Tailwind literal) |
| `src/components/shared/PriorityBadge.tsx:20-23` | Prioridade | `medium` | Badge: `bg-warning/10 text-warning border-warning/30` | Canônico (Token semântico) |
| `src/components/shared/PriorityBadge.tsx:24-27` | Prioridade | `low` | Badge: `bg-muted text-muted-foreground border-border` | Canônico (Token semântico) |
| `src/components/dashboard/TechnicianDashboard.tsx:142, 187` | Prioridade | `ticket.priority` | `<PriorityBadge priority={ticket.priority} size="sm" />` | Consumo Canônico |
| `src/components/monitoring/MachineTicketsTab.tsx:66` | Prioridade | `t.priority` | `<PriorityBadge priority={t.priority} />` | Consumo Canônico |
| `src/components/ticket/TicketHeroHeader.tsx:180` | Prioridade | `ticket.priority` | `<PriorityBadge priority={ticket.priority} />` | Consumo Canônico |
| `src/pages/ClientPortal.tsx:226` | Prioridade | `ticket.priority` | `<PriorityBadge priority={ticket.priority as any} />` | Consumo Canônico |
| `src/pages/TicketHistory.tsx:188, 296` | Prioridade | `ticket.priority` | `<PriorityBadge priority={t.priority} size="sm" />` | Consumo Canônico |
| `src/pages/Reports.tsx:1154` | Prioridade | `ticket.priority` | `<PriorityBadge priority={ticket.priority} size="sm" />` | Consumo Canônico |
| `src/pages/DebugTools.tsx:519` | Prioridade | `result.priority` | `<PriorityBadge priority={result.priority} />` | Consumo Canônico |
| `src/pages/NewTicket.tsx:894` | Prioridade | `priority` | `<PriorityBadge priority={form.getValues('priority')} size="sm" />` | Consumo Canônico |
| `src/pages/NewTicket.tsx:726-750` | Seleção Prioridade | `urgent`, `high`, `medium`, `low` | SelectItem com dots: `bg-red-500`, `bg-orange-500`, `bg-amber-500`, `bg-emerald-500` | Reimplementação Local (Tailwind literal) |
| `src/components/admin/SLAConfiguration.tsx:245-248` | Políticas de SLA | `urgent`, `high`, `medium`, `low` | Badges: `border-rose-500/30 text-rose-700 bg-rose-500/10`, `border-orange-500/30 text-orange-700 bg-orange-500/10`, `border-blue-500/30 text-blue-700 bg-blue-500/10`, `border-slate-500/30 text-slate-700 bg-slate-500/10` | Reimplementação Local (Divergência de Cores) |
| `src/pages/Assets.tsx:1094-1104` | Histórico Ativo | `critica`/`urgent`/`alta` vs outros | Badge: `variant="destructive"` vs `variant="secondary"` | Reimplementação Local (Switch com Shadcn Badge) |

---

### 2.3. SLA de Tickets

#### Componentes Canônicos Disponíveis:
- **`src/components/dashboard/SLABadge.tsx`**: Mapeia `ok`, `warning`, `attention`, `breached` utilizando tokens semânticos (`bg-success/15`, `bg-warning/15`, `bg-warning/20`, `bg-destructive/15`). Integração com `calculateSlaStatus` de `ticket-helpers.ts`.

#### Inventário de Ocorrências:

| Arquivo e Linha | Dimensão | Valor Renderizado | Elemento / Cor Aplicada | Tipo de Implementação |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/dashboard/SLABadge.tsx:51-80` | SLA Status | `ok`, `warning`, `attention`, `breached` | Badges com tokens semânticos: `bg-success/15 text-success`, `bg-warning/15 text-warning`, `bg-warning/20 text-warning`, `bg-destructive/15 text-destructive` | Canônico (Tokens semânticos) |
| `src/components/dashboard/TechnicianDashboard.tsx:148` | SLA Status | `ticket.sla_status` | `<SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} variant="compact" />` | Consumo Canônico |
| `src/components/dashboard/TechnicianDashboard.tsx:509-513` | Carga Equipe | `sla_at_risk_tickets` | `Badge variant="destructive"` se > 0, senão `text-muted-foreground` | Reimplementação Local (Shadcn Badge) |
| `src/components/ticket/TicketHeroHeader.tsx:181` | SLA Status | `ticket.sla_status` | `<SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} />` | Consumo Canônico |
| `src/pages/TicketDetails.tsx:1037` | SLA Status | `ticket.sla_status` | `<SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} />` | Consumo Canônico |
| `src/pages/Reports.tsx:701-703` | SLA Tendência | `ok`, `attention`, `breached` | Recharts Area: `stroke="#22c55e" fill="#22c55e"`, `stroke="#eab308" fill="#eab308"`, `stroke="#ef4444" fill="#ef4444"` | Recharts Hex Literal |
| `src/components/reports/TechnicianComparisonChart.tsx:65` | SLA Técnico | `slaPct` | Recharts Bar: `fill="hsl(var(--success))"` | Recharts Token Semântico |
| `src/components/reports/GaugeChart.tsx:43` | Meta de SLA | `value >= target` | SVG Path: `atingiu ? 'hsl(var(--success))' : 'hsl(var(--destructive))'` | SVG Token Semântico |
| `src/components/reports/BulletChart.tsx:34, 85` | Faixas de SLA | Meta vs Realizado | SVG Rects: `corBarra = dentroDaMeta ? 'hsl(var(--success))' : 'hsl(var(--destructive))'`, Faixas: `hsl(var(--warning))`, `hsl(var(--success))` | SVG Token Semântico |

---

### 2.4. Status de Máquinas / RMM

#### Componentes Canônicos Disponíveis:
- **Nenhum**. `src/components/ui/status-badge.tsx` possui variantes prontas (`online`, `offline`, `warning`), mas não é importado em nenhuma tela de RMM.

#### Inventário de Ocorrências:

| Arquivo e Linha | Dimensão | Valor Renderizado | Elemento / Cor Aplicada | Tipo de Implementação |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/monitoring/MachineCard.tsx:357-391` | Status RMM | `online`, `alerta`, `offline` | Pill: `bg-success/15 text-success border-success/30` \| `bg-warning/15 text-warning border-warning/30` \| `bg-muted/40 text-muted-foreground border-border/40` | Reimplementação Local (Tokens) |
| `src/components/monitoring/MachineCard.tsx:315-318` | Borda Card | `alerting`, `isOnline`, `offline` | `border-amber-500/40 shadow-amber-500/5` \| `border-border/60 hover:border-emerald-500/40` \| `border-border/40 opacity-80` | Reimplementação Local (Tailwind literal) |
| `src/components/monitoring/MachineCard.tsx:395-424` | Micro-Alertas | `hasNoAntivirus`, `hasLowStorage`, `hasHighUptime` | Badges: `text-destructive bg-destructive/15 border-destructive/30` \| `text-warning bg-warning/15 border-warning/30` | Reimplementação Local (Tokens) |
| `src/components/monitoring/MachineCard.tsx:263-275` | Métricas RMM | CPU, RAM, Disco (>85, >=70, normal) | Progress/Text: `text-destructive bg-destructive` \| `text-warning bg-warning` \| `text-success bg-success` | Reimplementação Local (Tokens) |
| `src/components/monitoring/MachineCard.tsx:153-214` | Sistema Operacional | `win11`, `win10`, `winserver`, `linux`, `mac` | Ícones: `text-sky-500`, `text-sky-400`, `text-indigo-400`, `text-amber-500`, `text-neutral-400` | Reimplementação Local (Tailwind literal) |
| `src/pages/Monitoring.tsx:118-120` | Grupo Sidebar | Contagem Online | Dot: `bg-emerald-500` \| Texto: `text-emerald-600 dark:text-emerald-400` | Reimplementação Local (Tailwind literal) |
| `src/pages/Monitoring.tsx:199` | Seção Grupo | Header Online | Dot: `bg-emerald-500` | Reimplementação Local (Tailwind literal) |
| `src/pages/Monitoring.tsx:270-276` | Tabela RMM | `alerting`, `isOnline`, `offline` | Dot: `alerting ? "bg-amber-500 animate-pulse" : isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"` | Reimplementação Local (Tailwind literal) |
| `src/pages/Monitoring.tsx:1015-1035` | Filtros Status | `online`, `alert`, `offline` | Botões filtro: `text-emerald-500` / `text-emerald-600`, `text-amber-500`, `text-muted-foreground` | Reimplementação Local (Tailwind literal) |
| `src/components/monitoring/MachineDrawer.tsx:500-504` | LED de Status | `isAlertState`, `isOnline`, `offline` | LED: `bg-amber-400 shadow-amber-400/60` \| `bg-green-400 shadow-green-400/60` \| `bg-red-400 shadow-red-400/60` | Reimplementação Local (Tailwind literal) |
| `src/components/monitoring/MachineDrawer.tsx:82-87` | Severidade Alerta | `critical`, `high`, `medium`, `low` | `bg-destructive/15 text-destructive border-destructive/30` \| `bg-warning/20 text-warning border-warning/40` \| `bg-warning/15 text-warning border-warning/30` \| `bg-info/15 text-info border-info/30` | Reimplementação Local (Tokens) |
| `src/components/monitoring/MachineDrawer.tsx:122-152` | Conformidade | `isCompliant` | `bg-success/15 text-success border-success/30` vs `bg-warning/15 text-warning border-warning/30` | Reimplementação Local (Tokens) |
| `src/components/monitoring/MachineDrawer.tsx:221-270` | Firewall / BitLocker | Ativo vs Inativo | Ativo: `text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5` \| Inativo: `text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10` | Reimplementação Local (Tailwind literal) |
| `src/components/monitoring/MachineDrawer.tsx:297` | Acesso Remoto | Software Ativo | Ícone: `bg-blue-500/10 text-blue-600 dark:text-blue-400` | Reimplementação Local (Tailwind literal) |
| `src/components/monitoring/PlatformHealthTab.tsx:25-30` | Saúde da Frota | `warning`, `critical`, `good`, `default` | Tiles: `text-amber-500 border-amber-500/20 bg-amber-500/5` \| `text-red-500 border-red-500/20 bg-red-500/5` \| `text-green-500 border-green-500/20 bg-green-500/5` | Reimplementação Local (Tailwind literal) |
| `src/components/monitoring/PendingMachinesBanner.tsx:58-64` | Aprovação | Fila Pendente | Card/Badge: `border-amber-500/30 bg-amber-500/[0.03] text-amber-600 bg-amber-500/10` | Reimplementação Local (Tailwind literal) |
| `src/pages/AlertsDashboard.tsx:66-116` | Central Alertas | `antivirus`, `firewall`, `updates`, `offline`, `disk`, `cpu`, `alert` | `colorMap` local: `bg-destructive/10 border-destructive/30 text-destructive` vs `bg-warning/10 border-warning/30 text-warning` | Reimplementação Local (Tokens) |
| `src/components/monitoring/PerformanceChart.tsx:238-279` | Histórico RMM | CPU, RAM, Disco | Recharts Linhas/Áreas: `#906090` (CPU), `#7c529e` (RAM), `#f59e0b` (Disco) | Recharts Hex Literal |
| `src/components/patch/DeployDialog.tsx:109-111` | Seleção Deploy | `online`, `offline` | Dots: `bg-green-500` vs `bg-red-500 text-red-400` | Reimplementação Local (Tailwind literal) |
| `src/pages/PatchManagement.tsx:22-27` | Deploy Patches | `pending`, `dispatched`, `completed`, `failed` | Badges: `bg-amber-500/10 text-amber-600 border-amber-500/30` \| `bg-blue-500/10 text-blue-600 border-blue-500/30` \| `bg-green-500/10 text-green-600 border-green-500/30` \| `bg-red-500/10 text-red-600 border-red-500/30` | Reimplementação Local (Tailwind literal) |
| `src/components/patch/PackageCard.tsx:12-14` | Tipo Pacote | `powershell`, `batch`, `installer` | `text-blue-500`, `text-green-500`, `text-purple-500` | Reimplementação Local (Tailwind literal) |

---

### 2.5. Status de Ativos / CMDB

#### Componentes Canônicos Disponíveis:
- **Nenhum**.

#### Inventário de Ocorrências:

| Arquivo e Linha | Dimensão | Valor Renderizado | Elemento / Cor Aplicada | Tipo de Implementação |
| :--- | :--- | :--- | :--- | :--- |
| `src/pages/Assets.tsx:700-705` | Status Ativo | `online`, `offline`, `alerta` | Dot: `bg-emerald-500 shadow-sm shadow-emerald-500/50` \| `bg-rose-500` \| `bg-amber-500 animate-pulse` | Reimplementação Local (Tailwind literal) |
| `src/pages/Assets.tsx:712-716` | Tipo Ativo | `Servidor`, `Notebook`, `Computador` | Badges: `bg-indigo-500/10 text-indigo-600 border-indigo-500/30` \| `bg-sky-500/10 text-sky-600 border-sky-500/30` \| `bg-emerald-500/10 text-emerald-600 border-emerald-500/30` | Reimplementação Local (Tailwind literal) |
| `src/pages/Assets.tsx:720-722` | Texto Status | `online`, `offline`, `alerta` | Texto: `text-emerald-600 dark:text-emerald-400` \| `text-rose-600 dark:text-rose-400` \| `text-amber-600 dark:text-amber-400` | Reimplementação Local (Tailwind literal) |
| `src/components/assets/AssetTopologyGraph.tsx:131-135` | Grupo Cliente | `online`, `fora do ar` | Dots: `bg-emerald-500` \| `bg-rose-500` | Reimplementação Local (Tailwind literal) |
| `src/components/assets/AssetTopologyGraph.tsx:285` | Nó Topologia | `online`, `alerta`, `offline` | Dot no nó: `online ? 'bg-emerald-500' : alerta ? 'bg-amber-500' : 'bg-rose-500'` | Reimplementação Local (Tailwind literal) |
| `src/components/assets/AssetTopologyGraph.tsx:302-306` | Nó Topologia | `online`, `alerta`, `offline` | Rótulo: `text-emerald-700 dark:text-emerald-400` \| `text-amber-700 dark:text-amber-400` \| `text-rose-700 dark:text-rose-400` | Reimplementação Local (Tailwind literal) |

---

### 2.6. Status de Contratos, Usuários e Serviços Web

#### Componentes Canônicos Disponíveis:
- **Nenhum**.

#### Inventário de Ocorrências:

| Arquivo e Linha | Dimensão | Valor Renderizado | Elemento / Cor Aplicada | Tipo de Implementação |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/admin/ContractManagement.tsx:182-184` | Limite Tickets | `>= 100%`, `>= 80%`, `< 80%` | Barra/Sombra: `bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]` \| `bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]` \| `bg-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]` | Reimplementação Local (Shadow Hex/RGBA) |
| `src/components/admin/ContractManagement.tsx:194-196` | Contrato Ativo | `is_active` | `Badge variant={contract.is_active ? 'default' : 'secondary'}` | Reimplementação Local (Shadcn Badge) |
| `src/components/admin/CompanyManagement.tsx:325-330` | Tipo Contrato | `has_contract` vs `esporadico` | Pills: `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20` vs `bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/admin/PlanUsageCard.tsx:30-33, 125` | Uso de Licenças | `isLimitReached`, `isNearLimit` | Barra/Texto: `bg-destructive text-destructive` \| `bg-warning text-warning` \| `bg-primary` | Reimplementação Local (Tokens) |
| `src/components/settings/TwoFactorAuthSettings.tsx:323-336` | Status 2FA | `isMfaEnabled` | Badge: `bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30` vs `bg-muted text-muted-foreground` | Reimplementação Local (Tailwind literal) |
| `src/pages/WebMonitoring.tsx:750-760` | Endpoint Web | `isOnline` | Badge: `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30` \| Dot: `bg-emerald-500` vs `variant="destructive"` \| Dot: `bg-red-500` | Reimplementação Local (Tailwind literal) |
| `src/pages/WebMonitoring.tsx:1421-1430` | Link Internet | `isOnline` | Badge: `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30` \| Dot: `bg-emerald-500` vs `variant="destructive"` \| Dot: `bg-red-500` | Reimplementação Local (Tailwind literal) |
| `src/pages/Avaliacao.tsx:84-95` | Avaliação CSAT | Concluída | Card: `border-emerald-500/20 bg-emerald-500/5` \| Ícone/Estrelas: `text-emerald-500 fill-emerald-500` | Reimplementação Local (Tailwind literal) |
| `src/components/dashboard/TechnicianDashboard.tsx:52-63` | KPI StatCards | `default`, `warning`, `success`, `danger` | Cores/Glows: `text-amber-500 bg-amber-500/10 border-amber-500/20` \| `text-emerald-500 bg-emerald-500/10 border-emerald-500/20` \| `text-rose-500 bg-rose-500/10 border-rose-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/dashboard/TechnicianDashboard.tsx:516` | Resolvidos Hoje | Contador equipe | Texto: `text-emerald-500 font-bold` | Reimplementação Local (Tailwind literal) |
| `src/components/automation/RulesTab.tsx:35` | Tipo Ação | Ação Automática | Badge: `bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/automation/RulesTab.tsx:196` | Condição Regra | Campo Condição | Badge: `bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20` | Reimplementação Local (Tailwind literal) |
| `src/components/automation/HistoryTab.tsx:78` | Log Automação | Ação Executada | Badge: `bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20` | Reimplementação Local (Tailwind literal) |

---

## 3. Detalhamento de Cores em Gráficos (Recharts & SVG)

Esta seção documenta com precisão cirúrgica todas as cores injetadas em elementos gráficos no Orion System.

### 3.1. `src/components/dashboard/WorkloadChart.tsx` (via `useTechnicianStats.ts`)
O gráfico de rosca (Donut PieChart) que exibe a carga de trabalho do técnico autenticado consome cores injetadas no hook `useTechnicianWorkload`:

```typescript
// src/hooks/useTechnicianStats.ts (L136-141)
return [
  { name: 'Abertos', value: statusCount['open'], color: 'hsl(var(--warning))' },
  { name: 'Em Atendimento', value: statusCount['in-progress'], color: 'hsl(var(--primary))' },
  { name: 'Reabertos', value: statusCount['reopened'], color: 'hsl(var(--destructive))' },
  { name: 'Aguard. Cliente', value: statusCount['awaiting-customer'], color: '#906090' },
  { name: 'Aguard. Terceiro', value: statusCount['awaiting-third-party'], color: '#604878' },
].filter(item => item.value > 0);
```

| Fatia / Status | Cor Injetada | Equivalente Visual | Conflito / Divergência com StatusBadge |
| :--- | :--- | :--- | :--- |
| **Abertos** (`open`) | `hsl(var(--warning))` | Amarelo/Âmbar | ⚠️ **Divergência Grave**: `StatusBadge` usa `bg-blue-500` (Azul). |
| **Em Atendimento** (`in-progress`) | `hsl(var(--primary))` | Roxo Orion | ⚠️ **Divergência Grave**: `StatusBadge` usa `bg-yellow-500` (Amarelo). |
| **Reabertos** (`reopened`) | `hsl(var(--destructive))` | Vermelho | ⚠️ **Divergência Grave**: `StatusBadge` usa `bg-orange-500` (Laranja). |
| **Aguard. Cliente** (`awaiting-customer`) | `#906090` | Roxo Claro (Hex) | ⚠️ **Inconsistência**: `StatusBadge` usa `bg-purple-500` (Púrpura Tailwind). |
| **Aguard. Terceiro** (`awaiting-third-party`) | `#604878` | Roxo Base (Hex) | ⚠️ **Inconsistência**: `StatusBadge` usa `bg-indigo-500` (Índigo Tailwind). |

---

### 3.2. `src/pages/Reports.tsx`
A tela de relatórios e insights possui 13 gráficos Recharts/SVG com as seguintes injeções de cores:

#### A. Gráfico de Pizza de Status de Chamados (`L566-602`):
Indexado pelo objeto local `STATUS_COLORS` (L115-125):
- `open`: `#3b82f6` (blue-500)
- `in-progress`: `#906090` (Roxo Orion) — *Conflito com StatusBadge (`yellow-500`)*
- `awaiting-customer`: `#eab308` (yellow-500) — *Conflito com StatusBadge (`purple-500`)*
- `awaiting-third-party`: `#f97316` (orange-500) — *Conflito com StatusBadge (`indigo-500`)*
- `resolved`: `#22c55e` (green-500)
- `closed`: `#64748b` (slate-500)
- `reopened`: `#ec4899` (pink-500) — *Conflito com StatusBadge (`orange-500`)*
- `cancelled`: `#94a3b8` (slate-400)
- `unknown`: `#94a3b8` (slate-400)

#### B. Gráfico de Área de Tendência de SLA (`L694-705`):
- `No Prazo` (`ok`): `stroke="#22c55e" fill="#22c55e"` (green-500)
- `Atenção` (`attention`): `stroke="#eab308" fill="#eab308"` (yellow-500)
- `Estourado` (`breached`): `stroke="#ef4444" fill="#ef4444"` (red-500)

#### C. Gráficos de Linha de Adoção de IA e Automação (`L1037-1047`):
- `Artigos KB Vinculados`: `stroke="#3b82f6"` (blue-500)
- `Ações Automatizadas`: `stroke="#8b5cf6"` (purple-500)

#### D. Gráficos de Barras Simples e Duplos (`Reports.tsx`):
- Volume por Categoria / Técnico / Empresa / Canal: `fill="hsl(var(--primary))"`
- Tempo Médio (MTTR) por Técnico: `fill="hsl(var(--warning))"`
- Taxa de Reabertura: `fill="hsl(var(--destructive))"`
- Satisfação (CSAT): `fill="hsl(var(--primary))"`
- Horas Totais: `fill="hsl(var(--muted-foreground))"`
- Horas Faturáveis: `fill="hsl(var(--success))"`

---

### 3.3. `src/components/monitoring/PerformanceChart.tsx`
Gráficos de telemetria histórica de hardware:
- **CPU**: `stroke="#906090"` \| Gradiente `stopColor="#906090"` (Roxo Orion)
- **RAM**: `stroke="#7c529e"` \| Gradiente `stopColor="#7c529e"` (Roxo médio)
- **Disco**: `stroke="#f59e0b"` \| Gradiente `stopColor="#f59e0b"` (Amber-500)

---

### 3.4. `src/pages/WebMonitoring.tsx`
Gráfico de área de tempo de resposta web:
- **Latência Web**: `stroke="#3b82f6"` \| Gradiente `stopColor="#3b82f6"` (Blue-500)

---

### 3.5. Gráficos SVG Diretos (`GaugeChart.tsx` e `BulletChart.tsx`)
- **`GaugeChart.tsx` (L43)**: Arco com `cor = atingiu ? 'hsl(var(--success))' : 'hsl(var(--destructive))'`.
- **`BulletChart.tsx` (L34, 85)**: Barra de medição `dentroDaMeta ? 'hsl(var(--success))' : 'hsl(var(--destructive))'`. Faixas de fundo com `hsl(var(--warning))` e `hsl(var(--success))` a 18% de opacidade.

---

## 4. Tabelas de Resumo Quantitativo

### 4.1. Resumo: Mapas Locais vs. Componentes Canônicos

| Dimensão de Estado | Usos de Componente Canônico | Reimplementações Locais / Switches | Estado Arquitetural |
| :--- | :---: | :---: | :--- |
| **Status de Tickets** | 7 arquivos | 7 arquivos | ⚠️ Fragmentado (StatusBadge canônico usa cores literais; gráficos usam cores divergentes) |
| **Prioridade de Tickets** | 8 arquivos | 3 arquivos | ⚠️ Médio (PriorityBadge bem adotado, mas selects e SLAConfig divergem) |
| **SLA de Tickets** | 4 arquivos | 3 arquivos (gráficos) | 🟡 Estável (SLABadge canônico segue tokens semânticos) |
| **Status de Máquinas (RMM)** | 0 arquivos | 10 arquivos | 🔴 Crítico (status-badge.tsx órfão; 10 arquivos com implementações ad-hoc) |
| **Status de Ativos (CMDB)** | 0 arquivos | 2 arquivos | 🔴 Crítico (Nenhum componente canônico; cores de dot/texto literais) |
| **Contratos e Usuários** | 0 arquivos | 6 arquivos | 🔴 Crítico (Shadcn genérico ou botões estilizados com Tailwind literal) |
| **TOTAL GERAL** | **19 ocorrências** | **31 ocorrências** | **62% de reimplementação ad-hoc** |

---

### 4.2. Lista Completa de Arquivos que Necessitam de Migração (Fase 2+)

Abaixo estão listados todos os **30 arquivos** que contêm renderização visual de estados e que devem ser alvos de padronização nas fases posteriores:

| # | Arquivo | Motivo da Migração |
| :---: | :--- | :--- |
| 1 | `src/components/shared/StatusBadge.tsx` | Migrar classes literais (`bg-blue-500`, `bg-yellow-500`, etc.) para tokens semânticos ou unificar com `src/components/ui/status-badge.tsx`. |
| 2 | `src/components/shared/PriorityBadge.tsx` | Migrar `high` (`bg-orange-500/10`) para token semântico/variante consistente. |
| 3 | `src/components/ui/status-badge.tsx` | Ativar ou integrar este componente CVA para que passe a ser o padrão oficial de RMM e CMDB. |
| 4 | `src/hooks/useTechnicianStats.ts` | Corrigir injeção de cores de fatias para que casem com a semântica oficial do `StatusBadge`. |
| 5 | `src/components/dashboard/WorkloadChart.tsx` | Consumir tokens/classes unificadas para a paleta de status. |
| 6 | `src/components/dashboard/TechnicianDashboard.tsx` | Migrar `StatCard` (amber/emerald/rose) e tabela de equipe (`text-emerald-500`) para tokens semânticos. |
| 7 | `src/components/ticket/TicketHeroHeader.tsx` | Migrar botões de ação rápida de status (`bg-emerald-600`, `text-yellow-600`, `text-purple-600`) para tokens. |
| 8 | `src/components/ticket/UnifiedTimeline.tsx` | Substituir `statusLabels` por `getStatusLabel` e migrar ícones/badges literais (`amber-100`, `yellow-500`, `purple-500`). |
| 9 | `src/components/ticket/TicketSummaryDialog.tsx` | Migrar dots e badges (`bg-red-500`, `bg-amber-500`, `bg-green-500`, `bg-purple-500`) para tokens semânticos. |
| 10 | `src/components/ticket/ResolutionDialog.tsx` | Migrar ícone `text-emerald-500` para `text-success`. |
| 11 | `src/pages/ClientPortal.tsx` | Migrar bordas e fundos dos cards (`emerald-500`, `blue-500`) para tokens semânticos de status. |
| 12 | `src/pages/NewTicket.tsx` | Migrar dots do select de prioridade (`bg-red-500`, `bg-orange-500`, `bg-amber-500`, `bg-emerald-500`) para tokens/PriorityBadge. |
| 13 | `src/pages/Reports.tsx` | Unificar mapa `STATUS_COLORS` e cores de áreas/linhas Recharts com a paleta oficial de tokens. |
| 14 | `src/components/monitoring/MachineCard.tsx` | Substituir pill de status local por componente canônico e migrar bordas (`amber-500`, `emerald-500`) e `OsIcon`. |
| 15 | `src/pages/Monitoring.tsx` | Migrar dots/contadores (`bg-emerald-500`, `bg-amber-500`) no sidebar, tabela e filtros para componente canônico. |
| 16 | `src/components/monitoring/MachineDrawer.tsx` | Migrar LED (`amber-400`, `green-400`, `red-400`), badges de Firewall/BitLocker (`emerald-500`, `red-500`) e RemoteSoftware (`blue-500`). |
| 17 | `src/components/monitoring/PlatformHealthTab.tsx` | Migrar `toneClasses` (`amber-500`, `red-500`, `green-500`) para tokens semânticos (`warning`, `destructive`, `success`). |
| 18 | `src/components/monitoring/PendingMachinesBanner.tsx` | Migrar `border-amber-500/30`, `text-amber-500`, `bg-amber-500/10` para tokens semânticos. |
| 19 | `src/pages/AlertsDashboard.tsx` | Migrar `colorMap` de alertas para tokens semânticos. |
| 20 | `src/pages/InfrastructureDashboard.tsx` | Migrar ícones das abas (`text-amber-500`, `text-indigo-500`) para tokens. |
| 21 | `src/pages/Assets.tsx` | Migrar status dots (`emerald-500`, `rose-500`, `amber-500`), badges de tipo e switch de ticket para componentes canônicos. |
| 22 | `src/components/assets/AssetTopologyGraph.tsx` | Migrar dots de status (`emerald-500`, `rose-500`, `amber-500`) e textos nos nós para componente canônico. |
| 23 | `src/components/admin/SLAConfiguration.tsx` | Corrigir divergência nas cores de prioridade (`rose-500`, `orange-500`, `blue-500`, `slate-500`). |
| 24 | `src/components/admin/CompanyManagement.tsx` | Migrar pills de contrato (`emerald-500`, `amber-500`) para tokens semânticos. |
| 25 | `src/components/settings/TwoFactorAuthSettings.tsx` | Migrar badge de status 2FA (`emerald-600`, `emerald-700`) para `variant="success"` ou tokens semânticos. |
| 26 | `src/pages/PatchManagement.tsx` | Migrar `STATUS_STYLE` de patches (`amber-500`, `blue-500`, `green-500`, `red-500`) para tokens semânticos. |
| 27 | `src/components/patch/PackageCard.tsx` | Migrar `TYPE_META` (`text-blue-500`, `text-green-500`, `text-purple-500`) para tokens. |
| 28 | `src/components/patch/DeployDialog.tsx` | Migrar dots de máquina online/offline (`bg-green-500`, `bg-red-500`) para componente canônico. |
| 29 | `src/pages/WebMonitoring.tsx` | Migrar badges de status de endpoints e links (`emerald-500`, `red-500`) e gráfico Recharts para tokens. |
| 30 | `src/pages/Avaliacao.tsx` | Migrar card e estrelas (`emerald-500`) para tokens semânticos (`success`). |

---

## 5. Próximos Passos Recomendados (Fase 2)

1. **Unificação dos Badges Canônicos:**
   - Eleger `src/components/ui/status-badge.tsx` como componente unificado universal para Status de RMM, CMDB, Web e Serviços.
   - Refatorar `src/components/shared/StatusBadge.tsx` e `src/components/shared/PriorityBadge.tsx` para utilizarem exclusivamente variáveis CSS semânticas (`--primary`, `--success`, `--warning`, `--destructive`, `--info`, `--muted`).
2. **Harmonização de Cores entre Tabelas e Gráficos:**
   - Criar uma constante única exportada (`STATUS_THEME_TOKENS`) que forneça tanto as classes Tailwind quanto os valores HSL/Hex necessários para o Recharts, garantindo que o status `open` tenha a mesma cor no card, na tabela, na pizza e no dashboard.
3. **Substituição Gradual dos Mapas Locais:**
   - Executar migração arquivo a arquivo conforme a lista da Seção 4.2.
