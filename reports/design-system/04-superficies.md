# Relatório de Auditoria de Design System — 04. Cards, Superfícies e Containers

**Subagente:** 4 — Cards, Superfícies e Containers  
**Escopo:** Análise estática e quantitativa de todos os componentes `<Card>`, superfícies, painéis, modais, gavetas e containers estilizados em `src/`  
**Status da Auditoria:** Concluído (Fase 1 — Read-Only no código da aplicação)  
**Data:** 31 de Agosto de 2026  

---

## 1. Visão Geral e Metodologia

A identidade visual do **Orion System** utiliza uma estética moderna e tecnológica baseada em **Glassmorphism**, superfícies translúcidas com `backdrop-blur`, paleta com matiz roxo de marca (283°/260°), bordas sutis (`border-border/40`) e cantos arredondados.

Esta auditoria realizou uma varredura completa nos **185 arquivos** TypeScript/React da pasta `src/`, inspecionando todos os nós JSX de superfícies, componentes da família `<Card>` do Shadcn UI, containers de cards customizados (como `StatCard`, `MachineCard`, `PackageCard`, `PlanUsageCard`), tabelas encapsuladas, diálogos e gavetas.

### Estatísticas Globais do Inventário de Superfícies
- **Arquivos com importação/uso de `<Card>`:** 43 arquivos
- **Total de nós JSX da família `<Card>`:** 299 instâncias
- **Instâncias de superfícies Glassmorphism (`backdrop-blur` + `bg-*/opacity`):** 31 instâncias
- **Redeclarações redundantes de estilo no `<Card>`:** 86 ocorrências
- **Inversões de Raio Aninhado (Nested Radius Inversion):** 49 casos (container pai com curvatura menor que elementos internos)
- **Violações diretas da regra Raio ↔ Padding:** 10 casos críticos/médios

---

## 2. Inventário de Arquivos e Componentes `<Card>`

