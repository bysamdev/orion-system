# Relatório de Auditoria de Design System: Overlays e Feedback
**Data:** 31 de Agosto de 2026  
**Auditor:** Subagente 6 — Overlays e Feedback (Fase 1: Auditoria Read-Only)  
**Escopo:** Mapeamento e auditoria estrutural de `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`, `Toast/Sonner`, `Badge`, `Skeleton` e `Alert` em todo o diretório `src/`.

---

## 1. Sumário Executivo & Diagnóstico Geral

A auditoria de componentes de **Overlays e Feedback** do **Orion System** analisou todos os arquivos TypeScript/TSX no diretório `src/` para avaliar a conformidade geométrica, semântica de cores, consistência visual entre superfícies e integridade da experiência do usuário em ambos os modos claro e escuro (*light/dark mode*).

### Principais Indicadores Quantitativos:
- **Total de Arquivos com Componentes de Overlay/Feedback:** 82 arquivos
- **Implementações de Dialog (`DialogContent`):** 30 arquivos (38 instâncias de conteúdo modal)
- **Implementações de AlertDialog (`AlertDialogContent`):** 16 arquivos (17 instâncias de confirmação crítica)
- **Implementações de Sheet (`SheetContent`):** 2 arquivos (3 instâncias de gaveta lateral)
- **Implementações de Popover (`PopoverContent`):** 2 arquivos (painel de notificações e base UI)
- **Implementações de Tooltip (`TooltipContent`):** 14 arquivos (20 instâncias de dicas contextuais)
- **Componente DropdownMenu oficial (`dropdown-menu.tsx`):** **0 ocorrências** (arquivo ausente no design system; substituído por menus ad-hoc e Popovers)
- **Sistema de Toast Duplicado:** **2 bibliotecas ativas simultaneamente no root (`App.tsx`)**
  - **Radix UI (`use-toast` / `toaster.tsx`):** 37 arquivos (80,4% dos disparos de feedback)
  - **Sonner (`sonner.tsx`):** 9 arquivos (19,6% dos disparos de feedback em módulos de monitoramento/ativos)
- **Instâncias de Badges & Status:** 37 arquivos utilizando `<Badge>`, `<StatusBadge>`, `<PriorityBadge>` e `<SLABadge>`
- **Instâncias de Skeletons:** 13 arquivos utilizando `<Skeleton>` (além de 1 implementação manual com divs brutas)
- **Instâncias de Alert Oficial (`<Alert>`):** Apenas **2 arquivos** (3 instâncias)
- **Caixas de Alerta / Banners Ad-Hoc Inline (`<div>` manuais):** **49 caixas de alerta construídas manualmente** em 18 arquivos

---

### Principais Diagnósticos & Problemas Críticos:

1. **Dessincronia Geométrica e Conflito Interno entre Dialog e AlertDialog:**
   - O componente base `Dialog` (`dialog.tsx`) foi atualizado para `sm:rounded-xl` (12px) e `shadow-xl`, enquanto `AlertDialog` (`alert-dialog.tsx`) permaneceu congelado no padrão original do shadcn `sm:rounded-lg` (8px) e `shadow-lg`.
   - Modais críticos de alerta/destruição possuem cantos mais pontudos (8px) e sombras menores que modais comuns (12px), criando uma hierarquia visual invertida.
   - Enquanto as superfícies principais da aplicação migraram para `rounded-xl` (247 ocorrências) e `rounded-2xl` (15 ocorrências), overlays secundários como `Popover` e `Tooltip` continuam em `rounded-md` (6px).

2. **Divisão Bipolar do Sistema de Notificações (Radix UI vs Sonner):**
   - Ambos os componentes `<Toaster />` (Radix) e `<Sonner />` estão montados lado a lado em `src/App.tsx` (linhas 74-75).
   - Telas do módulo de chamados, administração, autenticação e relatórios utilizam `@/hooks/use-toast`, gerando toasts no canto inferior direito com `rounded-md` e padding largo `p-6`.
   - Telas de monitoramento (`Monitoring.tsx`, `WebMonitoring.tsx`, `MachineCard.tsx`, `MachineDrawer.tsx`, `Assets.tsx`) utilizam `import { toast } from 'sonner'`, gerando toasts com animações e pilhas distintas. O usuário experimenta duas interfaces de notificação completamente diferentes dependendo da página em que se encontra.

3. **Fragmentação Semântica Extrema em Badges de Status (Dispositivos e Chamados):**
   - O estado **"Online"** de máquinas/serviços possui **4 implementações visuais distintas**:
     - `Monitoring.tsx`: Badge outline verde claro (`text-green-600 border-green-500/30 bg-green-500/10`).
     - `WebMonitoring.tsx`: Badge pill esmeralda (`bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 rounded-full`).
     - `MachineCard.tsx`: Badge sólido opaco com texto branco (`bg-green-500 hover:bg-green-600 text-white`).
     - `InventoryTab.tsx`: Badge outline esmeralda com texto médio (`border-emerald-500/30 bg-emerald-500/10 text-emerald-600`).
   - Na listagem de chamados em `src/pages/Assets.tsx` (linhas 1081 e 1085), o desenvolvedor ignorou os componentes padronizados `<StatusBadge>` e `<PriorityBadge>`, renderizando badges monocromáticos neutros (`<Badge variant="outline">` e `<Badge variant="secondary">`), eliminando a semântica de cores de status e prioridade.

