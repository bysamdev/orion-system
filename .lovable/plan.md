

# Especificacao UX/UI -- Dashboard do Tecnico e Tela de Detalhes do Ticket

## Analise do Estado Atual

### Dashboard (TechnicianDashboard.tsx)
- 4 KPI cards no topo (Em Atendimento, Resolvidos Hoje, SLA em Risco, Meus Pendentes)
- Layout 2/3 + 1/3: coluna principal com 3 tabelas empilhadas (Abertos, Em Atendimento, Fechados) + sidebar com grafico pizza e Fila Geral
- **Problemas**: Nao diferencia "meus tickets" dos da equipe; tabelas sem filtro/busca; SLA em risco nao tem lista dedicada; muita rolagem vertical

### TicketDetails.tsx (~789 linhas)
- Layout 2/3 + 1/3: coluna principal (cabecalho, descricao, timeline, campo resposta) + sidebar (gestao, informacoes, acesso remoto, anexos)
- **Problemas**: Sem apontamento de horas; sem vinculo KB; sem historico de status separado; sidebar com informacoes repetidas (SLA aparece 2x); sem quick actions no topo

---

## 1. REDESENHO DO DASHBOARD DO TECNICO

### 1.1 Barra de KPIs (topo, manter 4 cards)
Mesmos 4 cards mas **clicaveis** -- ao clicar, filtram a lista abaixo:
- "Em Atendimento" → filtra meus tickets in-progress
- "Resolvidos Hoje" → filtra meus resolvidos nas ultimas 24h
- "SLA em Risco" → filtra meus tickets com SLA attention/breached
- "Meus Pendentes" → filtra awaiting-customer + awaiting-third-party meus

### 1.2 Nova Estrutura de Layout

```text
┌──────────────────────────────────────────────────────────────────┐
│  [KPI1]  [KPI2]  [KPI3]  [KPI4]                                │
├──────────────────────────────────────────┬───────────────────────┤
│                                          │                       │
│  SECAO: "Exigem Minha Acao"             │  FILA GERAL           │
│  ┌─ Tabs: [Meus Tickets] [SLA Risco]   │  (tickets sem dono)   │
│  │                                       │  Ordenados por SLA    │
│  │  Tabela unificada com:               │  restante (urgente    │
│  │  - #ID, Titulo, Empresa, Prioridade  │  primeiro)            │
│  │  - SLA badge, Status, Tempo aberto   │                       │
│  │  - Filtro por status, prioridade     │  Card compacto:       │
│  │  - Busca por texto                   │  #ID - Titulo         │
│  │  - Ordenacao por SLA restante        │  [Prioridade] [SLA]   │
│  │                                       │  Empresa | ha X min   │
│  └───────────────────────────────────── │  [Assumir]            │
│                                          │                       │
│  SECAO: "Recentes Fechados" (colapsavel)│  MINHA CARGA          │
│  - Lista compacta, max 5 itens          │  (grafico donut)      │
│                                          │                       │
└──────────────────────────────────────────┴───────────────────────┘
```

### 1.3 Detalhamento das Secoes

**"Exigem Minha Acao"** -- Componente principal, substitui TicketsTable + InProgressTickets
- **Tab "Meus Tickets"**: Todos os tickets atribuidos a mim com status ativo (open, in-progress, awaiting-customer, awaiting-third-party, reopened). Ordenados por SLA restante (menor primeiro).
- **Tab "SLA em Risco"**: Apenas tickets com sla_status = 'attention' ou 'breached', de toda a equipe (nao so meus). Destaque visual: linha com borda vermelha para breached, amarela para attention.
- Barra de ferramentas: campo de busca + filtro por status (multi-select) + filtro por prioridade + ordenacao (SLA, data criacao, prioridade)
- Cada linha clicavel → navega para /ticket/:id

**Fila Geral (sidebar)**
- Manter design atual mas **ordenar por SLA restante** (nao por data)
- Adicionar badge de SLA em cada item
- Mostrar empresa do solicitante
- Limite de 10 itens + link "Ver todos (X)"

**Recentes Fechados**
- Componente colapsavel (Collapsible) no fim da coluna principal
- Apenas ultimos 5, compactos

**Minha Carga de Trabalho (sidebar)**
- Manter grafico donut atual
- Adicionar totalizador central: numero total de tickets ativos

### 1.4 Melhorias de Usabilidade no Dashboard