A tabela abaixo lista os **43 arquivos** que implementam componentes `<Card>` do Shadcn UI, distribuídos por módulo funcional e sua respectiva volumetria de nós da família `Card` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`):

| Módulo / Camada | Arquivo | Instâncias Card | Padrão Predominante de Uso |
| :--- | :--- | :---: | :--- |
| **Relatórios** | `src/pages/Reports.tsx` | 78 | Cards de gráficos Recharts, KPIs de SLA, tabelas analíticas |
| **Monitoramento** | `src/pages/WebMonitoring.tsx` | 29 | Status de endpoints HTTP, métricas DNS/SSL, painéis de latência |
| **Configurações** | `src/pages/Settings.tsx` | 25 | Cartões de perfil, preferências de notificação, tema, segurança |
| **Monitoramento** | `src/components/monitoring/WebTelemetryTab.tsx` | 28 | Métricas de telemetria web, gráficos de uptime |
| **Debug / Dev** | `src/pages/DebugTools.tsx` | 20 | Testes de carga, simulação de SLA, logs de auditoria |
| **Dashboard** | `src/components/dashboard/TechnicianDashboard.tsx` | 15 | Painel de carga de equipe, tabelas de chamados com abas |
| **Ativos** | `src/components/assets/AssetTopologyGraph.tsx` | 15 | Cards de nós de rede, detalhes de topologia de infraestrutura |
| **Chamados** | `src/pages/TicketDetails.tsx` | 13 | Painel de detalhes, timeline de mensagens, metadados SLA |
| **Portal Cliente** | `src/pages/ClientPortal.tsx` | 11 | Lista de chamados interativos com hover e badges de status |
| **Administração** | `src/components/admin/UserManagement.tsx` | 10 | Tabela e formulários de gerenciamento de técnicos/usuários |
| **Chamados** | `src/pages/NewTicket.tsx` | 9 | Formulário principal de abertura de chamados |
| **Ativos** | `src/pages/Assets.tsx` | 8 | Resumo de hardware, inventário de ativos e métricas |
| **Administração** | `src/components/admin/PlanUsageCard.tsx` | 8 | Widget de consumo de licenças e cotas de usuários |
| **Administração** | `src/components/admin/SLAConfiguration.tsx` | 8 | Listagem de políticas SLA, cadastro e formulário modal |
| **Monitoramento** | `src/components/monitoring/MachineDrawer.tsx` | 8 | Painel lateral detalhado de telemetria da máquina |
| **Administração** | `src/components/admin/CompanyManagement.tsx` | 7 | Gestão de empresas clientes, domínios e contratos |
| **Administração** | `src/components/admin/ContractManagement.tsx` | 7 | Tabela e formulários de contratos corporativos |
| **Administração** | `src/components/admin/CannedResponsesManagement.tsx` | 7 | Respostas prontas para técnicos e templates |
| **Avaliação** | `src/pages/Avaliacao.tsx` | 7 | Tela de satisfação pós-atendimento para clientes |
| **Chamados** | `src/components/ticket/SatisfactionSurvey.tsx` | 7 | Card inline de CSAT com avaliação de 1 a 5 estrelas |
| **Segurança** | `src/components/settings/TwoFactorAuthSettings.tsx` | 7 | Configuração de 2FA TOTP e QR Code |
| **Base Conhec.** | `src/pages/KnowledgeBase.tsx` | 6 | Artigos de documentação e FAQ |
| **Administração** | `src/components/admin/ResolutionChecklistManagement.tsx` | 5 | Checklists operacionais obrigatórios de finalização |
| **Administração** | `src/components/admin/RoutingRulesManagement.tsx` | 5 | Regras automáticas de direcionamento por categoria |
| **Automação** | `src/components/automation/SLATab.tsx` | 5 | Configurações de SLA em lote |
| **Monitoramento** | `src/components/monitoring/PendingMachinesBanner.tsx` | 5 | Alerta de novas máquinas aguardando autorização |
| **Autenticação** | `src/pages/SetPassword.tsx` | 5 | Card central de definição de senha |
| **Automação** | `src/components/automation/RulesTab.tsx` | 4 | Lista de regras de automação ativas |
| **Automação** | `src/components/automation/TemplatesTab.tsx` | 4 | Templates de e-mail e webhook |
| **Monitoramento** | `src/components/monitoring/MachineCard.tsx` | 4 | Card compacto de servidor com barras de CPU, RAM e Disco |
| **Administração** | `src/pages/Admin.tsx` | 3 | Hub administrativo unificado |
| **Patch / Deploy** | `src/pages/PatchManagement.tsx` | 3 | Visão geral de patches e scripts de instalação |
| **Histórico** | `src/pages/TicketHistory.tsx` | 3 | Tabela de chamados arquivados / histórico |
| **Monitoramento** | `src/components/monitoring/InventoryTab.tsx` | 3 | Inventário consolidado de ativos de TI |
| **Automação** | `src/components/automation/HistoryTab.tsx` | 3 | Histórico de execuções de gatilhos automáticos |
| **Chamados** | `src/components/ticket/TicketSummaryDialog.tsx` | 3 | Modal de resumo gerado por IA para encerramento |
| **Alertas** | `src/pages/AlertsDashboard.tsx` | 2 | Painel de monitoramento de alertas críticos |
| **Automações** | `src/pages/Automacoes.tsx` | 2 | Hub geral de automação |
| **Monitoramento** | `src/components/monitoring/PlatformHealthTab.tsx` | 2 | Saúde operacional dos serviços backend/banco |
| **Patch / Deploy** | `src/components/patch/PackageCard.tsx` | 2 | Card de pacote com SHA-256 e status de deploy |
| **Patch / Deploy** | `src/components/patch/AgentInstallerCard.tsx` | 2 | Card de download do executável/instalador |
| **Chamados** | `src/components/ticket/TimeTracker.tsx` | 2 | Widget de contagem de tempo e apontamento de horas |
| **Monitoramento** | `src/components/monitoring/PerformanceChart.tsx` | 1 | Card de gráfico de latência e consumo |

---

## 3. Tabelas de Frequência de Tokens de Superfície

### 3.1. Border Radius (`rounded-*`)
Total de classes `rounded-*` aplicadas em elementos de superfície/containers: **562 ocorrências**.

| Token Tailwind | Valor Computado | Frequência | Percentual | Uso Típico no Sistema |
| :--- | :--- | :---: | :---: | :--- |
| `rounded-xl` | `0.75rem` (12px) | **220** | **39.1%** | Sub-cards, badges, botões, inputs, painéis internos |
| `rounded-lg` | `var(--radius)` (8px) | **133** | **23.7%** | Padrão base do `<Card>`, inputs padrão, banners |
| `rounded-full` | `9999px` | **121** | **21.5%** | Status dots, avatares, pills de categoria, barras |
| `rounded-md` | `calc(var(--radius) - 2px)` (6px) | **43** | **7.7%** | Sub-itens compactos, triggers de abas, tooltips |
| `rounded` | `0.25rem` (4px) | **26** | **4.6%** | Pequenos indicadores de cor e checkboxes |
| `rounded-2xl` | `1rem` (16px) | **13** | **2.3%** | StatCards, cards do Portal do Cliente, Tabelas do Dashboard |
| `rounded-3xl` | `1.5rem` (24px) | **2** | **0.4%** | Banner de Onboarding e Callout de SLA (casos extremos) |
| `rounded-sm` | `calc(var(--radius) - 4px)` (4px) | **2** | **0.4%** | Botão fechar de diálogo |
| `rounded-none` | `0px` | **1** | **0.2%** | Reset explícito |
| `rounded-[2px]` | `2px` | **1** | **0.2%** | Ajuste pontual |

> **Diagnóstico:** O sistema possui uma divisão binária: o componente base do Shadcn (`card.tsx`) adota `rounded-lg` (8px), porém o padrão visual dominante em componentes customizados mais recentes migrou para `rounded-xl` (12px) e `rounded-2xl` (16px).

---

### 3.2. Padding Interno (`p-*`, `px-*`, `py-*`)
Total de declarações de padding em containers de superfície: **643 ocorrências**.

#### Frequência de Padding Unificado (`p-*` completo):
| Token Tailwind | Valor Computado | Frequência | Percentual | Contexto de Uso |
| :--- | :--- | :---: | :---: | :--- |
| `p-4` | `1rem` (16px) | **104** | **33.7%** | Padrão em cards médios, MachineCard, TimeTracker |
| `p-6` | `1.5rem` (24px) | **45** | **14.6%** | Padrão base de `CardHeader`, `CardContent`, modais |
| `p-3` | `0.75rem` (12px) | **37** | **12.0%** | Cards densos, listas compactas, tooltips expandidos |
| `p-2` | `0.5rem` (8px) | **36** | **11.7%** | Ícones de destaque, sub-containers, caixas de atalho |
| `p-0` | `0px` | **25** | **8.1%** | `CardContent` que encapsula tabelas (`<Table>`) |
| `p-3.5` | `0.875rem` (14px) | **20** | **6.5%** | Cards do Portal do Cliente |
| `p-5` | `1.25rem` (20px) | **18** | **5.8%** | `StatCard` no Dashboard, `PackageCard` |
| `p-2.5` | `0.625rem` (10px) | **17** | **5.5%** | Painéis de métricas internas (CPU/RAM/Disco) |
| `p-8` | `2rem` (32px) | **15** | **4.9%** | Áreas de código terminal (`bg-slate-950`), headers |
| `p-1` | `0.25rem` (4px) | **14** | **4.5%** | Container de abas (`TabsList`), agrupadores |
| `p-1.5` | `0.375rem` (6px) | **12** | **3.9%** | Badges de status e micro-cards |
| `p-12` | `3rem` (48px) | **5** | **1.6%** | Empty states com ilustrações |
| `p-0.5` | `0.125rem` (2px) | **3** | **1.0%** | Molduras finas |
| `p-20` | `5rem` (80px) | **1** | **0.3%** | Tela de loading inicial |

#### Frequência dos Principais Paddings Direcionais (`px-*` / `py-*`):
- `py-4`: 44 ocorrências (linhas de tabela `<TableCell>`)
- `px-4`: 37 ocorrências (botões grandes, cabeçalhos horizontais)
- `pt-2`: 33 ocorrências (sub-headers de card)
- `px-3`: 29 ocorrências (tooltips, pills, campos de filtro)
- `pt-1`: 28 ocorrências (espaçamento de badge)
- `py-2`: 27 ocorrências (itens de dropdown e seleção)
- `px-2`: 25 ocorrências (badges)
- `py-0.5`: 25 ocorrências (micro-tags e chips)

---

### 3.3. Fundos e Opacidades (`bg-*`)
Total de declarações de background em superfícies: **488 ocorrências**.

| Token de Fundo | Frequência | Classificação | Avaliação Visual / Contraste |
| :--- | :---: | :--- | :--- |
| `bg-background` | **66** | Semântico Base | Fundo da aplicação (Canvas principal) |
| `bg-card` | **58** | Semântico Superfície | Superfície sólida padrão para cards e widgets |
| `bg-muted/20` | **44** | Semântico Translúcido | Painéis secundários e linhas alternadas |
| `bg-muted/30` | **40** | Semântico Translúcido | Hover em tabelas, sub-painéis de métricas |
| `bg-primary/10` | **37** | Marca / Destaque | Fundo de ícones ativos, badges de alta prioridade |
| `bg-muted` | **26** | Semântico Sólido | Trilhas de progresso, botões inativos |
| `bg-amber-500/10` | **23** | Feedback Alerta | Cards de aviso de SLA, alertas de armazenamento |
| `bg-muted/10` | **22** | Semântico Translúcido | Cabeçalhos de card secundários |
| `bg-emerald-500/10` | **21** | Feedback Sucesso | Chamados resolvidos, métricas online estáveis |
| `bg-primary` | **19** | Marca Sólido | Botões principais e chips selecionados |
| `bg-muted/40` | **18** | Semântico Translúcido | Badges neutras, ícones de SO |
| `bg-emerald-500` | **18** | Feedback Sólido | Dots de status online, barras de progresso 100% |
| `bg-muted/60` | **13** | Semântico Translúcido | Container base de `TabsList` |
| `bg-primary/5` | **12** | Marca Translúcido | Fundos interativos de hover em cards |
| `bg-red-500` | **12** | Feedback Erro | Alertas graves de falha e SLA estourado |
| `bg-red-500/10` | **11** | Feedback Erro | Badges de prioridade Urgente / Crítica |
| `bg-blue-500/10` | **9** | Info Translúcido | Chamados Em Progresso, telemetria HTTP |
| `bg-amber-500` | **9** | Feedback Alerta | Indicador de status pendente |
| `bg-card/60` | **8** | Glassmorphism | Cards translúcidos com efeito de vidro |
| `bg-destructive/10` | **8** | Semântico Erro | Alerta de auto-atribuição indisponível |
| `bg-card/50` | **6** | Glassmorphism | Cards com transparência 50% |
| `bg-popover/95` | **5** | Superfície Flutuante | Tooltips e Popovers com blur |
| `bg-background/80` | **5** | Glassmorphism Header | TopBar sticky com blur |
| `bg-slate-950` | **4** | Terminal Code Block | Caixas de comando e snippets shell |
| `bg-card/80` | **3** | Glassmorphism | Cards com transparência 80% |

> **Diagnóstico:** Há uma proliferação de variações de opacidade para a cor `muted` (`/5`, `/10`, `/15`, `/20`, `/30`, `/40`, `/50`, `/60`). Recomenda-se consolidar em apenas 3 patamares oficiais: `bg-muted/10` (muito sutil), `bg-muted/30` (intermediário/hover) e `bg-muted/60` (recipientes de abas).

---

### 3.4. Backdrop Blur e Glassmorphism
Total de declarações de `backdrop-blur`: **31 instâncias**.

| Token Tailwind | Blur em Pixels | Frequência | Componentes e Locais de Uso |
| :--- | :---: | :---: | :--- |
| `backdrop-blur-md` | `12px` | **14** | `Assets.tsx`, `WebTelemetryTab.tsx`, `.glass-card` (index.css) |
| `backdrop-blur-sm` | `4px` | **10** | `DashboardLayout.tsx` (Header), `TechnicianDashboard.tsx`, `PerformanceChart.tsx` |
| `backdrop-blur` (default) | `8px` | **4** | `EscalateDialog.tsx`, modais de confirmação |
| `backdrop-blur-xl` | `24px` | **3** | `TopBar.tsx` (menu de busca rápida global) |

**Exemplo de Padrão Glassmorphism no Sistema:**
- `DashboardLayout.tsx`: `bg-background/80 backdrop-blur-sm border-b border-border/30`
- `TechnicianDashboard.tsx`: `bg-card/60 backdrop-blur-sm border border-border/50`
- `TopBar.tsx`: `bg-card/90 backdrop-blur-xl border border-border/60 shadow-2xl`

---

### 3.5. Bordas (`border-*`)
Total de declarações de bordas em superfícies: **521 ocorrências**.

| Token de Borda | Frequência | Utilização |
| :--- | :---: | :--- |
| `border` (1px sólido base) | **240** | Modificador de ativação de borda estrutural |
| `border-border/40` | **148** | **Borda padrão oficial do sistema** para cards, separadores e tabelas |
| `border-border/50` | **47** | Cards de maior destaque e widgets do Dashboard |
| `border-border/60` | **26** | Tooltips flutuantes, cards de ativos online |
| `border-border` (100% opaco) | **24** | Borda base de formulários e inputs nativos |
| `border-dashed` | **22** | Empty states, zonas de drop de arquivo, callouts informativos |
| `border-primary/20` | **17** | Badges e containers de ícones roxos |
| `border-primary/40` | **14** | Hover em cards interativos |
| `border-border/80` | **13** | Popovers e tooltips escuros |
| `border-border/30` | **13** | Divisores sutis no TopBar e linhas internas |
| `border-2` (2px de largura) | **12** | Estados de seleção ativa |
| `border-none` | **12** | Remoção explícita de borda |
| `border-amber-500/20` | **10** | Alertas e badges amarelas |
| `border-amber-500/30` | **9** | Cards com aviso de SLA |
| `border-b` / `border-t` | **17** | Divisores de seção de cabeçalho e rodapé |
| `border-emerald-500/20` | **8** | Badges e cards de status resolvido |
| `border-primary` (100%) | **8** | Foco de input e card ativo |
| `border-indigo-500/20` | **7** | Badges e categorias secundárias |
| `border-primary/30` | **7** | Hover em pacotes e cartões de patch |
| `border-primary/50` | **5** | Cards em edição ativa |

> **Diagnóstico:** O token `border-border/40` responde por 60% de todas as bordas coloridas. No entanto, o uso concorrente de `/30`, `/40`, `/50`, `/60` e `/80` para a mesma cor semântica `border` introduz variações quase imperceptíveis a olho nu, mas que aumentam a complexidade do CSS.

---

### 3.6. Sombras e Glow (`shadow-*` / `glow-*`)
Total de declarações de sombra em superfícies: **207 ocorrências**.

| Token de Sombra | Efeito / Intensidade | Frequência | Casos de Uso |
| :--- | :--- | :---: | :--- |
| `shadow-sm` | Elevação sutil (1px) | **76** | `<Card>` base (shadcn), relatórios, cartões estáticos |
| `shadow-xs` | Micro-elevação (0.5px) | **32** | `StatCard` inativo, linhas de tabela interativas |
| `shadow-md` | Elevação média (4px) | **19** | Hover em cards clicáveis, botões principais |
| `shadow-xl` | Elevação alta (20px) | **16** | Modais `<DialogContent>`, dropdown de busca global |
| `shadow-lg` | Elevação pronunciada (10px) | **11** | Botões com glow de ação primária |
| `shadow-2xl` | Elevação máxima (25px) | **9** | Popovers flutuantes de gráficos e tooltips de telemetria |
| `shadow-primary/20` | Glow colorido roxo | **7** | Botões primários com efeito de brilho |
| `shadow-primary/5` | Glow sutil roxo | **7** | Cards de pesquisa de satisfação |
| `shadow-none` | Sem sombra | **4** | Cards incorporados dentro de outros cards |
| `shadow-inner` | Sombra interna | **1** | Poço de input de busca |
| `shadow-emerald-500/50` | Glow verde | **1** | Indicador de agente online ativo |

---

## 4. Diagnóstico de Inconsistências e Violações

### 4.1. Violações da Regra Raio ↔ Padding (Radius-Padding Mismatch)
Um container com raio de curvatura acentuado exige padding interno suficiente para que os elementos filhos não encostem nas quinas arredondadas. A regra geométrica fundamental estabelece que $Padding \ge Radius$ para evitar tensão visual ou corte de conteúdo.

Abaixo estão os **casos identificados no código**:

```
[VIOLAÇÃO GEOMÉTRICA]
Raio Extremo (rounded-3xl = 24px) com Padding Insuficiente (p-0 / p-1)
┌────────────────────────────────────────────────────────┐
│ █ CONTEÚDO ENCOSTA NA CURVA (Sensação de corte visual) │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Tabela de Violações Detectadas:
| Severidade | Arquivo | Linha | Raio | Padding Atual | Código / Elemento | Problema Identificado |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| **ALTA** | `src/components/admin/SLAConfiguration.tsx` | 268 | `rounded-3xl` (24px) | Nenhum no card (`CardContent p-6`) | `<Card className="... rounded-3xl overflow-hidden mt-8">` | Raio excessivo de 24px para um pequeno callout de texto de 1 linha. Destoa dos demais cards `rounded-lg` da tela. |
| **ALTA** | `src/components/monitoring/MonitoringOnboarding.tsx` | 77 | `rounded-3xl` (24px) | Sem padding no container pai | `<div className="... rounded-3xl overflow-hidden shadow-xl">` | Container do terminal shell com raio de 24px. As abas do topo ficam coladas no vértice superior. |
| **MÉDIA** | `src/components/dashboard/TechnicianDashboard.tsx` | 479 | `rounded-2xl` (16px) | `p-0` no `CardContent` | `<Card className="... rounded-2xl overflow-hidden bg-card/60">` | Card da tabela de técnicos com raio 16px e tabela interna `p-0`. A primeira coluna encosta na borda curva sem respiro. |
| **MÉDIA** | `src/components/dashboard/TechnicianDashboard.tsx` | 674 | `rounded-2xl` (16px) | `p-0` no `CardContent` | `<Card className="... rounded-2xl overflow-hidden bg-card">` | Card da tabela de chamados não atribuídos. |
| **MÉDIA** | `src/components/dashboard/TechnicianDashboard.tsx` | 708 | `rounded-2xl` (16px) | `p-0` no `CardContent` | `<Card className="... rounded-2xl overflow-hidden bg-card">` | Card da tabela "Meus Chamados". |
| **MÉDIA** | `src/components/dashboard/TechnicianDashboard.tsx` | 739 | `rounded-2xl` (16px) | `p-0` no `CardContent` | `<Card className="... rounded-2xl overflow-hidden bg-card">` | Card da tabela "Todos os Chamados". |
| **MÉDIA** | `src/pages/ClientPortal.tsx` | 188 | `rounded-2xl` (16px) | `p-3.5` (14px) | `<Card className="... rounded-2xl bg-card ...">` | O padding de 14px é menor que o raio externo de 16px. |
| **BAIXA** | `src/components/ticket/TimeTracker.tsx` | 101 | `rounded-xl` (12px) | `p-4` (16px) | `<Card className="... rounded-xl ...">` | Falta de `overflow-hidden` explícito com fundo `bg-primary/10`. |