4. **Falha Crítica de Contraste WCAG no `SLABadge.tsx` no Modo Escuro:**
   - `SLABadge.tsx` utiliza classes utilitárias fixas `text-green-700`, `text-yellow-700`, `text-orange-700` e `text-red-700` sem modificadores `dark:text-*`. No modo escuro (fundo escuro `hsl(222, 24%, 9.5%)`), o contraste dessas fontes cai para menos de **2.4:1**, tornando o texto ilegível e falhando frontalmente no critério WCAG 2.1 AA (mínimo 4.5:1).

5. **Subutilização de `<Alert>` e Proliferação de 49 Banners Ad-Hoc:**
   - O componente `Alert` oficial suporta apenas 2 variantes (`default` e `destructive`).
   - Devido à falta de variantes semânticas nativas (`warning`, `info`, `success`), 18 arquivos do sistema construíram **49 caixas de alerta manuais** com divs customizadas (`bg-amber-500/10`, `border-amber-500/20`, `bg-destructive/15`, etc.), gerando grande débito técnico e inconsistência de padding, ícones e radius.

---

## 2. Geometria dos Componentes de Overlay vs Superfícies Principais

### 2.1. Inventário Detalhado dos Componentes de Overlay

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             HIERARQUIA DE OVERLAYS                               │
├───────────────────┬──────────────┬────────────┬──────────────────┬───────────────┤
│ Componente        │ Raio Padrão  │ Sombra     │ Fundo            │ Arquivos      │
├───────────────────┼──────────────┼────────────┼──────────────────┼───────────────┤
│ Dialog            │ rounded-xl   │ shadow-xl  │ bg-background    │ 30 arquivos   │
│ AlertDialog       │ rounded-lg   │ shadow-lg  │ bg-background    │ 16 arquivos   │
│ Sheet (Drawer)    │ rounded-none │ shadow-lg  │ bg-background    │ 2 arquivos    │
│ Popover           │ rounded-md   │ shadow-md  │ bg-popover       │ 2 arquivos    │
│ Tooltip           │ rounded-md   │ shadow-md  │ bg-popover       │ 14 arquivos   │
│ DropdownMenu      │ NÃO EXISTE   │ N/A        │ N/A              │ 0 arquivos    │
│ Radix Toast       │ rounded-md   │ shadow-lg  │ bg-background    │ 37 arquivos   │
│ Sonner Toast      │ rounded-lg   │ shadow-lg  │ bg-background    │ 9 arquivos    │
│ Card (Superfície) │ rounded-lg   │ shadow-sm  │ bg-card          │ 40+ arquivos  │
│ Container Moderno │ rounded-xl   │ shadow-xs  │ bg-card/60       │ 60+ arquivos  │
│ Hero Container    │ rounded-2xl  │ shadow-md  │ bg-card          │ 15 arquivos   │
└───────────────────┴──────────────┴────────────┴──────────────────┴───────────────┘
```

---

### 2.2. Auditoria Individual de Overlays

#### A. `Dialog` (`src/components/ui/dialog.tsx`)
- **Configuração no Arquivo Base:**
  - Linha 39: `className="... sm:rounded-xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0 shadow-xl border bg-background p-6 ..."`
  - Raio base: `sm:rounded-xl` (12px). Sombra: `shadow-xl`. Fundo: `bg-background`.
- **Mapeamento de Usos e Sobrescritas:**
  - `src/components/admin/CannedResponsesManagement.tsx`: `<DialogContent className="max-w-2xl">`
  - `src/components/admin/CompanyManagement.tsx`: `<DialogContent className="max-w-xl">`
  - `src/components/admin/ContractManagement.tsx`: `<DialogContent className="max-w-lg">`
  - `src/components/admin/ResolutionChecklistManagement.tsx`: `<DialogContent className="sm:max-w-[500px]">`
  - `src/components/admin/RoutingRulesManagement.tsx`: `<DialogContent className="sm:max-w-[600px]">`
  - `src/components/admin/UserManagement.tsx`: `<DialogContent className="sm:max-w-[425px]">` (3 ocorrências)
  - `src/components/automation/RulesTab.tsx`: `<DialogContent className="sm:max-w-[620px]">`
  - `src/components/automation/TemplatesTab.tsx`: `<DialogContent>`
  - `src/components/patch/DeployDialog.tsx`: `<DialogContent className="sm:max-w-md">`
  - `src/components/patch/NewPackageDialog.tsx`: `<DialogContent className="sm:max-w-lg">`
  - `src/components/settings/TwoFactorAuthSettings.tsx`: `<DialogContent className="sm:max-w-lg">` (2 ocorrências)
  - `src/components/shared/InstitutionalLegalDialog.tsx`: `<DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-xl border-border bg-card">` (*Usa `bg-card` em vez de `bg-background`*)
  - `src/components/ticket/CannedResponseSelector.tsx`: `<DialogContent className="max-w-2xl">`
  - `src/components/ticket/TicketSummaryDialog.tsx`: `<DialogContent className="max-w-2xl bg-background border-border shadow-lg">` (*Rebaixa sombra para `shadow-lg`*)
  - `src/components/ui/command.tsx`: `<DialogContent className="overflow-hidden p-0 shadow-lg">`
  - `src/pages/Assets.tsx`: `<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">`, `<DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-6 overflow-hidden bg-background border-border/50">`, `<DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden">`
  - `src/pages/Auth.tsx`: `<DialogContent className="sm:max-w-md">`
  - `src/pages/KnowledgeBase.tsx`: `<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">`, `<DialogContent className="max-w-4xl h-[90vh] flex flex-col">`
  - `src/pages/Monitoring.tsx`: `<DialogContent className="sm:max-w-md rounded-lg">` (*Sobrescreve radius para `rounded-lg` 8px*)
  - `src/pages/NewTicket.tsx`: `<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">`
  - `src/pages/WebMonitoring.tsx`: `<DialogContent className="rounded-lg">` (2 ocorrências — *Sobrescreve radius para `rounded-lg` 8px*)

