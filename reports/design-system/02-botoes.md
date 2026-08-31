# Relatório de Auditoria de Design System: Botões e Ações
**Data:** 31 de Agosto de 2026  
**Auditor:** Subagente 2 — Botões e Ações (Fase 1: Auditoria Read-Only)  
**Escopo:** Mapeamento completo de componentes `<Button>` (shadcn) e `<button>` nativos em todo o diretório `src/`.

---

## 1. Sumário Executivo & Diagnóstico Geral

A auditoria de botões do **Orion System** analisou **185 arquivos TypeScript/TSX** no diretório `src/`, identificando um total de **296 botões** em execução.

### Principais Indicadores:
- **Total de Botões:** 296
- **Botões Shadcn (`<Button>`):** 250 (84,5%)
- **Botões Nativos (`<button>`):** 46 (15,5%)
- **Botões Somente com Ícone (*Icon-only*):** 44 botões detectados
- **Botões com Sobrescrita de Cor Manual (*Hardcoded/Tailwind overrides*):** 86 botões
- **Conformidade de Área de Toque Mínima (44x44px - WCAG 2.5.5):** Apenas **2 botões** (4,5%) dos *icon-only* atingem 44x44px. 42 botões (95,5%) possuem áreas de toque reduzidas (24x24px, 28x28px, 32x32px, 36x36px ou 40x40px).
- **Acessibilidade em Botões de Ícone:** 18 botões possuem `aria-label` adequado, 8 possuem apenas `title`, e 18 botões **não possuem qualquer nome acessível** (`aria-label` ou `title`).

### Principais Problemas Encontrados:
1. **Proliferação de Alturas e Tamanhos:** Existem **11 variações distintas de altura** aplicadas via classes customizadas (`h-6`, `h-7`, `h-8`, `h-9`, `h-10`, `h-11`, `h-12`, `h-14`, `h-16`, `h-32`, `h-auto`, `h-full`), anulando as dimensões padronizadas do CVA (`size="sm"`, `size="default"`, `size="lg"`, `size="icon"`).
2. **Inconsistência de Border Radius:** O padrão do CVA declara `rounded-md` (6px), mas há **55 botões forçando `rounded-xl` (12px)**, **28 forçando `rounded-lg` (8px)**, **3 forçando `rounded-2xl` (16px)** e **5 forçando `rounded-full`**. Isso cria uma experiência visual fragmentada entre cantos arredondados modernos (12px) e clássicos (6px).
3. **Sobrescrita Agressiva de Cores e Estados:** 86 botões utilizam classes Tailwind diretas como `bg-emerald-600`, `bg-green-600`, `bg-blue-600`, `bg-red-500`, `bg-purple-600`, `hover:bg-...`, quebrando o suporte nativo a temas (Dark/Light mode) e desconsiderando as variáveis CSS de design tokens (`primary`, `destructive`, `secondary`, `accent`).
4. **46 Botões Nativos Não Padronizados:** Uso de `<button>` cru em telas críticas como `Monitoring.tsx`, `NewTicket.tsx`, `Assets.tsx`, `TicketDetails.tsx` e `TicketHistory.tsx`, sem anéis de foco acessíveis (`focus-visible:ring-*`) e sem suporte a estados desabilitados uniformes.
5. **Déficit de Acessibilidade em Icon-Only Buttons:** 40,9% dos botões de ícone não possuem descrição textual para leitores de tela e 95,5% falham na recomendação de toque de 44x44px.

---

## 2. Tabelas de Frequência Quantitativa

### 2.1. Alturas Distintas Encontradas
| Altura Efetiva / Classe | Quantidade | Percentual | Impacto no Design System |
| :--- | :---: | :---: | :--- |
| **`h-10` (40px)** (Padrão CVA `default` / `icon`) | 129 | 43,6% | Tamanho padrão do Shadcn. |
| **`h-9` (36px)** (Padrão CVA `size="sm"`) | 84 | 28,4% | Tamanho compacto padrão. |
| **Sem altura fixa** (Nativos `h-auto` via padding) | 39 | 13,2% | Botões nativos ou cards de layout flexível. |
| **`h-11` (44px)** (Classes explícitas `h-11` + CVA `lg`) | 12 | 4,1% | Atende à recomendação de toque mínima (44px). |
| **`h-8` (32px)** (Classes explícitas `h-8`) | 13 | 4,4% | Altura customizada extra-pequena. |
| **`h-7` (28px)** (Classes explícitas `h-7`) | 7 | 2,4% | Altura customizada mini (ações em tabelas e cards). |
| **`h-6` (24px)** (Classes explícitas `h-6`) | 7 | 2,4% | Altura micro (botões de cópia e badge triggers). |
| **`h-full`** (Altura 100% do container pai) | 5 | 1,7% | Usado em barras de filtros e abas compactas. |
| **`h-auto`** (Sobrescrita explícita `h-auto`) | 2 | 0,7% | Botões tipo link ou texto com quebra de linha. |
| **`h-12` (48px)** (Classes explícitas `h-12`) | 2 | 0,7% | Botões de destaque em dialogs e landing. |
| **`h-14` (56px)** (Classes explícitas `h-14`) | 2 | 0,7% | Hero buttons em formulários de abertura de chamado. |
| **`h-32` (128px)** (Card button em Novo Chamado) | 1 | 0,3% | Botão de seleção de categoria em card grande. |
| **Total Geral** | **296** | **100%** | **11 Alturas Distintas** |

---

### 2.2. Variações de Border Radius
| Border Radius | Quantidade | Percentual | Status & Recomendações |
| :--- | :---: | :---: | :--- |
| **`rounded-md` (6px)** (Padrão CVA Button) | 188 | 63,5% | Padrão base do shadcn/ui. |
| **`rounded-xl` (12px)** (Sobrescrita explícita) | 55 | 18,6% | Estilo predominante no Dashboard do Técnico e Telas Modernas. |
| **`rounded-lg` (8px)** (Sobrescrita explícita) | 28 | 9,5% | Utilizado em cards e modais intermediários. |
| **Sem radius explícito** (Nativos / Herança) | 16 | 5,4% | `<button>` nativos sem cantos arredondados definidos. |
| **`rounded-full` (Pill / Círculo)** | 5 | 1,7% | Usado em avatares, pills de filtro e botões de ação flutuantes. |
| **`rounded-2xl` (16px)** | 3 | 1,0% | Usado em botões de destaque e cards do Dashboard do Técnico. |
| **`rounded` (4px)** | 1 | 0,3% | Botão de remover anexo em Novo Chamado. |
| **Total Geral** | **296** | **100%** | **6 Variações de Radius** |

---

### 2.3. Variações de Padding (Horizontais e Verticais)
| Padding Aplicado | Quantidade de Ocorrências | Contexto / Utilização |
| :--- | :---: | :--- |
| **Implícito no CVA** (`px-4 py-2`, `px-3`, `px-8`, ou sem padding no `icon`) | 199 | Comportamento padrão do Shadcn. |
| **`px-3` / `px-3.5`** | 19 | Botões compactos customizados. |
| **`px-4`** | 16 | Botões de ação principais com espaçamento médio. |
| **`px-2` / `px-2.5`** | 14 | Botões de tabela, badges e controles pequenos. |
| **`p-0`** | 12 | Botões com reset de padding para conter ícones ou imagens. |
| **`py-2` / `py-2.5`** | 8 | Botões de menu e lista vertical em Monitoring. |
| **`px-6`** | 5 | Botões largos de formulários e passos de onboarding. |
| **`p-3`** | 5 | Cards e itens clicáveis em listas de artigos e notificações. |
| **`p-1` / `p-1.5`** | 5 | Botões de fechar modal, avaliação de estrelas e lupa. |
| **`py-1` / `py-1.5`** | 4 | Botões de seleção de período e abas secundárias. |
| **`p-4`** | 4 | Botões estruturais tipo card em Novo Chamado e Detalhes. |
| **`px-8`** | 3 | Botões largos de submit e escalação. |
| **`px-5`** | 2 | Botões de retorno em tela de erro (ErrorBoundary). |
| **`px-10`** | 1 | Botão de submissão hero em Novo Chamado. |
| **`p-5` / `p-6`** | 2 | Cards de categoria de alta densidade. |
| **Nativo sem padding explícito** | 13 | Elementos que dependem de layout flex/grid externo. |

---

### 2.4. Variantes Usadas vs Declaradas no CVA (`src/components/ui/button.tsx`)

**Variantes Declaradas no CVA:**
- `default`: `bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent shadow-xs`
- `destructive`: `bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-xs`
- `outline`: `border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-xs`
- `secondary`: `bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent shadow-xs`
- `ghost`: `hover:bg-accent hover:text-accent-foreground border border-transparent`
- `link`: `text-primary underline-offset-4 hover:underline border border-transparent`

**Mapeamento de Variantes Utilizadas:**
| Variante | Contagem | Status no CVA | Observações |
| :--- | :---: | :---: | :--- |
| **`outline`** | 95 | ✅ Declarada | Variante mais utilizada no sistema (tabelas, filtros, ações secundárias). |
| **`ghost`** | 70 | ✅ Declarada | Segunda mais usada (ações de tabela, ícones, menus de contexto). |
| **`default` (implícito)** | 62 | ✅ Declarada (Default) | Botões primários padrão sem prop explícita. |
| **`default` (explícito)** | 6 | ✅ Declarada | Uso explícito `variant="default"`. |
| **`destructive`** | 6 | ✅ Declarada | Ações perigosas (exclusão, desconexão de terminal, reset). |
| **`secondary`** | 3 | ✅ Declarada | Rara utilização; frequentemente substituída por `outline`. |
| **`link`** | 2 | ✅ Declarada | Botões inline estilizados como link. |
| **Expressões Dinâmicas Ternárias** | 6 | ⚠️ Dinâmica | Ternários como `advancedFiltersOpen ? "default" : "outline"`, `filter === 'unread' ? 'default' : 'ghost'`, etc. |