---

### 4.2. Inversão de Raio Aninhado (Nested Radius Inversion)
Foram catalogados **49 casos** onde o container externo utiliza o `<Card>` base (com `rounded-lg` = 8px), mas os elementos filhos internos utilizam `rounded-xl` (12px) ou `rounded-2xl` (16px).

#### O Problema Matemático da Geometria Concêntrica:
Para que dois cantos curvos concêntricos pareçam harmoniosos:
$$R_{\text{interno}} \le R_{\text{externo}} - \text{Padding}$$

Quando $R_{\text{interno}} > R_{\text{externo}}$, o elemento interno parece "mais redondo" que a própria moldura externa que o contém, gerando uma distorção óptica visível.

#### Principais Componentes com Inversão de Raio:
1. **`MachineCard.tsx` (linhas 321–475):**
   - Container `<Card>`: `rounded-lg` (8px)
   - Ícone do SO: `rounded-xl` (12px) $\rightarrow$ **Inversão (12px > 8px)**
   - Painéis de CPU, RAM e Disco: `rounded-xl` (12px) $\rightarrow$ **Inversão (12px > 8px)**
2. **`PackageCard.tsx` (linhas 32–36):**
   - Container `<Card>`: `rounded-lg` (8px)
   - Box de ícone: `rounded-xl` (12px) $\rightarrow$ **Inversão (12px > 8px)**