---

#### B. `AlertDialog` (`src/components/ui/alert-dialog.tsx`)
- **Configuração no Arquivo Base:**
  - Linha 37: `className="... sm:rounded-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-0 shadow-lg border bg-background p-6 ..."`
  - Raio base: `sm:rounded-lg` (8px) vs `sm:rounded-xl` (12px) do Dialog. Sombra: `shadow-lg` vs `shadow-xl` do Dialog.
- **Mapeamento de Usos e Sobrescritas:**
  - `src/components/admin/CannedResponsesManagement.tsx`: `<AlertDialogContent>`
  - `src/components/admin/CompanyManagement.tsx`: `<AlertDialogContent>`
  - `src/components/admin/ContractManagement.tsx`: `<AlertDialogContent>`
  - `src/components/admin/RoutingRulesManagement.tsx`: `<AlertDialogContent>`
  - `src/components/admin/UserManagement.tsx`: `<AlertDialogContent>`
  - `src/components/automation/RulesTab.tsx`: `<AlertDialogContent>`
  - `src/components/automation/TemplatesTab.tsx`: `<AlertDialogContent>`
  - `src/components/monitoring/ForceUpdateButton.tsx`: `<AlertDialogContent>`
  - `src/components/monitoring/MachineCard.tsx`: `<AlertDialogContent onClick={(e) => ...}>`
  - `src/components/monitoring/MachineDrawer.tsx`: `<AlertDialogContent className="rounded-lg">`
  - `src/components/monitoring/RemoteTerminal.tsx`: `<AlertDialogContent>`
  - `src/components/settings/TwoFactorAuthSettings.tsx`: `<AlertDialogContent>` (2 ocorrências)
  - `src/components/ticket/EscalateDialog.tsx`: `<AlertDialogContent className="sm:max-w-[500px] border-border/50 bg-background/95 backdrop-blur shadow-2xl">` (*Adiciona `backdrop-blur` e eleva sombra para `shadow-2xl`*)
  - `src/components/ticket/ResolutionDialog.tsx`: `<AlertDialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">`
  - `src/components/tickets/MergeTicketDialog.tsx`: `<AlertDialogContent className="sm:max-w-[420px]">`
  - `src/pages/TicketDetails.tsx`: `<AlertDialogContent>`

---

#### C. `Sheet` (`src/components/ui/sheet.tsx`)
- **Configuração no Arquivo Base:**
  - Linha 34: `className="fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out ..."`
  - Bordas laterais retas (`border-l`, `border-r`, `rounded-none`).
- **Mapeamento de Usos e Sobrescritas:**
  - `src/components/monitoring/MachineDrawer.tsx`:
    - `<SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0 flex flex-col h-full overflow-hidden border-l border-border/40 shadow-2xl">`
    - Sobrescrita de sombra para `shadow-2xl` e reset de padding para `p-0`. Internamente, contém dezenas de cards com `rounded-xl` (12px).
  - `src/components/ui/sidebar.tsx`:
    - `<SheetContent data-sidebar="sidebar" data-mobile="true" className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground ...">`

---

#### D. `Popover` (`src/components/ui/popover.tsx`)
- **Configuração no Arquivo Base:**
  - Linha 20: `className="z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none ..."`
  - Raio base: `rounded-md` (6px). Sombra: `shadow-md`.
- **Mapeamento de Usos e Sobrescritas:**
  - `src/components/dashboard/NotificationsPopover.tsx`: `<PopoverContent className="w-80 p-0" align="end">`
  - **Problema de Harmonia:** Dentro do Popover de notificações, a lista interna renderiza botões e cards que usam `rounded-lg` ou `rounded-xl`, gerando elementos com cantos mais arredondados do que o próprio container pai (6px).