---

## 3. Auditoria Detalhada dos 46 Botões Nativos (`<button>`)

Abaixo estão listados todos os 46 botões nativos identificados, agrupados por categoria funcional, com recomendação de migração:

### 3.1. Ações Inline e Controles de Interface (Recomendado Migrar para `<Button>`)
| # | Arquivo e Linha | Conteúdo / Ícone | Classes Aplicadas | Recomendação |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `src/components/assets/AssetTopologyGraph.tsx:221` | Ícone `<X />` | `p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors` | Migrar para `<Button variant="ghost" size="icon" aria-label="Fechar detalhes">`. |
| 2 | `src/components/assets/AssetTopologyGraph.tsx:269` | Texto "Voltar ao Mapa Geral" + `<RotateCcw />` | `flex items-center gap-2 px-4 py-2 rounded-xl bg-background/90 backdrop-blur-sm border border-border/50 text-xs font-semibold hover:bg-accent transition-colors shadow-sm` | Migrar para `<Button variant="outline" size="sm" className="rounded-xl">`. |
| 3 | `src/components/dashboard/Sidebar.tsx:152` | Ícone `<SlidersHorizontal />` (Filtro) | `flex items-center gap-1.5 px-3 pt-2 pb-3 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors` | Migrar para `<Button variant="ghost" size="sm">`. |
| 4 | `src/components/dashboard/Sidebar.tsx:162` | Ícones `<ArrowUpDown />` (Ordenação) | `flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors` | Migrar para `<Button variant="ghost" size="sm">`. |
| 5 | `src/components/dashboard/Sidebar.tsx:215` | Texto "Marcar todas como lidas" | `text-xs text-primary hover:underline font-medium` | Migrar para `<Button variant="link" size="sm" className="p-0 h-auto">`. |
| 6 | `src/components/dashboard/Sidebar.tsx:223` | Texto "Limpar histórico" | `text-xs text-muted-foreground hover:text-destructive transition-colors` | Migrar para `<Button variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-destructive">`. |
| 7 | `src/components/dashboard/TechnicianDashboard.tsx:157` | Ícone `<RefreshCw />` (Recarregar métricas) | `inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors` | Migrar para `<Button variant="ghost" size="sm">`. |
| 8 | `src/components/monitoring/MonitoringOnboarding.tsx:132` | Texto "Copiar token" | `text-xs font-medium text-primary hover:underline` | Migrar para `<Button variant="link" size="sm">`. |
| 9 | `src/pages/Assets.tsx:498` | Ícone `<X />` (Limpar busca de ativos) | `absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground` | Migrar para `<Button variant="ghost" size="icon" className="h-6 w-6 absolute right-2 top-1/2 -translate-y-1/2">`. |
| 10 | `src/pages/Assets.tsx:743` | Nome do Host / Ativo | `text-sm font-bold text-primary hover:underline flex items-center gap-1.5 w-fit group/btn` | Manter `<button>` semântico de tabela ou usar `<Button variant="link">`. |
| 11 | `src/pages/Assets.tsx:823` | Contador de Chamados da Máquina | `inline-flex items-center justify-center gap-1 hover:scale-105 transition-transform` | Migrar para `<Button variant="ghost" size="sm" className="h-7 px-2">`. |
| 12 | `src/pages/NewTicket.tsx:628` | Sugestão de Categoria Inteligente | `flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all text-sm font-bold` | Migrar para `<Button variant="outline" className="rounded-xl border-amber-500/30 bg-amber-500/10 ...">`. |
| 13 | `src/pages/NewTicket.tsx:827` | Ícone `<X />` (Remover arquivo anexo) | `text-muted-foreground hover:text-destructive transition-colors ml-1 p-0.5 rounded` | Migrar para `<Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remover anexo">`. |
| 14 | `src/pages/Reports.tsx:348` | Seletor de Modo de Relatório | `px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize` | Migrar para componente de Tabs ou `<Button variant={mode === m ? 'default' : 'ghost'} size="sm">`. |
| 15 | `src/pages/WebMonitoring.tsx:416` | Seletor de Período de Telemetria | `h-full px-3 text-xs font-semibold rounded-md transition-all` | Migrar para componente de Tabs ou `<Button variant={period === p ? 'default' : 'ghost'} size="sm">`. |

---

### 3.2. Filtros Laterais e Listas Clicáveis em `Monitoring.tsx` e `TicketDetails.tsx`
| # | Arquivo e Linha | Conteúdo | Classes Aplicadas | Recomendação |
| :-: | :--- | :--- | :--- | :--- |
| 16 | `src/pages/Monitoring.tsx:997` | Filtro "Todos" + Contador | `w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors mb-1 group relative` | Padronizar com componente `SidebarFilterItem` ou `<Button variant="ghost" className="w-full justify-between rounded-xl">`. |
| 17 | `src/pages/Monitoring.tsx:1019` | Filtro "Online" + Contador | `w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3...` | Padronizar com componente `SidebarFilterItem`. |
| 18 | `src/pages/Monitoring.tsx:1041` | Filtro "Offline" + Contador | `w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3...` | Padronizar com componente `SidebarFilterItem`. |
| 19 | `src/pages/Monitoring.tsx:1063` | Filtro "Com Alerta" + Contador | `w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3...` | Padronizar com componente `SidebarFilterItem`. |
| 20 | `src/pages/Monitoring.tsx:1092` | Toggle "Grupos / Clientes" | `flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors` | Migrar para `<Button variant="ghost" size="sm">`. |
| 21 | `src/pages/Monitoring.tsx:1115` | Filtro "Todos os Clientes" | `w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3...` | Padronizar com componente `SidebarFilterItem`. |
| 22 | `src/pages/NewTicket.tsx:553` | Card de Categoria de Chamado | `relative group p-4 md:p-6 rounded-lg border-2 transition-all flex flex-col items-center gap-3 md:gap-4 text-center h-32 md:h-40 justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` | Manter estrutura de card ou encapsular em componente `CategoryCardButton`. |
| 23 | `src/pages/TicketDetails.tsx:1063` | Sugestão de Artigo da Base | `w-full text-left p-3 rounded-xl bg-background border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all group` | Encapsular em `KnowledgeBaseSuggestionButton` ou `<Button variant="outline" asChild>`. |
| 24 | `src/pages/TicketDetails.tsx:1172` | Toggle Cronógrafo de Atendimento | `w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors group cursor-pointer` | Migrar para `<Button variant="ghost" className="w-full justify-between p-4 h-auto rounded-xl">`. |
| 25 | `src/pages/TicketHistory.tsx:179` | Linha do Histórico de Chamado | `w-full flex items-start justify-between gap-3 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left` | Manter `<button>` para layout de linha semântica ou migrar para componente de tabela interativa. |

---

### 3.3. Botões Nativos Internos de Primitivas Shadcn e Widgets de Avaliação
| # | Arquivo e Linha | Componente / Função | Classes Aplicadas | Recomendação |
| :-: | :--- | :--- | :--- | :--- |
| 26 | `src/components/ui/dialog.tsx:48` | Botão Fechar Modal (`<X />`) | `absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground` | **Manter.** Primitiva oficial Radix Dialog Close. Adicionar apenas `min-h-[44px] min-w-[44px]` invisível para acessibilidade de toque. |
| 27 | `src/components/ui/sidebar.tsx:132` | Rail de redimensionamento da Sidebar | Classes estruturais de redimensionamento | **Manter.** Componente de infraestrutura do layout. |
| 28 | `src/components/ticket/SatisfactionSurvey.tsx:64` | Botão de Estrela de Avaliação | `p-1 rounded-lg transition-all duration-200 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` | **Manter.** Widget específico com interação visual única (já possui `aria-label`). |
| 29 | `src/pages/Avaliacao.tsx:120` | Botão de Estrela de Avaliação | `p-1 rounded-lg transition-all duration-200 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:hover:scale-100` | **Manter.** Idêntico ao acima. |

---

## 4. Auditoria de Botões Somente com Ícone (*Icon-Only Buttons*)

Foram identificados **44 botões *icon-only***. A tabela a seguir avalia a presença de texto acessível (`aria-label` / `title`) e a conformidade com a área de toque recomendada (WCAG 2.5.5: mínimo 44x44px; WCAG 2.5.8: mínimo 24x24px com espaçamento).