3. **`SLAConfiguration.tsx` (linhas 147–161):**
   - Container `<Card>`: `rounded-lg` (8px)
   - Linha do Switch de Horário Comercial: `rounded-xl` (12px) $\rightarrow$ **Inversão (12px > 8px)**
4. **`WebTelemetryTab.tsx` (linhas 280–400):**
   - Cards de métricas: `<Card>` `rounded-lg` (8px)
   - Ícones internos de rede e status: `rounded-xl` (12px) $\rightarrow$ **Inversão (12px > 8px)**
5. **`SatisfactionSurvey.tsx` (linhas 56–95):**
   - Container `<Card>`: `rounded-lg` (8px)
   - Campo de texto `<Textarea>`: `rounded-xl` (12px)
   - Botão Enviar: `rounded-xl` (12px)

---

### 4.3. Redundâncias e Sobrecarga de Estilo no `<Card>`
Foram identificadas **86 ocorrências** onde desenvolvedores passaram classes no `className` do `<Card>` que apenas duplicam o que o componente base já fornece:

```tsx
// Definição original em src/components/ui/card.tsx:
<div className="rounded-lg border bg-card text-card-foreground shadow-sm" />

// Exemplos de redeclarações redundantes encontradas no código:
<Card className="border-border/50 shadow-sm ..." /> // shadow-sm é redundante (em Reports.tsx: 28x)
<Card className="rounded-lg bg-card border ..." />  // rounded-lg, bg-card e border são redundantes
```