---

#### E. `Tooltip` (`src/components/ui/tooltip.tsx`)
- **Configuração no Arquivo Base:**
  - Linha 20: `className="z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in ..."`
  - Raio base: `rounded-md` (6px). Tipografia: `text-sm`.
- **Mapeamento de Usos e Sobrescritas Despadronizadas:**
  - `src/components/dashboard/TechnicianDashboard.tsx`: `<TooltipContent side="top" className="bg-popover/95 backdrop-blur-sm border-border/60 shadow-xl text-xs px-3 py-1.5 rounded-xl z-50">` (*Muda para `rounded-xl`, `shadow-xl`, `backdrop-blur-sm`, `text-xs`*)
  - `src/pages/NewTicket.tsx`: `<TooltipContent side="top" sideOffset={8} className="max-w-xs p-3 space-y-2 bg-popover/95 backdrop-blur border border-border shadow-xl text-left">` (*Muda para `shadow-xl`, `backdrop-blur`, padding `p-3`*)
  - `src/components/dashboard/TopBar.tsx`: `<TooltipContent className="text-[10px] font-bold">`
  - `src/components/dashboard/TechnicianDashboard.tsx` (linhas 128, 148, 168): `<TooltipContent side="bottom" className="font-medium">`
  - 10 outros arquivos usam o `<TooltipContent>` padrão sem modificadores, criando uma disparidade estética evidente entre telas.

---

#### F. `DropdownMenu` & Menus Dropdown
- **Diagnóstico:** O componente `@radix-ui/react-dropdown-menu` **não foi implementado** na camada `src/components/ui/`.
- **Implementações Substitutivas Ad-Hoc:**
  1. **TopBar Busca Dropdown (`src/components/dashboard/TopBar.tsx`):**
     - Container: `<div className="absolute top-full left-0 right-0 mt-2 bg-card/90 backdrop-blur-xl border border-border/60 shadow-2xl rounded-lg p-2 z-50 animate-in fade-in slide-in-from-top-2 overflow-y-auto max-h-[360px]">` (`rounded-lg` = 8px)
     - Botão de Item Interno: `<button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 transition-colors text-left group">` (`rounded-xl` = 12px)
     - **Inversão Geométrica Grave:** O container externo tem cantos de 8px e o botão interno tem cantos de 12px, gerando sobreposição visual nos cantos durante o estado de *hover*.
  2. **Dropdowns de Seleção em `NewTicket.tsx` e `TicketDetails.tsx`:**
     - Utilizam `<Select>` com `SelectContent` (`rounded-md` 6px, `shadow-md`).

---

### 2.3. Quantificação Exata das Classes de Border Radius em `src/`

Para compreender a dimensão da divergência entre a base do shadcn/ui e a interface modernizada do Orion System, a tabela abaixo contabiliza todas as classes de raio de borda utilizadas nos 185 arquivos do projeto:

| Classe Tailwind | Medida em Pixels | Total de Ocorrências | Onde Predomina no Código | Papel no Design System |
| :--- | :---: | :---: | :--- | :--- |
| **`rounded-xl`** | **12px** | **247** | Dashboard do Técnico, Cards de Máquinas, Drawers, Modais, Gráficos | **Padrão Moderno De Facto** das superfícies e containers principais |
| **`rounded-lg`** | **8px** | **148** | Cards secundários, tabelas, caixas de alerta, botões de ação | Padrão clássico do CVA (`var(--radius)`) |
| **`rounded-full`**| **9999px** | **141** | Badges de status, avatares, pills de filtro, botões de ícone | Elementos circulares e chips de identificação |
| **`rounded-md`** | **6px** | **74** | **Base shadcn:** Popover, Tooltip, Select, Command, Skeleton, Toast | **Padrão Legado** causando dessincronia com os containers |
| **`rounded-2xl`**| **16px** | **15** | Hero cards, Dashboard do Técnico, Portal do Cliente | Superfícies de alto destaque e cartões mestre |
| **`rounded-sm`** | **4px** | **6** | Botões de fechar (`X`) em modais, itens de select | Microcontroles e cantos mínimos |
| **`rounded-3xl`**| **24px** | **2** | Banner de onboarding em Monitoring e Card de SLA em Admin | Superfícies promocionais ultra-arredondadas |
| **`rounded-xs`** | **2px** | **2** | Pequenos indicadores de progresso | Microdetalhes |
| **`rounded-none`**| **0px** | **1** | Borda lateral de Sheet | Arestas retas de encadeamento lateral |

---

## 3. Análise do Componente Badge e Semânticas de Cores entre Telas

### 3.1. Arquitetura dos Badges Padronizados