| Melhoria | Componente | Descricao |
|----------|-----------|-----------|
| Busca global | Input no topo da tabela | Filtra por #numero, titulo, solicitante, empresa |
| Filtros persistentes | localStorage | Salvar ultima configuracao de filtros do usuario |
| Refresh visual | Badge pulsante | Indicar novos tickets via realtime com badge "Novo" |
| Atalhos teclado | useEffect global | N = novo ticket, / = foco busca |
| Linha com SLA critico | className condicional | Borda left vermelha em tickets breached |
| Timer ativo | Badge no KPI | Se ha time_entry aberta, mostrar timer rodando no card "Em Atendimento" |

---

## 2. REDESENHO DA TELA DE DETALHES DO TICKET

### 2.1 Estrutura Proposta

```text
┌──────────────────────────────────────────────────────────────────┐
│  [← Voltar]                                                      │
│                                                                  │
│  ┌─ CABECALHO HERO ─────────────────────────────────────────┐   │
│  │  #1234  Titulo do Chamado                                 │   │
│  │  [●Aberto] [🔴Urgente] [⏱SLA: 2h restantes] [Empresa X] │   │
│  │                                                           │   │
│  │  QUICK ACTIONS:                                           │   │
│  │  [▶ Iniciar Timer] [✓ Resolver] [↗ Escalar]             │   │
│  │  [📎 Anexar] [📖 Vincular KB]                            │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ COLUNA PRINCIPAL (2/3) ──────┐ ┌─ SIDEBAR (1/3) ─────────┐ │
│  │                                │ │                          │ │
│  │  DESCRICAO                     │ │  INFORMACOES             │ │
│  │  Texto do problema             │ │  Solicitante: Nome       │ │
│  │                                │ │  Empresa: XPTO           │ │
│  │  TIMELINE UNIFICADA            │ │  Contrato: Anual 2026    │ │
│  │  ┌─ Tabs: [Todos] [Comentarios]│ │  Categoria: Hardware     │ │
│  │  │        [Status] [Horas]     │ │  Departamento: TI        │ │
│  │  │                             │ │  Criado: 09/03 14:30     │ │
│  │  │  ● Comentario publico       │ │                          │ │
│  │  │  ● [Nota interna]           │ │  GESTAO                  │ │
│  │  │  ● Status: Aberto→Atendendo│ │  Status: [Select ▼]      │ │
│  │  │  ● Timer: 45min (faturavel) │ │  Tecnico: [Select ▼]     │ │
│  │  │                             │ │  Prioridade: [Select ▼]  │ │
│  │  └─────────────────────────────│ │                          │ │
│  │                                │ │  SLA                     │ │
│  │  CAMPO DE RESPOSTA             │ │  ⏱ 2h restantes          │ │
│  │  [Nota interna toggle]         │ │  Prazo: 09/03 16:30      │ │
│  │  [Textarea]                    │ │  1a resp: ha 30min       │ │
│  │  [Templates] [Anexar] [Enviar] │ │                          │ │
│  │                                │ │  TEMPO REGISTRADO        │ │
│  └────────────────────────────────┘ │  Total: 1h45min          │ │
│                                     │  Faturavel: 1h15min      │ │
│                                     │  [+ Registro manual]     │ │
│                                     │                          │ │
│                                     │  ACESSO REMOTO           │ │
│                                     │  ID: 123456 [Copiar]     │ │
│                                     │  Senha: *** [Copiar]     │ │
│                                     │                          │ │
│                                     │  ANEXOS (3)              │ │
│                                     │  arquivo1.pdf            │ │
│                                     │  screenshot.png          │ │
│                                     └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Detalhamento por Secao

**Cabecalho Hero**
- Linha 1: #numero + titulo (h1)
- Linha 2: Badges inline -- status (com cor), prioridade (com cor), SLA (verde/amarelo/vermelho com countdown), empresa
- Linha 3: Quick Actions -- botoes primarios de acao rapida
  - "Iniciar Timer" (toggle start/stop, muda para "Parar Timer: 00:45:12" quando ativo)
  - "Resolver" (abre dialog pedindo resolution_notes)
  - "Escalar" (transferir para outro tecnico, abre select)
  - "Anexar" (file picker)
  - "Vincular KB" (abre dialog com busca de artigos)

**Coluna Principal**

*Descricao*: Card com texto do problema. Sem mudancas significativas.

*Timeline Unificada*: Substitui o historico atual. Adicionar tabs para filtrar:
- **Todos**: Tudo misturado (comentarios + status + apontamentos + anexos)
- **Comentarios**: Apenas type=comment
- **Status**: Apenas mudancas de status (dados de ticket_status_history)
- **Horas**: Apenas time_entries

Cada item da timeline exibe:
- Icone por tipo (cor diferente)
- Autor + timestamp relativo
- Conteudo
- Badge "Nota Interna" com fundo ambar (manter design atual)
- Para time_entries: duracao, se faturavel, descricao

*Campo de Resposta*: Manter design atual (textarea + nota interna toggle + templates + anexar). Adicionar:
- Botao "Responder e Resolver" (combo: envia comentario + muda status para resolvido + pede resolution_notes)
- Preview de markdown (futuro)

**Sidebar**

Reorganizar em secoes com Separator:

1. **Informacoes do Solicitante**: Nome, empresa, contrato ativo (se houver), telefone/email
2. **Gestao do Chamado**: Selects de status, tecnico responsavel, prioridade (novo: permitir mudar prioridade)
3. **SLA**: Badge grande + prazo absoluto + 1a resposta. Sem duplicacao (remover SLA do cabecalho do card principal)
4. **Tempo Registrado**: Totalizador de horas (total e faturavel) + link para adicionar manualmente
5. **Acesso Remoto**: Manter design atual (condicional)
6. **Anexos**: Lista compacta com download

### 2.3 Dialog de Resolucao (novo)
Ao clicar "Resolver":
- Modal com textarea para `resolution_notes` (obrigatorio)
- Checkbox "Enviar pesquisa de satisfacao ao cliente"
- Botoes: Cancelar | Confirmar Resolucao

### 2.4 Dialog de Vinculacao KB (novo)
Ao clicar "Vincular KB":
- Modal com campo de busca (full-text na knowledge_base_articles)
- Lista de resultados com titulo + preview + tags
- Botao "Vincular" em cada resultado (insere em ticket_kb_links)
- Artigos ja vinculados aparecem com check

---

## 3. MELHORIAS DE USABILIDADE APLICAVEIS NO LOVABLE

### Dashboard
1. **TicketSearchBar.tsx**: Input com debounce, busca por numero/titulo/solicitante
2. **TicketStatusFilter.tsx**: Multi-select com badges dos status ativos
3. **TicketPriorityFilter.tsx**: Botoes toggle para urgente/alta/media/baixa
4. **SortControl.tsx**: Dropdown com opcoes (SLA restante, Data criacao, Prioridade)
5. **Collapsible** em "Fechados Recentes" (usar @radix-ui/react-collapsible ja instalado)
6. **Tabs** em "Meus Tickets" vs "SLA em Risco" (usar @radix-ui/react-tabs ja instalado)
7. **Badge pulsante** para novos tickets via realtime (animate-pulse do Tailwind)
8. **Linha com borda SLA**: `border-l-4 border-destructive` para breached

### Tela de Detalhes
1. **TicketHeroHeader.tsx**: Cabecalho compacto com quick actions
2. **UnifiedTimeline.tsx**: Timeline com tabs filtraveis (usar Tabs existente)
3. **TimeTracker.tsx**: Componente de timer (useState + setInterval, grava em time_entries)
4. **ResolutionDialog.tsx**: Dialog (usar @radix-ui/react-dialog) com textarea para notes
5. **KBLinkDialog.tsx**: Dialog com busca full-text e vinculacao
6. **TicketSidebar.tsx**: Sidebar reorganizada com secoes colapsaveis
7. **SatisfactionModal.tsx**: Modal pos-resolucao para o cliente avaliar (1-5 estrelas)

### Componentes Reutilizaveis
- **SLACountdown.tsx**: Badge com countdown em tempo real (atualiza a cada minuto)
- **PriorityBadge.tsx**: Badge padronizado de prioridade (extrair do codigo duplicado atual)
- **StatusBadge.tsx**: Badge padronizado de status com cor

### Ordem de Implementacao Sugerida
1. Extrair PriorityBadge e StatusBadge (componentes base)
2. Redesenhar dashboard com tabs "Meus Tickets" / "SLA em Risco" + busca/filtros
3. Criar TicketHeroHeader com quick actions
4. Implementar UnifiedTimeline com tabs
5. Implementar TimeTracker (timer + time_entries)
6. ResolutionDialog com resolution_notes
7. KBLinkDialog (depende de ter artigos na KB)
8. SatisfactionModal (apos resolucao)