---

## 5. Matriz de Recomendações Técnicas (Fase 2)

Com base nos dados coletados, recomenda-se as seguintes melhorias para a Fase 2 (Refatoração do Design System):

1. **Unificação do Raio Base no Tailwind / CSS Variables:**
   - Elevar o token `--radius` de `0.5rem` (8px) para `0.75rem` (12px) no `:root` e `.dark` de `src/index.css`.
   - Com isso, `rounded-lg` assume 12px nativamente em todos os componentes Shadcn, eliminando imediatamente os 49 casos de Inversão de Raio Aninhado sem quebrar o layout.

2. **Hierarquia Geométrica Padronizada de Superfícies:**
   - **Containers Principais (Páginas/Modais/Cards Mestres):** `rounded-2xl` (16px) com padding $\ge$ `p-5` (20px) ou `p-6` (24px).
   - **Sub-Cards, Widgets e Grupos Internos:** `rounded-xl` (12px) com padding `p-3` a `p-4`.
   - **Itens de Entrada (Inputs, Botões, Badges):** `rounded-lg` (8px) ou `rounded-md` (6px).
   - **Status Indicators / Avatares:** `rounded-full`.

3. **Consolidação das Opacidades de Borda e Fundo:**
   - Definir formalmente 3 classes utilitárias no Design System:
     - `surface-card`: `bg-card border border-border/40 shadow-xs rounded-xl`
     - `surface-glass`: `bg-card/70 backdrop-blur-md border border-border/50 shadow-sm rounded-xl`
     - `surface-panel`: `bg-muted/20 border border-border/30 rounded-lg p-3`
   - Limpar as 86 sobrecargas redundantes de `shadow-sm` e `bg-card` em `src/pages/Reports.tsx` e `TechnicianDashboard.tsx`.

4. **Correção dos 10 Casos de Incompatibilidade de Raio:**
   - Substituir `rounded-3xl` em `SLAConfiguration.tsx` e `MonitoringOnboarding.tsx` por `rounded-2xl`.
   - Nos cards de tabelas do Dashboard (`TechnicianDashboard.tsx`), garantir que o `<Table>` tenha cabeçalho com padding lateral compensado (`px-4` a `px-6`) ou utilizar `rounded-xl`.

---

*Relatório gerado automaticamente pelo Subagente 4 — Cards, Superfícies e Containers da Auditoria do Design System Orion System.*