O Orion System possui 3 componentes dedicados para renderização de status semânticos:
1. **`src/components/shared/StatusBadge.tsx`**: Status de ciclo de vida de tickets (`open`, `in-progress`, `awaiting-customer`, `awaiting-third-party`, `resolved`, `closed`, `reopened`, `cancelled`).
2. **`src/components/shared/PriorityBadge.tsx`**: Prioridades operacionais (`urgent`, `high`, `medium`, `low`).
3. **`src/components/dashboard/SLABadge.tsx`**: Níveis de cumprimento de prazo de SLA (`ok`, `warning`, `attention`, `breached`).

---

### 3.2. Matriz de Discrepâncias Semânticas entre Telas

A tabela a seguir evidencia como o mesmo conceito semântico é representado de maneiras totalmente divergentes em diferentes telas do sistema:

| Conceito Semântico | Tela / Componente | Implementação Visual e Classes Tailwind | Variante / Estilo | Problema Identificado |
| :--- | :--- | :--- | :--- | :--- |
| **Dispositivo Online** | `Monitoring.tsx` | `text-green-600 border-green-500/30 bg-green-500/10` | Outline suave | Usa matiz `green` em vez de token semântico |
| **Dispositivo Online** | `WebMonitoring.tsx` | `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 rounded-full` | Default pill | Usa `emerald` com opacidade / pill |
| **Dispositivo Online** | `MachineCard.tsx` | `bg-green-500 hover:bg-green-600 text-white` | Default sólido | Usa verde sólido opaco (quebra o padrão translúcido) |
| **Dispositivo Online** | `MachineDrawer.tsx` | `bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400` | Outline suave | Usa `emerald-500/10` |
| **Dispositivo Online** | `InventoryTab.tsx` | `border-emerald-500/30 bg-emerald-500/10 text-emerald-600` | Outline suave | Usa `emerald-600` sem classe de dark mode |
| **Dispositivo Offline** | `Monitoring.tsx` | `text-red-600 border-red-500/30 bg-red-500/10` | Outline suave | Usa `red-600` |
| **Dispositivo Offline** | `WebMonitoring.tsx` | `variant="destructive"` | Destructive | Usa token de destruição sólido |
| **Dispositivo Offline** | `MachineCard.tsx` | `variant="destructive" uppercase` | Destructive | Usa destructive padrão do shadcn |
| **Dispositivo Offline** | `MachineDrawer.tsx` | `bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-400` | Outline cinza | **Usa cinza (`zinc`) em vez de vermelho**, descaracterizando erro/queda |
| **Status de Chamado** | `Assets.tsx` (L. 1081) | `<Badge variant="outline">{getStatusLabel(ticket.status)}</Badge>` | Outline neutro | **Ignora `<StatusBadge>`**, remove todas as cores |
| **Prioridade de Chamado** | `Assets.tsx` (L. 1085) | `<Badge variant="secondary">{ticket.priority}</Badge>` | Secondary neutro | **Ignora `<PriorityBadge>`**, remove todas as cores |
| **Prioridade de Chamado** | `TopBar.tsx` (L. 127) | `<StatusBadge status={ticket.status} className="text-[9px] py-0 h-4" />` | Micro badge | Reduz escala tipográfica para 9px |
| **Ticket Resumo** | `TicketSummaryDialog.tsx` | `bg-purple-500/10 text-purple-600 border-purple-200` | Secondary lilás | Usa roxo fixo (`purple-500/10`) hardcoded |
| **Alerta Crítico** | `AlertsDashboard.tsx` | `bg-rose-600 text-white shadow-rose-500/20 text-[9px] font-black uppercase` | Sólido + Sombra | Usa `rose-600` sólido com sombra colorida |
| **Alerta Crítico** | `MachineDrawer.tsx` | `border-red-500/30 bg-red-500/10 text-red-600` | Suave translúcido | Usa `red-500/10` sem sombra |
| **Alerta Crítico** | `Assets.tsx` (L. 708) | `bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[11px]` | Destructive suave | Usa `rose-500/10` com fonte 11px |
| **Tipo de Servidor** | `Assets.tsx` (L. 708) | `bg-indigo-500/10 text-indigo-600 border-indigo-500/30` | Suave índigo | Sem componente compartilhado para hardware |
| **Tipo de Notebook** | `Assets.tsx` (L. 708) | `bg-sky-500/10 text-sky-600 border-sky-500/30` | Suave sky | Sem componente compartilhado para hardware |
| **Tipo de Desktop** | `Assets.tsx` (L. 708) | `bg-emerald-500/10 text-emerald-600 border-emerald-500/30` | Suave esmeralda | Sem componente compartilhado para hardware |

---

### 3.3. Avaliação de Acessibilidade e Falhas no Dark Mode

```tsx
// Trecho de src/components/dashboard/SLABadge.tsx (linhas 51-79)
const statusConfig: Record<string, StatusConfig> = {
  ok: {
    color: 'bg-green-500/10 text-green-700 border-green-500/20', // FALHA NO DARK MODE
    iconColor: 'text-green-600',
  },
  warning: {
    color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20', // FALHA NO DARK MODE
    iconColor: 'text-yellow-600',
  },
  attention: {
    color: 'bg-orange-500/10 text-orange-700 border-orange-500/20', // FALHA NO DARK MODE
    iconColor: 'text-orange-600',
  },
  breached: {
    color: 'bg-red-500/10 text-red-700 border-red-500/20', // FALHA NO DARK MODE
    iconColor: 'text-red-600',
  }
};
```