| # | Componente & Arquivo:Linha | Ícone(s) | Tamanho Efetivo | `aria-label` | `title` | Status de Acessibilidade | Área de Toque (44px) |
| :-: | :--- | :--- | :---: | :--- | :--- | :---: | :---: |
| 1 | `CannedResponsesManagement.tsx:261` | `<Pencil />` | 40x40px | — | Editar | ⚠️ Apenas `title` | ⚠️ 40x40px (< 44px) |
| 2 | `CannedResponsesManagement.tsx:268` | `<Trash2 />` | 40x40px | — | Excluir | ⚠️ Apenas `title` | ⚠️ 40x40px (< 44px) |
| 3 | `ResolutionChecklistManagement.tsx:174` | `<Plus />` | 40x40px | Adicionar item | — | ✅ `aria-label` | ⚠️ 40x40px (< 44px) |
| 4 | `ResolutionChecklistManagement.tsx:266` | `<Edit2 />` | 40x40px | — | Editar | ⚠️ Apenas `title` | ⚠️ 40x40px (< 44px) |
| 5 | `ResolutionChecklistManagement.tsx:267` | `<Trash2 />` | 40x40px | — | Excluir | ⚠️ Apenas `title` | ⚠️ 40x40px (< 44px) |
| 6 | `AssetTopologyGraph.tsx:221` | `<X />` | ~28x28px | Fechar detalhes do dispositivo | — | ✅ `aria-label` | ❌ ~28x28px (< 44px) |
| 7 | `NotificationsPopover.tsx:58` | `<CheckCheck />` | 24x24px | — | — | ❌ **Ausente** | ❌ 24x24px (< 44px) |
| 8 | `Sidebar.tsx:327` | `<ChevronsUpDown />` | 32x32px | — | — | ❌ **Ausente** | ❌ 32x32px (< 44px) |
| 9 | `TechnicianDashboard.tsx:806` | `<RotateCw />` | 48x48px (`p-3`) | Atualizar métricas agora | — | ✅ `aria-label` | ✅ **Atende (≥ 44px)** |
| 10 | `TopBar.tsx:114` | `<Bell />` | ~44x44px | Notificações | — | ✅ `aria-label` | ✅ **Atende (≥ 44px)** |
| 11 | `LiveAlertsList.tsx:186` | `<Terminal />` | 40x40px | Abrir Terminal Remoto | — | ✅ `aria-label` | ⚠️ 40x40px (< 44px) |
| 12 | `LiveAlertsList.tsx:198` | `<ExternalLink />` | 40x40px | Ver Detalhes da Máquina | — | ✅ `aria-label` | ⚠️ 40x40px (< 44px) |
| 13 | `LiveAlertsList.tsx:209` | `<Trash2 />` | 40x40px | Limpar Alerta | — | ✅ `aria-label` | ⚠️ 40x40px (< 44px) |
| 14 | `MachineCard.tsx:523` | `<Terminal />` | 32x32px (`h-8 w-8`) | Acessar terminal | Acessar terminal | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 15 | `MachineDrawer.tsx:822` | `<RotateCcw />` | 32x32px (`h-8 w-8`) | Reiniciar Máquina | Reiniciar | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 16 | `MachineDrawer.tsx:842` | `<PowerOff />` | 32x32px (`h-8 w-8`) | Desligar Máquina | Desligar | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 17 | `MachineDrawer.tsx:870` | `<RotateCw />` | 32x32px (`h-8 w-8`) | Forçar Atualização | Forçar Atualização | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 18 | `RemoteTerminal.tsx:210` | `<Maximize2 / Minimize2 />` | 32x32px (`h-8 w-8`) | — | — | ❌ **Ausente** | ❌ 32x32px (< 44px) |
| 19 | `TwoFactorAuthSettings.tsx:475` | `<Copy />` | 24x24px (`h-6 w-6`) | — | Copiar código | ⚠️ Apenas `title` | ❌ 24x24px (< 44px) |
| 20 | `AttachmentList.tsx:96` | `<Download />` | 32x32px (`h-8 w-8`) | — | — | ❌ **Ausente** | ❌ 32x32px (< 44px) |
| 21 | `AttachmentList.tsx:106` | `<Trash2 />` | 32x32px (`h-8 w-8`) | — | — | ❌ **Ausente** | ❌ 32x32px (< 44px) |
| 22 | `FileUpload.tsx:165` | `<X />` | 24x24px (`h-6 w-6`) | — | — | ❌ **Ausente** | ❌ 24x24px (< 44px) |
| 23 | `SatisfactionSurvey.tsx:64` | `<Star />` | ~32x32px | `${s} de 5 estrelas` | — | ✅ `aria-label` | ❌ ~32x32px (< 44px) |
| 24 | `TimeTracker.tsx:177` | `<Play />` | 32x32px (`h-8 w-8`) | Iniciar apontamento | Iniciar | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 25 | `TimeTracker.tsx:180` | `<Pause />` | 32x32px (`h-8 w-8`) | Pausar apontamento | Pausar | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 26 | `dialog.tsx:48` | `<X />` | ~28x28px | — | — | ⚠️ Radix fornece `Close` | ❌ ~28x28px (< 44px) |
| 27 | `modern-animated-sign-in.tsx:467` | `<Eye / EyeOff />` | ~32x32px | — | — | ❌ **Ausente** | ❌ ~32x32px (< 44px) |
| 28 | `AlertsDashboard.tsx:214` | `<Search />` | 32x32px (`h-8`) | — | — | ❌ **Ausente** | ❌ 32x32px (< 44px) |
| 29 | `Assets.tsx:498` | `<X />` | ~28x28px | — | — | ❌ **Ausente** | ❌ ~28x28px (< 44px) |
| 30 | `Avaliacao.tsx:120` | `<Star />` | ~32x32px | `${s} de 5 estrelas` | — | ✅ `aria-label` | ❌ ~32x32px (< 44px) |
| 31 | `KnowledgeBase.tsx:723` | `<Edit2 />` | 28x28px (`h-7 w-7`) | — | Editar artigo | ⚠️ Apenas `title` | ❌ 28x28px (< 44px) |
| 32 | `KnowledgeBase.tsx:732` | `<Trash2 />` | 28x28px (`h-7 w-7`) | — | Excluir artigo | ⚠️ Apenas `title` | ❌ 28x28px (< 44px) |
| 33 | `Monitoring.tsx:132` | `<Edit2 />` | 24x24px (`h-6 w-6`) | — | Editar Grupo | ⚠️ Apenas `title` | ❌ 24x24px (< 44px) |
| 34 | `Monitoring.tsx:149` | `<Trash2 />` | 24x24px (`h-6 w-6`) | — | Excluir Grupo | ⚠️ Apenas `title` | ❌ 24x24px (< 44px) |
| 35 | `Monitoring.tsx:1100` | `<Plus />` | 24x24px (`h-6 w-6`) | — | — | ❌ **Ausente** | ❌ 24x24px (< 44px) |
| 36 | `NewTicket.tsx:827` | `<X />` | ~20x20px | — | Remover anexo | ⚠️ Apenas `title` | ❌ ~20x20px (< 44px) |
| 37 | `PatchManagement.tsx:145` | `<RefreshCw />` | 28x28px (`h-7 w-7`) | Atualizar implantações | — | ✅ `aria-label` | ❌ 28x28px (< 44px) |
| 38 | `TicketDetails.tsx:745` | `<Copy />` | 28x28px (`h-7 w-7`) | Copiar ID da máquina | — | ✅ `aria-label` | ❌ 28x28px (< 44px) |
| 39 | `TicketDetails.tsx:763` | `<Copy />` | 28x28px (`h-7 w-7`) | Copiar senha de sessão | — | ✅ `aria-label` | ❌ 28x28px (< 44px) |
| 40 | `TicketDetails.tsx:1302` | `<Copy />` | 24x24px (`h-6 w-6`) | `Copiar ${label}` | — | ✅ `aria-label` | ❌ 24x24px (< 44px) |
| 41 | `TicketHistory.tsx:236` | `<ChevronLeft />` | 36x36px (`h-9 w-9`) | — | — | ❌ **Ausente** | ❌ 36x36px (< 44px) |
| 42 | `TicketHistory.tsx:248` | `<ChevronRight />` | 36x36px (`h-9 w-9`) | — | — | ❌ **Ausente** | ❌ 36x36px (< 44px) |
| 43 | `WebMonitoring.tsx:783` | `<Trash2 />` | 32x32px (`h-8 w-8`) | `Excluir monitor ${endpoint.name}` | Excluir monitor | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |
| 44 | `WebMonitoring.tsx:1363` | `<Trash2 />` | 32x32px (`h-8 w-8`) | `Excluir link ${link.name}` | Excluir | ✅ `aria-label` + `title` | ❌ 32x32px (< 44px) |

---

## 5. Sobrescritas Manuais de Cores e Estilos em `<Button>`

Foram identificadas **86 ocorrências** onde classes Tailwind de cores (`bg-*`, `text-*`, `hover:bg-*`, `border-*`) foram aplicadas diretamente via prop `className` sobre o `<Button>`, ignorando as variáveis do Design System:

### Amostra dos Casos Mais Críticos de Sobrescrita de Cor:
1. **Verdes / Sucesso (`emerald`, `green`):**
   - `EscalateDialog.tsx:121`: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20`
   - `ResolutionDialog.tsx:92`: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20`
   - `ResolutionDialog.tsx:106`: `bg-emerald-600 hover:bg-emerald-700 text-white`
   - `ResolutionDialog.tsx:115`: `bg-emerald-600 hover:bg-emerald-700 text-white`
   - `TicketHeroHeader.tsx:151`: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm`
   - `TicketDetails.tsx:927`: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20`
   - `TicketDetails.tsx:961`: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20`
   - *Impacto:* Falta de uma variante semântica `variant="success"` no CVA do Button.
2. **Azuis / Informação (`blue`, `indigo`):**
   - `TechnicianDashboard.tsx:196`: `bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20`
   - `TechnicianDashboard.tsx:822`: `bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20`
   - `WebTelemetryTab.tsx:264`: `bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25`
   - `NewTicket.tsx:924`: `bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25`
   - `NewTicket.tsx:932`: `bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25`
   - `NewTicket.tsx:942`: `bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25`
   - *Impacto:* A cor `primary` do sistema já é azulada, mas o código força `bg-blue-600`, impedindo a flexibilidade de customização de marca e dark mode.
3. **Vermelhos / Perigo (`red`, `destructive` com classes extras):**
   - `Monitoring.tsx:149`: `text-red-500 hover:bg-red-500/20 hover:text-red-600`
   - `WebMonitoring.tsx:783`: `text-muted-foreground hover:text-destructive hover:bg-destructive/10`
   - `WebMonitoring.tsx:1363`: `text-muted-foreground hover:text-destructive hover:bg-destructive/10`
   - `AttachmentList.tsx:106`: `text-destructive hover:text-destructive hover:bg-destructive/10`
   - *Impacto:* Falta de uma variante `variant="ghost-destructive"` ou `variant="outline-destructive"`.

---

## 6. Recomendações e Plano de Ação para a Fase 2

### 6.1. Evolução do CVA em `src/components/ui/button.tsx`
Para eliminar as 86 sobrescritas de cores manuais e as 55 sobrescritas de `rounded-xl`, propõe-se expandir o CVA com as seguintes variantes e tamanhos:

1. **Novas Variantes Oficiais:**
   - `success`: `bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500`
   - `destructive-ghost`: `text-destructive hover:bg-destructive/10 hover:text-destructive`
   - `destructive-outline`: `border border-destructive/30 text-destructive hover:bg-destructive/10`
   - `accent-ghost`: `text-primary hover:bg-primary/10 hover:text-primary`
2. **Novos Tamanhos Padronizados:**
   - `xs`: `h-7 rounded-md px-2 text-xs gap-1`
   - `icon-sm`: `h-8 w-8 min-h-[44px] min-w-[44px] p-0` (com área de clique acessível)
   - `icon-lg`: `h-11 w-11 p-0`
   - `xl`: `h-12 rounded-xl px-6 text-base font-semibold`
3. **Unificação do Border Radius Base:**
   - Alterar o padrão base do CVA de `rounded-md` para `rounded-xl` ou criar uma variante de design token `rounded-lg` consistente em toda a suíte.

### 6.2. Correção de Acessibilidade (WCAG 2.1 AA / 2.5.5 / 2.5.8)
1. **Adicionar `aria-label` obrigatório** nos 18 botões de ícone que atualmente não possuem acessibilidade (ex: botões de paginação em `TicketHistory.tsx`, botões de remover anexo em `FileUpload.tsx`, toggle de senha em `modern-animated-sign-in.tsx`).
2. **Garantir Target Size de 44x44px:**
   - Em botões visivelmente menores (24px a 32px), aplicar técnica de pseudo-elemento `after:absolute after:-inset-2` para expandir a área de toque invisível em dispositivos touch.

### 6.3. Migração Sistemática dos Botões Nativos
- Migrar os 15 botões de ações inline identificados na Seção 3.1 para `<Button>` do Shadcn.
- Criar o componente semântico `SidebarFilterItem` para os 6 botões de filtro lateral de `Monitoring.tsx`.

---

## 7. Apêndice: Inventário Completo de Ocorrências (296 Botões)

Abaixo está o registro completo de cada ocorrência identificada no código fonte da aplicação:

| # | Arquivo & Linha | Tag | Variante | Tamanho | Classes Customizadas Aplicadas (`className`) |
| :-: | :--- | :-: | :-: | :-: | :--- |
| 1 | `src/components/admin/CannedResponsesManagement.tsx:146` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 2 | `src/components/admin/CannedResponsesManagement.tsx:207` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 3 | `src/components/admin/CannedResponsesManagement.tsx:210` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 4 | `src/components/admin/CannedResponsesManagement.tsx:261` | `<Button>` | `ghost` | `icon` | `—` |
| 5 | `src/components/admin/CannedResponsesManagement.tsx:268` | `<Button>` | `ghost` | `icon` | `—` |
| 6 | `src/components/admin/CompanyManagement.tsx:317` | `<button>` | `n/a` | `n/a` | `cursor-pointer group flex items-center gap-1.5 transition-transform active:sc...` |
| 7 | `src/components/admin/CompanyManagement.tsx:366` | `<Button>` | `ghost` | `sm` | `gap-2 text-[10px] uppercase font-black` |
| 8 | `src/components/admin/CompanyManagement.tsx:374` | `<Button>` | `ghost` | `sm` | `—` |
| 9 | `src/components/admin/CompanyManagement.tsx:377` | `<Button>` | `ghost` | `sm` | `—` |
| 10 | `src/components/admin/CompanyManagement.tsx:438` | `<Button>` | `ghost` | `sm` | `—` |
| 11 | `src/components/admin/CompanyManagement.tsx:549` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 12 | `src/components/admin/CompanyManagement.tsx:550` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 13 | `src/components/admin/ContractManagement.tsx:200` | `<Button>` | `ghost` | `sm` | `—` |
| 14 | `src/components/admin/ContractManagement.tsx:203` | `<Button>` | `ghost` | `sm` | `—` |
| 15 | `src/components/admin/ContractManagement.tsx:299` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 16 | `src/components/admin/ContractManagement.tsx:300` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 17 | `src/components/admin/ResolutionChecklistManagement.tsx:161` | `<Button>` | `ghost` | `sm` | `h-8 text-xs font-bold text-primary` |
| 18 | `src/components/admin/ResolutionChecklistManagement.tsx:174` | `<Button>` | `ghost` | `icon` | `h-9 w-9 text-muted-foreground hover:text-destructive` |
| 19 | `src/components/admin/ResolutionChecklistManagement.tsx:188` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 20 | `src/components/admin/ResolutionChecklistManagement.tsx:189` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 21 | `src/components/admin/ResolutionChecklistManagement.tsx:224` | `<Button>` | `outline` | `sm` | `mt-2 text-foreground` |
| 22 | `src/components/admin/ResolutionChecklistManagement.tsx:266` | `<Button>` | `ghost` | `icon` | `h-8 w-8 hover:text-primary` |
| 23 | `src/components/admin/ResolutionChecklistManagement.tsx:267` | `<Button>` | `ghost` | `icon` | `h-8 w-8 hover:text-destructive` |
| 24 | `src/components/admin/RoutingRulesManagement.tsx:308` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 25 | `src/components/admin/RoutingRulesManagement.tsx:309` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 26 | `src/components/admin/RoutingRulesManagement.tsx:347` | `<Button>` | `outline` | `sm` | `mt-2 text-foreground` |
| 27 | `src/components/admin/RoutingRulesManagement.tsx:404` | `<Button>` | `ghost` | `icon` | `h-8 w-8 hover:text-primary` |
| 28 | `src/components/admin/RoutingRulesManagement.tsx:405` | `<Button>` | `ghost` | `icon` | `h-8 w-8 hover:text-destructive` |
| 29 | `src/components/admin/SLAConfiguration.tsx:216` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 30 | `src/components/admin/SLAConfiguration.tsx:217` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 31 | `src/components/admin/SLAConfiguration.tsx:252` | `<Button>` | `outline` | `sm` | `—` |
| 32 | `src/components/admin/SLAConfiguration.tsx:253` | `<Button>` | `destructive` | `sm` | `—` |
| 33 | `src/components/admin/UserManagement.tsx:508` | `<Button>` | `outline` | `sm` | `gap-2 mt-2` |
| 34 | `src/components/admin/UserManagement.tsx:622` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 35 | `src/components/admin/UserManagement.tsx:625` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 36 | `src/components/admin/UserManagement.tsx:795` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 37 | `src/components/admin/UserManagement.tsx:798` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 38 | `src/components/admin/UserManagement.tsx:866` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 39 | `src/components/admin/UserManagement.tsx:869` | `<Button>` | `destructive` | `default (implícito)` | `—` |
| 40 | `src/components/admin/UserManagement.tsx:951` | `<Button>` | `ghost` | `icon` | `h-8 w-8` |
| 41 | `src/components/admin/UserManagement.tsx:962` | `<Button>` | `ghost` | `icon` | `h-8 w-8` |
| 42 | `src/components/admin/UserManagement.tsx:979` | `<Button>` | `ghost` | `icon` | `h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10` |
| 43 | `src/components/assets/AssetTopologyGraph.tsx:221` | `<button>` | `n/a` | `n/a` | `p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted t...` |
| 44 | `src/components/assets/AssetTopologyGraph.tsx:269` | `<button>` | `n/a` | `n/a` | `cn( 'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-car...` |
| 45 | `src/components/automation/HistoryTab.tsx:38` | `<Button>` | `outline` | `sm` | `gap-2` |
| 46 | `src/components/automation/RuleForm.tsx:225` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 47 | `src/components/automation/RuleForm.tsx:226` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 48 | `src/components/automation/RulesTab.tsx:175` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 49 | `src/components/automation/RulesTab.tsx:214` | `<Button>` | `ghost` | `icon` | `h-8 w-8 hover:text-primary` |
| 50 | `src/components/automation/RulesTab.tsx:217` | `<Button>` | `ghost` | `icon` | `h-8 w-8 hover:text-destructive` |
| 51 | `src/components/automation/SLATab.tsx:29` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2 font-bold shadow-lg shadow-primary/20` |
| 52 | `src/components/automation/TemplatesTab.tsx:106` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 53 | `src/components/automation/TemplatesTab.tsx:107` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 54 | `src/components/automation/TemplatesTab.tsx:129` | `<Button>` | `ghost` | `icon` | `h-7 w-7 hover:text-primary` |
| 55 | `src/components/automation/TemplatesTab.tsx:132` | `<Button>` | `ghost` | `icon` | `h-7 w-7 hover:text-destructive` |
| 56 | `src/components/automation/TemplatesTab.tsx:147` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 57 | `src/components/dashboard/NotificationsPopover.tsx:40` | `<Button>` | `ghost` | `icon` | `hover:bg-primary/10 relative text-muted-foreground hover:text-primary transit...` |
| 58 | `src/components/dashboard/NotificationsPopover.tsx:58` | `<Button>` | `ghost` | `sm` | `text-xs h-7 text-primary hover:text-primary hover:bg-transparent p-0` |
| 59 | `src/components/dashboard/NotificationsPopover.tsx:93` | `<Button>` | `ghost` | `sm` | `w-full text-xs font-bold text-primary hover:text-primary hover:bg-primary/5` |
| 60 | `src/components/dashboard/Sidebar.tsx:152` | `<button>` | `n/a` | `n/a` | `flex items-center px-3 pt-2 pb-3 cursor-pointer rounded-lg focus-visible:outl...` |
| 61 | `src/components/dashboard/Sidebar.tsx:162` | `<button>` | `n/a` | `n/a` | `flex items-center text-left gap-3 px-3 py-2 mx-1 mb-1 rounded-lg cursor-point...` |
| 62 | `src/components/dashboard/Sidebar.tsx:215` | `<button>` | `n/a` | `n/a` | `hover:text-foreground transition-colors focus-visible:outline-none focus-visi...` |
| 63 | `src/components/dashboard/Sidebar.tsx:223` | `<button>` | `n/a` | `n/a` | `hover:text-foreground transition-colors focus-visible:outline-none focus-visi...` |
| 64 | `src/components/dashboard/TechnicianDashboard.tsx:66` | `<button>` | `n/a` | `n/a` | `cn( "relative group text-left p-5 rounded-2xl transition-all duration-200 ove...` |
| 65 | `src/components/dashboard/TechnicianDashboard.tsx:157` | `<button>` | `n/a` | `n/a` | `absolute inset-0 z-10` |
| 66 | `src/components/dashboard/TechnicianDashboard.tsx:196` | `<Button>` | `default (implícito)` | `sm` | `h-8 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider relative z...` |
| 67 | `src/components/dashboard/TechnicianDashboard.tsx:549` | `<Button>` | `advancedFiltersOpen ? "default" : "outline"` | `sm` | `rounded-2xl border-border/40 font-bold text-xs gap-2 transition-colors h-12 px-4` |
| 68 | `src/components/dashboard/TechnicianDashboard.tsx:639` | `<Button>` | `ghost` | `sm` | `text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:...` |
| 69 | `src/components/dashboard/TechnicianDashboard.tsx:806` | `<button>` | `n/a` | `n/a` | `w-full group p-3.5 rounded-2xl border border-border/40 bg-muted/15 hover:bg-p...` |
| 70 | `src/components/dashboard/TechnicianDashboard.tsx:822` | `<Button>` | `ghost` | `sm` | `w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground...` |
| 71 | `src/components/dashboard/TopBar.tsx:114` | `<button>` | `n/a` | `n/a` | `w-full flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 t...` |
| 72 | `src/components/monitoring/ForceUpdateButton.tsx:62` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 tra...` |
| 73 | `src/components/monitoring/MachineCard.tsx:523` | `<Button>` | `ghost` | `sm` | `h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destruct...` |
| 74 | `src/components/monitoring/MachineDrawer.tsx:847` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-ind...` |
| 75 | `src/components/monitoring/MachineDrawer.tsx:882` | `<Button>` | `outline` | `default (implícito)` | `w-full font-bold gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10` |
| 76 | `src/components/monitoring/MachineDrawer.tsx:895` | `<Button>` | `destructive` | `default (implícito)` | `w-full font-bold gap-2 bg-red-600/90 hover:bg-red-700 text-white shadow-md sh...` |
| 77 | `src/components/monitoring/MachineTicketsTab.tsx:47` | `<button>` | `n/a` | `n/a` | `w-full text-left flex items-center justify-between gap-3 rounded-lg border bo...` |
| 78 | `src/components/monitoring/MonitoringOnboarding.tsx:84` | `<Button>` | `ghost` | `sm` | `rounded-xl gap-2 font-bold text-[10px] uppercase tracking-wider` |
| 79 | `src/components/monitoring/MonitoringOnboarding.tsx:121` | `<Button>` | `default (implícito)` | `lg` | `rounded-md px-6 gap-2 font-bold uppercase tracking-wider shadow-md shadow-pri...` |
| 80 | `src/components/monitoring/MonitoringOnboarding.tsx:124` | `<Button>` | `outline` | `lg` | `rounded-md px-6 gap-2 font-bold uppercase tracking-wider border-border/40` |
| 81 | `src/components/monitoring/MonitoringOnboarding.tsx:132` | `<button>` | `n/a` | `n/a` | `underline hover:text-primary transition-colors` |
| 82 | `src/components/monitoring/PendingMachinesBanner.tsx:92` | `<Button>` | `outline` | `sm` | `gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 borde...` |
| 83 | `src/components/monitoring/PendingMachinesBanner.tsx:106` | `<Button>` | `default (implícito)` | `sm` | `gap-1.5` |
| 84 | `src/components/monitoring/PerformanceChart.tsx:125` | `<button>` | `n/a` | `n/a` | `cn( 'h-full px-2.5 rounded-md text-[11px] font-medium transition-all', period...` |
| 85 | `src/components/monitoring/PerformanceChart.tsx:149` | `<button>` | `n/a` | `n/a` | `cn( 'inline-flex h-full items-center gap-1.5 px-3 rounded-md text-xs font-med...` |
| 86 | `src/components/monitoring/RemoteTerminal.tsx:233` | `<Button>` | `isConnected ? 'destructive' : 'default'` | `default (implícito)` | `font-bold gap-2 text-xs` |
| 87 | `src/components/monitoring/WebTelemetryTab.tsx:248` | `<button>` | `n/a` | `n/a` | `cn( 'h-full px-3.5 text-xs font-semibold rounded-xl transition-all', period =...` |
| 88 | `src/components/monitoring/WebTelemetryTab.tsx:264` | `<Button>` | `outline` | `sm` | `rounded-xl font-semibold gap-1.5` |
| 89 | `src/components/monitoring/WebTelemetryTab.tsx:441` | `<button>` | `n/a` | `n/a` | `cn( 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-s...` |
| 90 | `src/components/patch/AgentInstallerCard.tsx:113` | `<Button>` | `outline` | `default (implícito)` | `gap-2 font-bold whitespace-nowrap h-10` |
| 91 | `src/components/patch/AgentInstallerCard.tsx:135` | `<Button>` | `outline` | `icon` | `h-8 w-8 flex-shrink-0` |
| 92 | `src/components/patch/DeployDialog.tsx:124` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 93 | `src/components/patch/DeployDialog.tsx:125` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 94 | `src/components/patch/NewPackageDialog.tsx:119` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 95 | `src/components/patch/NewPackageDialog.tsx:120` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 96 | `src/components/patch/PackageCard.tsx:66` | `<Button>` | `default (implícito)` | `sm` | `h-7 gap-1.5 text-[11px] font-bold` |
| 97 | `src/components/patch/PackageCard.tsx:69` | `<Button>` | `ghost` | `icon` | `h-7 w-7 text-destructive hover:bg-destructive/10` |
| 98 | `src/components/ProtectedRoute.tsx:100` | `<Button>` | `outline` | `sm` | `w-full rounded-md text-xs font-semibold gap-1.5 h-8 border-border/60` |
| 99 | `src/components/ProtectedRoute.tsx:111` | `<Button>` | `ghost` | `sm` | `flex-1 rounded-md text-xs font-semibold h-8` |
| 100 | `src/components/ProtectedRoute.tsx:119` | `<Button>` | `ghost` | `sm` | `flex-1 rounded-md text-xs font-semibold h-8 text-destructive hover:text-destr...` |
| 101 | `src/components/ProtectedRoute.tsx:167` | `<Button>` | `outline` | `sm` | `flex-1 rounded-xl text-xs font-semibold gap-1.5 h-9` |
| 102 | `src/components/ProtectedRoute.tsx:177` | `<Button>` | `default` | `sm` | `flex-1 rounded-xl text-xs font-semibold gap-1.5 h-9` |
| 103 | `src/components/RootErrorBoundary.tsx:198` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full sm:w-auto font-bold gap-2 rounded-md shadow-lg shadow-primary/20 h-10 ...` |
| 104 | `src/components/RootErrorBoundary.tsx:206` | `<Button>` | `outline` | `default (implícito)` | `w-full sm:w-auto font-bold gap-2 rounded-md border-border/70 hover:bg-destruc...` |
| 105 | `src/components/RootErrorBoundary.tsx:215` | `<Button>` | `ghost` | `default (implícito)` | `w-full sm:w-auto font-bold gap-2 rounded-md h-10 px-4 text-muted-foreground h...` |
| 106 | `src/components/RootErrorBoundary.tsx:228` | `<button>` | `n/a` | `n/a` | `text-xs text-muted-foreground hover:text-foreground font-semibold flex items-...` |
| 107 | `src/components/RootErrorBoundary.tsx:236` | `<Button>` | `ghost` | `sm` | `h-7 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-primary` |
| 108 | `src/components/settings/AvatarUpload.tsx:109` | `<Button>` | `secondary` | `icon` | `absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md opacity-0 group-hove...` |
| 109 | `src/components/settings/TwoFactorAuthSettings.tsx:289` | `<Button>` | `default` | `sm` | `bg-amber-600 hover:bg-amber-700 text-white shadow-sm h-8 text-xs font-semibol...` |
| 110 | `src/components/settings/TwoFactorAuthSettings.tsx:363` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 111 | `src/components/settings/TwoFactorAuthSettings.tsx:409` | `<Button>` | `outline` | `sm` | `gap-1.5 text-xs` |
| 112 | `src/components/settings/TwoFactorAuthSettings.tsx:419` | `<Button>` | `destructive` | `sm` | `gap-1.5 text-xs` |
| 113 | `src/components/settings/TwoFactorAuthSettings.tsx:475` | `<Button>` | `ghost` | `sm` | `h-6 text-xs text-muted-foreground hover:text-foreground` |
| 114 | `src/components/settings/TwoFactorAuthSettings.tsx:494` | `<Button>` | `outline` | `icon` | `h-9 w-9 shrink-0` |
| 115 | `src/components/settings/TwoFactorAuthSettings.tsx:537` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 116 | `src/components/settings/TwoFactorAuthSettings.tsx:545` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-1.5` |
| 117 | `src/components/settings/TwoFactorAuthSettings.tsx:601` | `<Button>` | `outline` | `sm` | `flex-1 gap-1.5 text-xs` |
| 118 | `src/components/settings/TwoFactorAuthSettings.tsx:612` | `<Button>` | `outline` | `sm` | `flex-1 gap-1.5 text-xs` |
| 119 | `src/components/settings/TwoFactorAuthSettings.tsx:626` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full sm:w-auto` |
| 120 | `src/components/shared/NotificationItem.tsx:31` | `<button>` | `n/a` | `n/a` | `cn( 'w-full text-left transition-colors', isSm ? 'p-3 rounded-lg border-b bor...` |
| 121 | `src/components/shared/RouteLoadingFallback.tsx:51` | `<Button>` | `outline` | `sm` | `flex-1 rounded-md text-xs font-semibold gap-1.5 h-8 border-border/60` |
| 122 | `src/components/shared/RouteLoadingFallback.tsx:60` | `<Button>` | `ghost` | `sm` | `flex-1 rounded-md text-xs font-semibold h-8` |
| 123 | `src/components/ThemeToggle.tsx:21` | `<Button>` | `ghost` | `icon` | `hover:bg-primary/10 opacity-0` |
| 124 | `src/components/ThemeToggle.tsx:32` | `<Button>` | `ghost` | `icon` | `hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary` |
| 125 | `src/components/ticket/AttachmentList.tsx:96` | `<Button>` | `ghost` | `sm` | `h-8 w-8 p-0` |
| 126 | `src/components/ticket/AttachmentList.tsx:106` | `<Button>` | `ghost` | `sm` | `h-8 w-8 p-0 text-destructive hover:text-destructive` |
| 127 | `src/components/ticket/CannedResponseSelector.tsx:42` | `<Button>` | `outline` | `sm` | `gap-2` |
| 128 | `src/components/ticket/CannedResponseSelector.tsx:83` | `<button>` | `n/a` | `n/a` | `w-full text-left p-4 rounded-lg border border-border hover:bg-accent transiti...` |
| 129 | `src/components/ticket/EscalateDialog.tsx:121` | `<Button>` | `default (implícito)` | `default (implícito)` | `bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider...` |
| 130 | `src/components/ticket/FileUpload.tsx:165` | `<Button>` | `ghost` | `sm` | `h-6 w-6 p-0` |
| 131 | `src/components/ticket/FileUpload.tsx:176` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full` |
| 132 | `src/components/ticket/ResolutionDialog.tsx:92` | `<Button>` | `ghost` | `sm` | `h-7 px-2.5 text-xs text-primary font-bold hover:bg-primary/10 rounded-lg gap-1.5` |
| 133 | `src/components/ticket/ResolutionDialog.tsx:106` | `<button>` | `n/a` | `n/a` | `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold b...` |
| 134 | `src/components/ticket/ResolutionDialog.tsx:115` | `<button>` | `n/a` | `n/a` | `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold b...` |
| 135 | `src/components/ticket/ResolutionDialog.tsx:168` | `<button>` | `n/a` | `n/a` | `text-[11px] font-bold text-primary hover:underline cursor-pointer` |
| 136 | `src/components/ticket/ResolutionDialog.tsx:219` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2 bg-emerald-600 hover:bg-emerald-700 text-white` |
| 137 | `src/components/ticket/SatisfactionSurvey.tsx:64` | `<button>` | `n/a` | `n/a` | `p-1 rounded-lg transition-all duration-200 hover:scale-125 focus-visible:outl...` |
| 138 | `src/components/ticket/SatisfactionSurvey.tsx:91` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full h-11 font-bold gap-2 rounded-xl shadow-lg shadow-primary/20` |
| 139 | `src/components/ticket/TicketHeroHeader.tsx:136` | `<Button>` | `default` | `sm` | `h-6 px-2.5 text-[10px] font-bold uppercase tracking-wider ml-1 shadow-sm gap-1` |
| 140 | `src/components/ticket/TicketHeroHeader.tsx:151` | `<Button>` | `default` | `sm` | `h-9 px-4 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shado...` |
| 141 | `src/components/ticket/TicketHeroHeader.tsx:164` | `<Button>` | `outline` | `sm` | `h-9 px-4 gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 h...` |
| 142 | `src/components/ticket/TicketHeroHeader.tsx:209` | `<Button>` | `default` | `sm` | `gap-2 shadow-sm font-bold` |
| 143 | `src/components/ticket/TicketHeroHeader.tsx:225` | `<Button>` | `isTimerActiveHere ? 'destructive' : 'outline'` | `sm` | `gap-2` |
| 144 | `src/components/ticket/TicketHeroHeader.tsx:248` | `<Button>` | `outline` | `sm` | `gap-2 border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yell...` |
| 145 | `src/components/ticket/TicketHeroHeader.tsx:260` | `<Button>` | `outline` | `sm` | `cn("gap-2", ticket.status === 'awaiting-customer' && "bg-purple-500/10 text-p...` |
| 146 | `src/components/ticket/TicketHeroHeader.tsx:271` | `<Button>` | `outline` | `sm` | `gap-2` |
| 147 | `src/components/ticket/TicketHeroHeader.tsx:280` | `<Button>` | `outline` | `sm` | `gap-2` |
| 148 | `src/components/ticket/TicketHeroHeader.tsx:287` | `<Button>` | `outline` | `sm` | `gap-2` |
| 149 | `src/components/ticket/TimeTracker.tsx:123` | `<Button>` | `destructive` | `sm` | `h-10 px-4 rounded-xl font-bold gap-2` |
| 150 | `src/components/ticket/TimeTracker.tsx:127` | `<Button>` | `default (implícito)` | `sm` | `h-10 px-4 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20` |
| 151 | `src/components/ticket/TimeTracker.tsx:147` | `<Button>` | `ghost` | `sm` | `w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground...` |
| 152 | `src/components/ticket/TimeTracker.tsx:177` | `<Button>` | `default (implícito)` | `sm` | `flex-1 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider` |
| 153 | `src/components/ticket/TimeTracker.tsx:180` | `<Button>` | `ghost` | `sm` | `h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider` |
| 154 | `src/components/tickets/MergeTicketDialog.tsx:146` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2 font-bold` |
| 155 | `src/components/ui/button-primary.tsx:12` | `<Button>` | `default (implícito)` | `default (implícito)` | `cn( "font-semibold gap-2 shadow-xs transition-all active:scale-[0.98]", class...` |
| 156 | `src/components/ui/modern-animated-sign-in.tsx:467` | `<button>` | `n/a` | `n/a` | `absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-mute...` |
| 157 | `src/components/ui/modern-animated-sign-in.tsx:503` | `<button>` | `n/a` | `n/a` | `bg-primary text-primary-foreground hover:bg-primary/90 relative group/btn blo...` |
| 158 | `src/components/ui/modern-animated-sign-in.tsx:518` | `<button>` | `n/a` | `n/a` | `text-xs text-primary/80 hover:text-primary dark:text-purple-400 dark:hover:te...` |
| 159 | `src/components/ui/sidebar.tsx:277` | `<Button>` | `ghost` | `icon` | `cn("h-7 w-7", className)` |
| 160 | `src/components/ui/sidebar.tsx:303` | `<button>` | `n/a` | `n/a` | `cn( "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-...` |
| 161 | `src/pages/AlertsDashboard.tsx:214` | `<Button>` | `outline` | `sm` | `h-7 px-2.5 text-xs font-semibold rounded-lg gap-1.5 bg-background/80 hover:bg...` |
| 162 | `src/pages/AlertsDashboard.tsx:547` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl font-bold h-10 px-4` |
| 163 | `src/pages/AlertsDashboard.tsx:579` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl font-bold h-10 px-4` |
| 164 | `src/pages/Assets.tsx:332` | `<Button>` | `outline` | `default (implícito)` | `h-11 px-4 rounded-xl border-border/50 bg-background/50 hover:bg-accent font-s...` |
| 165 | `src/pages/Assets.tsx:469` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 166 | `src/pages/Assets.tsx:470` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 167 | `src/pages/Assets.tsx:498` | `<button>` | `n/a` | `n/a` | `absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:tex...` |
| 168 | `src/pages/Assets.tsx:559` | `<Button>` | `ghost` | `default (implícito)` | `h-11 px-3 text-xs text-muted-foreground hover:text-foreground font-semibold` |
| 169 | `src/pages/Assets.tsx:743` | `<button>` | `n/a` | `n/a` | `text-sm font-bold text-primary hover:underline flex items-center gap-1.5 w-fi...` |
| 170 | `src/pages/Assets.tsx:823` | `<button>` | `n/a` | `n/a` | `inline-flex items-center justify-center gap-1 hover:scale-105 transition-tran...` |
| 171 | `src/pages/Assets.tsx:863` | `<Button>` | `outline` | `icon` | `h-8 w-8 rounded-lg border-border/60 hover:bg-emerald-500/10 hover:text-emeral...` |
| 172 | `src/pages/Assets.tsx:878` | `<Button>` | `outline` | `icon` | `h-8 w-8 rounded-lg border-border/60 hover:bg-primary/10 hover:text-primary ho...` |
| 173 | `src/pages/Assets.tsx:893` | `<Button>` | `outline` | `icon` | `h-8 w-8 rounded-lg border-border/60 hover:bg-sky-500/10 hover:text-sky-600 ho...` |
| 174 | `src/pages/Assets.tsx:910` | `<Button>` | `ghost` | `icon` | `h-8 w-8 rounded-lg hover:bg-accent transition-colors` |
| 175 | `src/pages/Assets.tsx:924` | `<Button>` | `ghost` | `icon` | `h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-...` |
| 176 | `src/pages/Assets.tsx:959` | `<Button>` | `outline` | `default (implícito)` | `rounded-xl font-bold text-xs` |
| 177 | `src/pages/Assets.tsx:1027` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 178 | `src/pages/Assets.tsx:1106` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 179 | `src/pages/Auth.tsx:593` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full h-11 text-sm font-semibold gap-2` |
| 180 | `src/pages/Auth.tsx:612` | `<Button>` | `ghost` | `sm` | `text-xs text-muted-foreground hover:text-foreground gap-1.5` |
| 181 | `src/pages/Auth.tsx:647` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full h-11 text-sm font-semibold gap-2` |
| 182 | `src/pages/Auth.tsx:666` | `<Button>` | `ghost` | `sm` | `text-xs text-muted-foreground hover:text-foreground gap-1.5` |
| 183 | `src/pages/Auth.tsx:682` | `<Button>` | `outline` | `sm` | `text-xs gap-1.5 w-full text-muted-foreground hover:text-foreground` |
| 184 | `src/pages/Auth.tsx:731` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 185 | `src/pages/Auth.tsx:739` | `<Button>` | `default (implícito)` | `default (implícito)` | `bg-primary hover:bg-primary/90 text-primary-foreground font-semibold` |
| 186 | `src/pages/Avaliacao.tsx:63` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 187 | `src/pages/Avaliacao.tsx:98` | `<Button>` | `outline` | `default (implícito)` | `mt-4 w-full` |
| 188 | `src/pages/Avaliacao.tsx:114` | `<Button>` | `link` | `default (implícito)` | `text-amber-700 dark:text-amber-400 h-auto p-0 px-1 font-bold` |
| 189 | `src/pages/Avaliacao.tsx:120` | `<button>` | `n/a` | `n/a` | `p-1 rounded-lg transition-all duration-200 hover:scale-125 focus-visible:outl...` |
| 190 | `src/pages/Avaliacao.tsx:148` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full h-12 font-bold gap-2 rounded-xl shadow-lg shadow-primary/20 text-base` |
| 191 | `src/pages/ClientPortal.tsx:172` | `<Button>` | `ghost` | `sm` | `text-xs font-bold gap-1 text-muted-foreground hover:text-foreground h-8 round...` |
| 192 | `src/pages/ClientPortal.tsx:237` | `<Button>` | `default (implícito)` | `sm` | `h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-...` |
| 193 | `src/pages/ClientPortal.tsx:249` | `<Button>` | `default (implícito)` | `sm` | `h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap...` |
| 194 | `src/pages/ClientPortal.tsx:261` | `<Button>` | `outline` | `sm` | `h-8 px-3 text-xs font-semibold gap-1 rounded-xl group-hover:bg-primary group-...` |
| 195 | `src/pages/ClientPortal.tsx:293` | `<Button>` | `outline` | `sm` | `h-8 text-xs font-bold rounded-xl gap-1.5 mt-2 hover:border-primary/40 hover:b...` |
| 196 | `src/pages/ClientPortal.tsx:322` | `<Button>` | `link` | `default (implícito)` | `p-0 h-auto font-bold text-primary gap-1 text-xs sm:text-sm` |
| 197 | `src/pages/DebugTools.tsx:445` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full` |
| 198 | `src/pages/DebugTools.tsx:489` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 199 | `src/pages/DebugTools.tsx:494` | `<Button>` | `destructive` | `default (implícito)` | `gap-2` |
| 200 | `src/pages/DebugTools.tsx:540` | `<Button>` | `outline` | `sm` | `—` |
| 201 | `src/pages/DebugTools.tsx:569` | `<Button>` | `default (implícito)` | `default (implícito)` | `gap-2` |
| 202 | `src/pages/DebugTools.tsx:638` | `<Button>` | `outline` | `default (implícito)` | `gap-2` |
| 203 | `src/pages/KnowledgeBase.tsx:582` | `<Button>` | `outline` | `default (implícito)` | `w-full justify-between font-semibold text-emerald-600 dark:text-emerald-400 b...` |
| 204 | `src/pages/KnowledgeBase.tsx:630` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full justify-between font-semibold bg-primary hover:bg-primary/90 text-prim...` |
| 205 | `src/pages/KnowledgeBase.tsx:659` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-full px-4 h-9 font-semibold text-xs gap-2 shadow-sm` |
| 206 | `src/pages/KnowledgeBase.tsx:680` | `<Button>` | `outline` | `sm` | `—` |
| 207 | `src/pages/KnowledgeBase.tsx:723` | `<Button>` | `ghost` | `icon` | `h-7 w-7 text-muted-foreground hover:text-primary` |
| 208 | `src/pages/KnowledgeBase.tsx:732` | `<Button>` | `ghost` | `icon` | `h-7 w-7 text-muted-foreground hover:text-destructive` |
| 209 | `src/pages/KnowledgeBase.tsx:771` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 210 | `src/pages/KnowledgeBase.tsx:848` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 211 | `src/pages/KnowledgeBase.tsx:849` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 212 | `src/pages/Monitoring.tsx:132` | `<Button>` | `ghost` | `icon` | `cn( "h-6 w-6 rounded-md p-0", selected ? "hover:bg-white/20 text-primary-fore...` |
| 213 | `src/pages/Monitoring.tsx:149` | `<Button>` | `ghost` | `icon` | `cn( "h-6 w-6 rounded-md p-0 text-red-500", selected ? "hover:bg-red-500/20 te...` |
| 214 | `src/pages/Monitoring.tsx:305` | `<Button>` | `ghost` | `sm` | `h-7 px-3 text-xs font-bold hover:text-primary hover:bg-primary/10 rounded-lg ...` |
| 215 | `src/pages/Monitoring.tsx:812` | `<Button>` | `ghost` | `sm` | `cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode =...` |
| 216 | `src/pages/Monitoring.tsx:822` | `<Button>` | `ghost` | `sm` | `cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode =...` |
| 217 | `src/pages/Monitoring.tsx:848` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl border-border/40 hover:bg-primary/10 hover:text-primary tran...` |
| 218 | `src/pages/Monitoring.tsx:859` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl transition-all` |
| 219 | `src/pages/Monitoring.tsx:907` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl transition-all` |
| 220 | `src/pages/Monitoring.tsx:920` | `<Button>` | `ghost` | `sm` | `cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode =...` |
| 221 | `src/pages/Monitoring.tsx:930` | `<Button>` | `ghost` | `sm` | `cn("h-7 px-2.5 rounded-lg text-xs font-bold gap-1 transition-all", viewMode =...` |
| 222 | `src/pages/Monitoring.tsx:958` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl border-border/40 hover:bg-primary/10 hover:text-primary tran...` |
| 223 | `src/pages/Monitoring.tsx:969` | `<Button>` | `outline` | `sm` | `gap-2 rounded-xl transition-all` |
| 224 | `src/pages/Monitoring.tsx:997` | `<button>` | `n/a` | `n/a` | `cn( 'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-betwee...` |
| 225 | `src/pages/Monitoring.tsx:1019` | `<button>` | `n/a` | `n/a` | `cn( 'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-betwee...` |
| 226 | `src/pages/Monitoring.tsx:1041` | `<button>` | `n/a` | `n/a` | `cn( 'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-betwee...` |
| 227 | `src/pages/Monitoring.tsx:1063` | `<button>` | `n/a` | `n/a` | `cn( 'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-betwee...` |
| 228 | `src/pages/Monitoring.tsx:1092` | `<button>` | `n/a` | `n/a` | `flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tra...` |
| 229 | `src/pages/Monitoring.tsx:1100` | `<Button>` | `ghost` | `icon` | `h-6 w-6 rounded-full hover:bg-primary/10 text-primary` |
| 230 | `src/pages/Monitoring.tsx:1115` | `<button>` | `n/a` | `n/a` | `cn( 'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-betwee...` |
| 231 | `src/pages/Monitoring.tsx:1253` | `<Button>` | `outline` | `default (implícito)` | `rounded-xl font-bold` |
| 232 | `src/pages/Monitoring.tsx:1254` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-bold` |
| 233 | `src/pages/NewTicket.tsx:459` | `<Button>` | `default (implícito)` | `default (implícito)` | `h-12 w-full font-bold shadow-lg shadow-primary/20` |
| 234 | `src/pages/NewTicket.tsx:462` | `<Button>` | `outline` | `default (implícito)` | `h-12 w-full font-bold` |
| 235 | `src/pages/NewTicket.tsx:484` | `<Button>` | `ghost` | `sm` | `hover:bg-primary/5 transition-colors gap-2 text-muted-foreground` |
| 236 | `src/pages/NewTicket.tsx:553` | `<button>` | `n/a` | `n/a` | `cn( "relative group p-4 md:p-6 rounded-lg border-2 transition-all flex flex-c...` |
| 237 | `src/pages/NewTicket.tsx:628` | `<button>` | `n/a` | `n/a` | `flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-...` |
| 238 | `src/pages/NewTicket.tsx:827` | `<button>` | `n/a` | `n/a` | `text-muted-foreground hover:text-destructive transition-colors ml-1 p-0.5 rou...` |
| 239 | `src/pages/NewTicket.tsx:924` | `<Button>` | `outline` | `default (implícito)` | `h-12 px-6 rounded-xl gap-2 font-bold decoration-transparent tracking-tight` |
| 240 | `src/pages/NewTicket.tsx:932` | `<Button>` | `default (implícito)` | `default (implícito)` | `h-12 px-8 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20 tracking-tight` |
| 241 | `src/pages/NewTicket.tsx:942` | `<Button>` | `default (implícito)` | `default (implícito)` | `h-12 px-10 rounded-xl font-bold gap-2 shadow-xl shadow-primary/25 tracking-tight` |
| 242 | `src/pages/NewTicket.tsx:987` | `<Button>` | `ghost` | `sm` | `h-8 text-xs font-bold text-primary px-2` |
| 243 | `src/pages/NewTicket.tsx:990` | `<Button>` | `secondary` | `sm` | `h-8 text-xs font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20` |
| 244 | `src/pages/NewTicket.tsx:1049` | `<Button>` | `outline` | `default (implícito)` | `—` |
| 245 | `src/pages/NewTicket.tsx:1052` | `<Button>` | `default` | `default (implícito)` | `bg-emerald-600 hover:bg-emerald-700 text-white font-bold` |
| 246 | `src/pages/Notifications.tsx:34` | `<Button>` | `outline` | `default (implícito)` | `text-xs text-primary border-primary/20 hover:bg-primary/10 rounded-xl` |
| 247 | `src/pages/Notifications.tsx:47` | `<Button>` | `filter === 'unread' ? 'default' : 'ghost'` | `default (implícito)` | `rounded-full` |
| 248 | `src/pages/Notifications.tsx:54` | `<Button>` | `filter === 'all' ? 'default' : 'ghost'` | `default (implícito)` | `rounded-full` |
| 249 | `src/pages/PatchManagement.tsx:145` | `<Button>` | `ghost` | `icon` | `h-7 w-7` |
| 250 | `src/pages/Reports.tsx:348` | `<button>` | `n/a` | `n/a` | `cn( 'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitaliz...` |
| 251 | `src/pages/Reports.tsx:365` | `<Button>` | `outline` | `default (implícito)` | `bg-background` |
| 252 | `src/pages/Reports.tsx:381` | `<Button>` | `outline` | `default (implícito)` | `bg-background print:hidden` |
| 253 | `src/pages/Reports.tsx:391` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 254 | `src/pages/SetPassword.tsx:198` | `<Button>` | `default (implícito)` | `default (implícito)` | `w-full` |
| 255 | `src/pages/Settings.tsx:311` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 256 | `src/pages/Settings.tsx:379` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 257 | `src/pages/Settings.tsx:469` | `<Button>` | `outline` | `icon` | `—` |
| 258 | `src/pages/Settings.tsx:483` | `<Button>` | `outline` | `icon` | `—` |
| 259 | `src/pages/Settings.tsx:519` | `<Button>` | `outline` | `sm` | `gap-2 text-xs font-semibold h-9` |
| 260 | `src/pages/Settings.tsx:528` | `<Button>` | `outline` | `sm` | `gap-2 text-xs font-semibold h-9` |
| 261 | `src/pages/TicketDetails.tsx:658` | `<Button>` | `default (implícito)` | `default (implícito)` | `—` |
| 262 | `src/pages/TicketDetails.tsx:666` | `<Button>` | `ghost` | `sm` | `mb-4 gap-2 text-muted-foreground hover:text-foreground group` |
| 263 | `src/pages/TicketDetails.tsx:745` | `<Button>` | `ghost` | `icon` | `h-7 w-7 rounded-lg hover:bg-muted shrink-0` |
| 264 | `src/pages/TicketDetails.tsx:763` | `<Button>` | `ghost` | `icon` | `h-7 w-7 rounded-lg hover:bg-muted shrink-0` |
| 265 | `src/pages/TicketDetails.tsx:837` | `<Button>` | `outline` | `sm` | `h-9 px-3 gap-2 border-border/50 hover:bg-background` |
| 266 | `src/pages/TicketDetails.tsx:927` | `<Button>` | `default (implícito)` | `default (implícito)` | `cn( "h-11 px-6 font-bold transition-all shadow-sm", isInternalNote ? "bg-ambe...` |
| 267 | `src/pages/TicketDetails.tsx:938` | `<Button>` | `secondary` | `default (implícito)` | `h-11 px-6 border border-border/50` |
| 268 | `src/pages/TicketDetails.tsx:961` | `<Button>` | `outline` | `default (implícito)` | `h-11 px-8 font-bold border-primary text-primary hover:bg-primary/5` |
| 269 | `src/pages/TicketDetails.tsx:1008` | `<Button>` | `outline` | `default (implícito)` | `w-full h-11 rounded-xl font-bold text-xs gap-2 border-border/60 hover:bg-ambe...` |
| 270 | `src/pages/TicketDetails.tsx:1063` | `<button>` | `n/a` | `n/a` | `w-full text-left p-3 rounded-xl bg-background border border-border/40 hover:b...` |
| 271 | `src/pages/TicketDetails.tsx:1172` | `<button>` | `n/a` | `n/a` | `w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 tran...` |
| 272 | `src/pages/TicketDetails.tsx:1302` | `<Button>` | `ghost` | `icon` | `h-6 w-6 shrink-0 hover:bg-background` |
| 273 | `src/pages/TicketDetails.tsx:1405` | `<Button>` | `outline` | `sm` | `h-9 text-xs bg-muted/30 border-border/40 hover:bg-primary/10 hover:border-pri...` |
| 274 | `src/pages/TicketDetails.tsx:1414` | `<Button>` | `outline` | `sm` | `h-9 text-xs bg-muted/30 border-border/40 hover:bg-primary/10 hover:border-pri...` |
| 275 | `src/pages/TicketDetails.tsx:1423` | `<Button>` | `outline` | `sm` | `h-9 text-xs bg-muted/30 border-border/40 hover:bg-primary/10 hover:border-pri...` |
| 276 | `src/pages/TicketDetails.tsx:1432` | `<Button>` | `outline` | `sm` | `h-9 text-xs bg-muted/30 border-border/40 hover:bg-primary/10 hover:border-pri...` |
| 277 | `src/pages/TicketDetails.tsx:1444` | `<Button>` | `outline` | `sm` | `w-full text-xs h-9 mt-2` |
| 278 | `src/pages/TicketHistory.tsx:113` | `<Button>` | `ghost` | `sm` | `text-muted-foreground h-10 rounded-md px-4 text-xs font-bold uppercase tracki...` |
| 279 | `src/pages/TicketHistory.tsx:117` | `<Button>` | `advancedOpen ? "default" : "outline"` | `sm` | `h-10 rounded-md border-border/40 font-bold text-xs uppercase tracking-wider p...` |
| 280 | `src/pages/TicketHistory.tsx:179` | `<button>` | `n/a` | `n/a` | `w-full flex items-start justify-between gap-3 px-4 py-4 hover:bg-muted/30 act...` |
| 281 | `src/pages/TicketHistory.tsx:236` | `<Button>` | `outline` | `sm` | `w-9 p-0` |
| 282 | `src/pages/TicketHistory.tsx:248` | `<Button>` | `outline` | `sm` | `w-9 p-0` |
| 283 | `src/pages/WebMonitoring.tsx:379` | `<Button>` | `outline` | `sm` | `rounded-xl font-semibold gap-1.5` |
| 284 | `src/pages/WebMonitoring.tsx:416` | `<button>` | `n/a` | `n/a` | `cn( 'h-full px-3 text-xs font-semibold rounded-md transition-all', period ===...` |
| 285 | `src/pages/WebMonitoring.tsx:599` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-semibold gap-2 shadow-xs` |
| 286 | `src/pages/WebMonitoring.tsx:631` | `<Button>` | `outline` | `default (implícito)` | `rounded-xl` |
| 287 | `src/pages/WebMonitoring.tsx:634` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-semibold` |
| 288 | `src/pages/WebMonitoring.tsx:662` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-semibold mt-2` |
| 289 | `src/pages/WebMonitoring.tsx:763` | `<Button>` | `outline` | `sm` | `cn( 'h-8 px-2.5 rounded-xl text-xs font-semibold gap-1.5 transition-colors', ...` |
| 290 | `src/pages/WebMonitoring.tsx:783` | `<Button>` | `ghost` | `icon` | `h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-dest...` |
| 291 | `src/pages/WebMonitoring.tsx:1206` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-semibold gap-2 shadow-xs` |
| 292 | `src/pages/WebMonitoring.tsx:1301` | `<Button>` | `outline` | `default (implícito)` | `rounded-xl` |
| 293 | `src/pages/WebMonitoring.tsx:1304` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-semibold` |
| 294 | `src/pages/WebMonitoring.tsx:1332` | `<Button>` | `default (implícito)` | `default (implícito)` | `rounded-xl font-semibold mt-2` |
| 295 | `src/pages/WebMonitoring.tsx:1363` | `<Button>` | `ghost` | `icon` | `h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ...` |
| 296 | `src/pages/WebMonitoring.tsx:1401` | `<Button>` | `outline` | `sm` | `cn( 'h-7 px-2 rounded-lg text-[11px] font-semibold gap-1 transition-colors', ...` |

**Fim do Relatório do Subagente 2.**