#### Diagnóstico de Contraste:
- **`text-green-700` / `text-red-700` sobre fundo escuro:** A cor `#15803d` (green-700) sobre o fundo dark mode `#0f141c` (hsl 222 24% 9.5%) gera um contraste de **2.38:1**, violando o requisito mínimo de 4.5:1 da WCAG AA para textos normais.
- **Comparação com `StatusBadge.tsx`:** O arquivo `StatusBadge.tsx` implementou corretamente classes como `dark:text-green-400`, `dark:text-blue-400`, `dark:text-yellow-400`, demonstrando que o `SLABadge.tsx` foi esquecido na rodada de calibração de acessibilidade.

---

## 4. Mapeamento e Avaliação de Skeleton, Alert e Toast

### 4.1. `Skeleton` (`src/components/ui/skeleton.tsx`)

- **Configuração no Arquivo Base:**
  - Linha 9: `className={cn("animate-pulse rounded-md bg-muted", className)}`
  - Raio base: `rounded-md` (6px). Fundo: `bg-muted`.
- **Mapeamento de Usos e Sobrescritas de Radius:**
  - `src/components/admin/PlanUsageCard.tsx`: `<Skeleton className="h-5 w-32" />` (usa `rounded-md` padrão)
  - `src/components/admin/UserManagement.tsx`: `<Skeleton className="h-9 w-36 rounded-md" />` e `<Skeleton className="h-7 w-24 rounded-md" />`
  - `src/components/monitoring/MachineCard.tsx` (`MachineCardSkeleton`):
    - Linha 597: `<Skeleton className="h-10 w-10 rounded-xl shrink-0" />`
    - Linha 599: `<Skeleton className="h-4 w-32 rounded" />` (4px)
    - Linha 603: `<Skeleton className="h-6 w-16 rounded-full shrink-0" />`
    - Linhas 608-610: `<Skeleton className="h-16 w-full rounded-xl" />` (12px)
    - Linha 616: `<Skeleton className="h-6 w-6 rounded-lg" />` (8px)
  - `src/components/monitoring/PerformanceChart.tsx`: `<Skeleton className="h-60 w-full rounded-xl" />`
  - `src/components/monitoring/PlatformHealthTab.tsx`: `<Skeleton className="h-20 rounded-xl" />` (Array de 6 itens)
  - `src/pages/Admin.tsx`: `<Skeleton className="h-9 w-32 rounded-lg" />` (Array de 6 itens)
  - `src/pages/AlertsDashboard.tsx`: `<Skeleton className="h-32 rounded-xl" />`
  - `src/pages/Assets.tsx`: `<Skeleton className="h-10 w-36 rounded-lg" />`, `<Skeleton className="h-24 rounded-xl" />`, `<Skeleton className="h-96 w-full rounded-xl" />`
  - `src/pages/Monitoring.tsx`: `<Skeleton className="h-10 w-full rounded-lg" />`
  - `src/pages/TicketDetails.tsx` (`TicketDetailSkeleton`):
    - **Bypass total do componente:** Em vez de usar `<Skeleton>`, a página declara `TicketDetailSkeleton` (linhas 53-64) com elementos manuais `<div className="h-8 bg-muted rounded w-1/3" />` utilizando classe `rounded` (4px).

#### Diagnóstico do Skeleton:
Existe um descompasso visual perceptível durante o carregamento de páginas: os skeletons piscam na tela com bordas de 4px ou 6px (`rounded-md`), e quando a requisição finaliza, o conteúdo salta para cartões modernos de 12px ou 16px (`rounded-xl` / `rounded-2xl`), causando sensação de *Layout Shift* visual.

---

### 4.2. `Alert` (`src/components/ui/alert.tsx`)

- **Configuração no Arquivo Base:**
  - Linhas 6-18: CVA declara apenas 2 variantes:
    - `default`: `"bg-background text-foreground"`
    - `destructive`: `"border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"`
  - Raio base: `rounded-lg` (8px). Borda: `border`. Padding: `p-4`.
- **Mapeamento de Uso Oficial:**
  - `src/components/admin/UserManagement.tsx`: Linhas 739, 847, 856 (`<Alert variant="destructive">`)
  - `src/pages/SetPassword.tsx`: Linha 152 (`<Alert variant="destructive">`)
- **Proliferação de 49 Banners Ad-Hoc (`<div>` manuais):**
  - Devido à falta de variantes `warning`, `info` e `success` no CVA do `alert.tsx`, desenvolvedores criaram caixas de alerta inline em 18 arquivos:
    - `src/components/dashboard/TechnicianDashboard.tsx` (L. 371): `<div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex items-start gap-3 text-destructive animate-in fade-in zoom-in duration-300">`
    - `src/components/RootErrorBoundary.tsx` (L. 170): `<div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-destructive shadow-lg shadow-destructive/5">`
    - `src/components/automation/RuleForm.tsx` (L. 80, 154): `<div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">` e `<div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">`
    - `src/components/settings/TwoFactorAuthSettings.tsx` (L. 270, 574): `<div className="relative overflow-hidden p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 backdrop-blur-sm ...">`
    - `src/components/ticket/EscalateDialog.tsx` (L. 102): `<div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">`
    - `src/components/patch/DeployDialog.tsx` (L. 80): `<div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">`
    - `src/components/knowledge/ArticleMarkdownRenderer.tsx` (L. 99, 131): `<div className="my-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">`
    - `src/components/shared/RouteLoadingFallback.tsx` (L. 43): `<div className="mt-4 p-4 rounded-lg bg-muted/60 border border-border/50 text-left space-y-3 ...">`

---

### 4.3. Toast e Notificações (Radix UI vs Sonner)

O sistema possui uma duplicidade estrutural crítica: **duas bibliotecas de notificação foram instaladas e estão ativas simultaneamente no componente raiz `App.tsx`**.

```tsx
// src/App.tsx (linhas 74-75)
<TooltipProvider>
  <Toaster />  {/* Radix UI Toast */}
  <Sonner />   {/* Sonner Toast */}
  <BrowserRouter>
```

#### Comparativo Técnico: Radix Toast vs Sonner

| Atributo | Radix UI Toast (`toaster.tsx`) | Sonner (`sonner.tsx`) |
| :--- | :--- | :--- |
| **Origem do Hook** | `import { useToast } from "@/hooks/use-toast"` | `import { toast } from "sonner"` |
| **Arquivos que Utilizam** | **37 arquivos** (Admin, Tickets, Settings, Auth, Hooks) | **9 arquivos** (Monitoring, Assets, WebMonitoring) |
| **Posicionamento** | `sm:bottom-0 sm:right-0` (Fixo no rodapé direito) | Canto inferior direito / Pilha empilhada fluida |
| **Border Radius** | `rounded-md` (6px) | `rounded-lg` (8px) |
| **Padding** | `p-6 pr-8` (Espaçamento largo) | Compacto e dinâmico |
| **Variantes Nativas** | Apenas `default` e `destructive` | `toast.success()`, `toast.error()`, `toast.info()`, `toast.warning()`, `toast.promise()` |
| **Ações / Botões** | `<ToastAction>` customizado | `actionButton` / `cancelButton` via opções |
| **Suporte a Temas** | CSS customizado via `bg-background` | Integrado com hook `useTheme()` |

#### Impacto na Experiência do Usuário (UX):
1. **Inconsistência de Feedback:** Ao criar um chamado (`NewTicket.tsx`), o usuário recebe um toast retangular largo do Radix com `rounded-md`. Ao atualizar uma máquina em `Monitoring.tsx`, o usuário recebe uma notificação flutuante com animação elástica do Sonner.
2. **Conflito de Renderização:** Se ações em segundo plano dispararem ambos simultaneamente, as duas notificações se sobrepõem na tela, competindo pela atenção do usuário com estilos e fontes discordantes.

---

## 5. Matriz de Riscos, Acessibilidade e Impactos

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             MATRIZ DE RISCO & IMPACTO                            │
├──────────────────────────────┬───────────────┬───────────────────────────────────┤
│ Risco / Inconsistência       │ Gravidade     │ Impacto no Usuário / Aplicação    │
├──────────────────────────────┼───────────────┼───────────────────────────────────┤
│ Falha de Contraste no SLA    │ CRÍTICO (Alta)│ Texto ilegível no Dark Mode;      │
│                              │               │ Violação da WCAG 2.1 AA (1.4.3).  │
├──────────────────────────────┼───────────────┼───────────────────────────────────┤
│ Duplicidade de Toast         │ ALTO          │ Fragmentação visual; Toasts se    │
│ (Radix vs Sonner)            │               │ sobrepondo com estilos distintos. │
├──────────────────────────────┼───────────────┼───────────────────────────────────┤
│ 49 Banners Ad-Hoc Inline     │ MÉDIO-ALTO    │ Débito técnico; quebra de design  │
│ (Ausência de CVA no Alert)   │               │ tokens; manutenção descentralizada│
├──────────────────────────────┼───────────────┼───────────────────────────────────┤
│ Dessincronia de Radius       │ MÉDIO         │ Interface parece amadora com      │
│ (6px vs 12px vs 16px)        │               │ elementos 6px dentro de 12px.     │
├──────────────────────────────┼───────────────┼───────────────────────────────────┤
│ Inversão em TopBar Dropdown  │ MÉDIO         │ Botão de 12px dentro de caixa de  │
│                              │               │ 8px transborda cantos no hover.   │
├──────────────────────────────┼───────────────┼───────────────────────────────────┤
│ Badges Descoloridos          │ BAIXO-MÉDIO   │ Usuário perde semântica de status │
│ em Assets.tsx (L. 1081)      │               │ na tabela de chamados vinculados. │
└──────────────────────────────┴───────────────┴───────────────────────────────────┘
```

---

## 6. Plano de Padronização e Recomendações Técnicas (Fase 2)

As recomendações a seguir devem ser executadas na Fase 2 de Refatoração e Padronização:

### 6.1. Sincronização Geométrica de Overlays

1. **Padronizar `AlertDialog` e `Dialog` com `sm:rounded-xl` e `shadow-xl`:**
   - Atualizar `src/components/ui/alert-dialog.tsx` para usar `sm:rounded-xl` e `shadow-xl`, alinhando-se exatamente com `dialog.tsx`.
2. **Modernizar `Popover` e `Tooltip` para `rounded-xl`:**
   - Atualizar `src/components/ui/popover.tsx` de `rounded-md` para `rounded-xl` com `shadow-xl` e `backdrop-blur-sm`.
   - Atualizar `src/components/ui/tooltip.tsx` de `rounded-md text-sm` para `rounded-lg text-xs` (ou `rounded-xl` em tooltips ricos), incorporando `backdrop-blur-sm` e bordas semitransparentes.
3. **Corrigir a Hierarquia do Dropdown da TopBar:**
   - Ajustar o container de resultados em `src/components/dashboard/TopBar.tsx` para `rounded-2xl` (ou `rounded-xl`), garantindo que os itens internos com `rounded-xl` (12px) fiquem geometricamente contidos.

---

### 6.2. Unificação do Sistema de Toasts

Recomenda-se **adotar o Sonner como o sistema de notificações padrão e exclusivo do Orion System**, descontinuando o Radix UI Toast:
1. **Motivação:** O Sonner suporta nativamente animações de pilha fluida, métodos semânticos (`toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.promise()`), excelente compatibilidade com Dark Mode e footprint reduzido.
2. **Ações:**
   - Criar um wrapper unificado `src/lib/toast.ts` ou exportar a instância configurada do Sonner em `src/components/ui/sonner.tsx`.
   - Remover `<Toaster />` do `src/App.tsx`.
   - Migrar os 37 arquivos que importam `useToast` para usar o `toast` do Sonner.
   - Deletar `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx` e `src/hooks/use-toast.ts`.

---

### 6.3. Expansão do CVA de `Alert` e Eliminação de Banners Ad-Hoc

Atualizar `src/components/ui/alert.tsx` para incorporar todas as variantes semânticas com suporte pleno a Dark Mode e cantos `rounded-xl`:

```tsx
// Proposta de expansão para src/components/ui/alert.tsx
const alertVariants = cva(
  "relative w-full rounded-xl border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 [&>svg]:text-destructive",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:border-amber-500/40 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
        info: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300 dark:border-blue-500/40 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 dark:border-emerald-500/40 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
```

Após essa atualização, substituir as 49 divs ad-hoc pelo componente `<Alert variant="...">`.

---

### 6.4. Padronização de Badges e Correção de Acessibilidade

1. **Correção Imediata no `SLABadge.tsx`:**
   - Adicionar classes `dark:text-*` em todas as configurações de cores:
     - `ok`: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20`
     - `warning`: `bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20`
     - `attention`: `bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20`
     - `breached`: `bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20`
2. **Criação do Componente Compartilhado `DeviceStatusBadge`:**
   - Criar `src/components/shared/DeviceStatusBadge.tsx` para unificar os estados de conectividade (`online`, `offline`, `alerting`) em `Monitoring.tsx`, `WebMonitoring.tsx`, `MachineCard.tsx`, `MachineDrawer.tsx` e `InventoryTab.tsx`.
3. **Correção em `src/pages/Assets.tsx`:**
   - Substituir os badges neutros nas linhas 1081 e 1085 por `<StatusBadge status={ticket.status} />` e `<PriorityBadge priority={ticket.priority} size="sm" />`.

---

### 6.5. Padronização de Skeletons

1. **Atualizar `src/components/ui/skeleton.tsx`:**
   - Modificar a classe base de `rounded-md` (6px) para `rounded-lg` (8px) ou permitir herança flexível com `rounded-xl` por padrão em skeletons estruturais.
2. **Substituir o `TicketDetailSkeleton` Manual:**
   - Refatorar as divs cruas de `src/pages/TicketDetails.tsx` (linhas 53-64) para utilizarem o componente `<Skeleton>` oficial com `rounded-xl`.

---

**Conclusão da Auditoria:**  
O subsistema de Overlays e Feedback apresenta alta maturidade funcional, mas sofre com fragmentação visual decorrente de modernizações incrementais desbalanceadas e coexistência de bibliotecas concorrentes (Radix Toast e Sonner). A aplicação das padronizações acima restabelecerá a coerência geométrica, garantirá conformidade WCAG AA e simplificará substancialmente a base de código do Orion System.
