# CONTRATO DE ESTADOS & DESIGN TOKENS (UI/UX)
**Orion System — Arquitetura de Cores de Estado, Semântica e Consistência Visual**  
**Versão:** 1.0.0 (Fase 1.5 — Consolidação Read-Only)  
**Data:** 31 de Agosto de 2026  
**Status:** 🛑 AGUARDANDO APROVAÇÃO FORMAL NO GATE

---

## 1. Arquitetura de Tokens em Três Camadas (Por Extenso)

Nenhuma cor de estado deve ser referenciada de forma ad-hoc ou com classes de cores brutas do Tailwind (`bg-yellow-500`, `text-blue-700`, etc.) no código de componentes e telas. O sistema adota a hierarquia estrita de 3 camadas:

```
[ Camada 1: Primitives (HSL Bruto) ]
               │
               ▼
[ Camada 2: Semantics (Significado de Negócio & Modo Light/Dark) ]
               │
               ▼
[ Camada 3: Component Specs (StatusBadge, PriorityBadge, SLABadge, Recharts) ]
```

---

### Camada 1 — Primitives (Paleta Primitiva HSL)

Valores absolutos em HSL sem associação semântica de negócio:

```css
/* Escala Primitiva de Cores (HSL) */
--color-slate-50: 210 40% 98%;
--color-slate-100: 210 40% 96%;
--color-slate-200: 214 32% 91%;
--color-slate-300: 213 27% 84%;
--color-slate-400: 215 20% 65%;
--color-slate-500: 215 16% 47%;
--color-slate-600: 215 19% 35%;
--color-slate-700: 215 25% 27%;
--color-slate-800: 217 33% 17%;
--color-slate-900: 222 47% 11%;
--color-slate-950: 222 47% 7%;

--color-blue-500: 217 91% 60%;      /* #3b82f6 */
--color-blue-600: 221 83% 53%;      /* #2563eb */
--color-blue-700: 224 76% 48%;      /* #1d4ed8 */

--color-cyan-500: 189 94% 43%;      /* #06b6d4 - Primário para "Em Atendimento" */
--color-cyan-600: 192 91% 36%;      /* #0891b2 */
--color-cyan-400: 187 92% 69%;      /* #22d3ee */

--color-purple-500: 271 91% 65%;    /* #a855f7 */
--color-purple-600: 271 81% 56%;    /* #9333ea */
--color-purple-700: 272 72% 47%;    /* #7e22ce */

--color-indigo-500: 239 84% 67%;    /* #6366f1 */
--color-indigo-600: 243 75% 59%;    /* #4f46e5 */
--color-indigo-700: 244 58% 51%;    /* #4338ca */

--color-emerald-500: 152 69% 45%;   /* #19b36a */
--color-emerald-600: 158 64% 52%;   /* #10b981 */
--color-emerald-700: 160 84% 39%;   /* #047857 */

--color-amber-500: 38 92% 50%;      /* #f59e0b */
--color-amber-600: 32 95% 44%;      /* #d97706 */
--color-amber-700: 26 90% 37%;      /* #b45309 */

--color-orange-500: 24 95% 53%;     /* #f97316 */
--color-orange-600: 20 90% 48%;     /* #ea580c */
--color-orange-700: 17 88% 40%;     /* #c2410c */

--color-rose-500: 350 89% 60%;      /* #f43f5e */
--color-rose-600: 347 77% 50%;      /* #e11d48 */
--color-rose-700: 345 83% 41%;      /* #be123c */
```

---

### Camada 2 — Semantics (Tokens de Estado com Propósito de Negócio)

Tokens HSL semânticos em `src/index.css` e `tailwind.config.ts`, calibrados para cumprir contraste WCAG 2.1 AA (mínimo 4.5:1 para texto e 3:1 para bordas/gráficos):

```css
:root {
  /* ── ESTADOS DE CHAMADO (STATUS) ── */
  /* Aberto (Na fila inicial) */
  --state-open-fg: 224 76% 40%;           /* Blue 700 - Contraste 5.8:1 */
  --state-open-bg: 217 91% 60% / 0.12;
  --state-open-border: 217 91% 60% / 0.25;
  --state-open-dot: 217 91% 60%;

  /* Em Atendimento (Trabalho Ativo Saudável - Proposta Sky/Cyan) */
  --state-progress-fg: 192 91% 32%;       /* Cyan 700 - Contraste 5.2:1 */
  --state-progress-bg: 189 94% 43% / 0.12;
  --state-progress-border: 189 94% 43% / 0.25;
  --state-progress-dot: 189 94% 43%;

  /* Aguardando Cliente (Pausa de SLA pelo solicitante) */
  --state-awaiting-cust-fg: 272 72% 40%;  /* Purple 700 - Contraste 5.6:1 */
  --state-awaiting-cust-bg: 271 91% 65% / 0.12;
  --state-awaiting-cust-border: 271 91% 65% / 0.25;
  --state-awaiting-cust-dot: 271 91% 65%;

  /* Aguardando Terceiro (Pausa de SLA por fornecedor) */
  --state-awaiting-third-fg: 244 58% 44%; /* Indigo 700 - Contraste 5.1:1 */
  --state-awaiting-third-bg: 239 84% 67% / 0.12;
  --state-awaiting-third-border: 239 84% 67% / 0.25;
  --state-awaiting-third-dot: 239 84% 67%;

  /* Resolvido (Solução entregue) */
  --state-resolved-fg: 160 84% 30%;       /* Emerald 700 - Contraste 5.4:1 */
  --state-resolved-bg: 152 69% 45% / 0.12;
  --state-resolved-border: 152 69% 45% / 0.25;
  --state-resolved-dot: 152 69% 45%;

  /* Concluído (Fechamento definitivo - Neutro) */
  --state-closed-fg: 215 25% 35%;         /* Slate 600 - Contraste 6.1:1 */
  --state-closed-bg: 215 20% 65% / 0.12;
  --state-closed-border: 215 20% 65% / 0.25;
  --state-closed-dot: 215 20% 65%;

  /* Reaberto (Incidente reincidente) */
  --state-reopened-fg: 17 88% 36%;        /* Orange 700 - Contraste 5.2:1 */
  --state-reopened-bg: 24 95% 53% / 0.12;
  --state-reopened-border: 24 95% 53% / 0.25;
  --state-reopened-dot: 24 95% 53%;

  /* Cancelado (Descarte neutro) */
  --state-cancelled-fg: 215 19% 40%;      /* Slate 500 neutro */
  --state-cancelled-bg: 215 20% 65% / 0.10;
  --state-cancelled-border: 215 20% 65% / 0.20;
  --state-cancelled-dot: 215 19% 50%;

  /* ── NÍVEIS DE PRIORIDADE ── */
  --priority-urgent-fg: 345 83% 38%;     /* Rose 700 */
  --priority-urgent-bg: 350 89% 60% / 0.12;
  --priority-urgent-border: 350 89% 60% / 0.30;

  --priority-high-fg: 17 88% 36%;        /* Orange 700 */
  --priority-high-bg: 24 95% 53% / 0.12;
  --priority-high-border: 24 95% 53% / 0.30;

  --priority-medium-fg: 26 90% 34%;      /* Amber 700 */
  --priority-medium-bg: 38 92% 50% / 0.12;
  --priority-medium-border: 38 92% 50% / 0.30;

  --priority-low-fg: 215 25% 35%;        /* Slate 600 */
  --priority-low-bg: 215 20% 65% / 0.12;
  --priority-low-border: 215 20% 65% / 0.25;

  /* ── ESTADOS DE SLA ── */
  --sla-ok-fg: 160 84% 30%;
  --sla-ok-bg: 152 69% 45% / 0.12;
  --sla-ok-border: 152 69% 45% / 0.30;

  --sla-warning-fg: 26 90% 34%;          /* Amber 700 (<=25% tempo) */
  --sla-warning-bg: 38 92% 50% / 0.12;
  --sla-warning-border: 38 92% 50% / 0.30;

  --sla-attention-fg: 17 88% 36%;        /* Orange 700 (<=10% ou <=2h) */
  --sla-attention-bg: 24 95% 53% / 0.15;
  --sla-attention-border: 24 95% 53% / 0.35;

  --sla-breached-fg: 345 83% 38%;        /* Rose 700 (Vencido) */
  --sla-breached-bg: 350 89% 60% / 0.15;
  --sla-breached-border: 350 89% 60% / 0.35;
}

.dark {
  /* Ajuste automático para superfícies escuras (fundos com opacidade / texto em luminância elevada) */
  --state-open-fg: 217 91% 70%;
  --state-open-bg: 217 91% 60% / 0.15;
  --state-open-border: 217 91% 60% / 0.30;

  --state-progress-fg: 187 92% 65%;
  --state-progress-bg: 189 94% 43% / 0.15;
  --state-progress-border: 189 94% 43% / 0.30;

  --state-awaiting-cust-fg: 271 91% 75%;
  --state-awaiting-cust-bg: 271 91% 65% / 0.15;
  --state-awaiting-cust-border: 271 91% 65% / 0.30;

  --state-awaiting-third-fg: 239 84% 75%;
  --state-awaiting-third-bg: 239 84% 67% / 0.15;
  --state-awaiting-third-border: 239 84% 67% / 0.30;

  --state-resolved-fg: 158 64% 60%;
  --state-resolved-bg: 152 69% 45% / 0.15;
  --state-resolved-border: 152 69% 45% / 0.30;

  --state-closed-fg: 215 20% 65%;
  --state-closed-bg: 215 20% 65% / 0.15;
  --state-closed-border: 215 20% 65% / 0.30;

  --state-reopened-fg: 24 95% 65%;
  --state-reopened-bg: 24 95% 53% / 0.15;
  --state-reopened-border: 24 95% 53% / 0.30;

  --state-cancelled-fg: 215 20% 60%;
  --state-cancelled-bg: 215 20% 65% / 0.12;
  --state-cancelled-border: 215 20% 65% / 0.25;

  --priority-urgent-fg: 350 89% 70%;
  --priority-high-fg: 24 95% 65%;
  --priority-medium-fg: 38 92% 65%;
  --priority-low-fg: 215 20% 65%;

  --sla-ok-fg: 158 64% 60%;
  --sla-warning-fg: 38 92% 65%;
  --sla-attention-fg: 24 95% 65%;
  --sla-breached-fg: 350 89% 70%;
}
```

---

## 2. Especificação por Componente e Estados Interativos

### 2.1. Geometria Canônica Compartilhada

Todos os badges do sistema compartilham a mesma geometria de base, garantindo alinhamento horizontal perfeito em linhas de tabela e cabeçalhos:

```css
/* Geometria Compartilhada Obrigatória */
height: 1.5rem (24px - h-6);
padding: 0 0.625rem (10px - px-2.5);
border-radius: 9999px (rounded-full);
font-size: 0.75rem (12px - text-xs);
font-weight: 600 (font-semibold);
gap: 0.375rem (6px - gap-1.5);
white-space: nowrap (whitespace-nowrap); /* IMPEDE QUEBRA EM 2 LINHAS */
display: inline-flex;
align-items: center;
justify-content: center;
```

---

### 2.2. Tabela de Estados Interativos

Para componentes com interação (`StatusBadge`, `PriorityBadge`, `SLABadge` quando interativos ou em filtros):

| Propriedade | Default | Hover | Focus | Disabled |
| :--- | :--- | :--- | :--- | :--- |
| **Background** | `bg-[var(--state-*-bg)]` | `bg-[var(--state-*-bg)]` com +5% opacidade | `bg-[var(--state-*-bg)]` | `opacity-50` |
| **Text** | `text-[var(--state-*-fg)]` | `text-[var(--state-*-fg)]` | `text-[var(--state-*-fg)]` | `text-muted-foreground` |
| **Border** | `border border-[var(--state-*-border)]` | `border-[var(--state-*-border)]` (+10% opacidade) | `ring-2 ring-primary/40 ring-offset-1` | `border-border/30` |
| **Dot / Ícone** | `w-1.5 h-1.5 rounded-full` ou `w-3.5 h-3.5` | Escala 1.05 com transição suave | Conforme default | `opacity-40` |

---

## 3. Fonte Única de Verdade (`src/lib/state-tokens.ts`)

Será criado o arquivo `src/lib/state-tokens.ts` contendo os dicionários canônicos de todas as dimensões. Componentes visuais e gráficos Recharts consumirão exclusivamente essa definição:

```typescript
export type TicketStatusKey = 
  | 'open' 
  | 'in-progress' 
  | 'awaiting-customer' 
  | 'awaiting-third-party' 
  | 'resolved' 
  | 'closed' 
  | 'reopened' 
  | 'cancelled';

export type TicketPriorityKey = 'urgent' | 'high' | 'medium' | 'low';
export type SLAStatusKey = 'ok' | 'warning' | 'attention' | 'breached';

export interface StateConfig {
  key: string;
  label: string;
  badgeClass: string;
  dotColor: string;
  rechartsColor: string;
  iconName?: string;
  ariaLabel: string;
}

export const TICKET_STATUS_MAP: Record<TicketStatusKey, StateConfig> = {
  'open': {
    key: 'open',
    label: 'Aberto',
    badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-400 dark:border-blue-500/30',
    dotColor: 'bg-blue-500',
    rechartsColor: '#3b82f6',
    ariaLabel: 'Status: Chamado Aberto',
  },
  'in-progress': {
    key: 'in-progress',
    label: 'Em Atendimento',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/25 dark:text-cyan-400 dark:border-cyan-500/30',
    dotColor: 'bg-cyan-500',
    rechartsColor: '#06b6d4',
    ariaLabel: 'Status: Em Atendimento Ativo',
  },
  'awaiting-customer': {
    key: 'awaiting-customer',
    label: 'Aguard. Cliente',
    badgeClass: 'bg-purple-500/10 text-purple-700 border-purple-500/25 dark:text-purple-400 dark:border-purple-500/30',
    dotColor: 'bg-purple-500',
    rechartsColor: '#a855f7',
    ariaLabel: 'Status: Aguardando Resposta do Cliente (SLA Pausado)',
  },
  'awaiting-third-party': {
    key: 'awaiting-third-party',
    label: 'Aguard. Terceiro',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-400 dark:border-indigo-500/30',
    dotColor: 'bg-indigo-500',
    rechartsColor: '#6366f1',
    ariaLabel: 'Status: Aguardando Fornecedor Externo (SLA Pausado)',
  },
  'resolved': {
    key: 'resolved',
    label: 'Resolvido',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400 dark:border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    rechartsColor: '#10b981',
    ariaLabel: 'Status: Chamado Resolvido',
  },
  'closed': {
    key: 'closed',
    label: 'Concluído',
    badgeClass: 'bg-muted text-muted-foreground border-border/60',
    dotColor: 'bg-muted-foreground',
    rechartsColor: '#94a3b8',
    ariaLabel: 'Status: Chamado Concluído e Histórico Consolidado',
  },
  'reopened': {
    key: 'reopened',
    label: 'Reaberto',
    badgeClass: 'bg-orange-500/10 text-orange-700 border-orange-500/25 dark:text-orange-400 dark:border-orange-500/30',
    dotColor: 'bg-orange-500',
    rechartsColor: '#f97316',
    ariaLabel: 'Status: Chamado Reaberto por Reincidência',
  },
  'cancelled': {
    key: 'cancelled',
    label: 'Cancelado',
    badgeClass: 'bg-muted/80 text-muted-foreground/80 border-border/40',
    dotColor: 'bg-muted-foreground/60',
    rechartsColor: '#64748b',
    ariaLabel: 'Status: Chamado Cancelado ou Descartado',
  },
};

export const TICKET_PRIORITY_MAP: Record<TicketPriorityKey, StateConfig> = {
  'urgent': {
    key: 'urgent',
    label: 'Urgente',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15 dark:border-destructive/40 font-bold',
    dotColor: 'bg-destructive',
    rechartsColor: '#ef4444',
    ariaLabel: 'Prioridade: Urgente',
  },
  'high': {
    key: 'high',
    label: 'Alta',
    badgeClass: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400 dark:border-orange-500/40',
    dotColor: 'bg-orange-500',
    rechartsColor: '#f97316',
    ariaLabel: 'Prioridade: Alta',
  },
  'medium': {
    key: 'medium',
    label: 'Média',
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/40',
    dotColor: 'bg-amber-500',
    rechartsColor: '#f59e0b',
    ariaLabel: 'Prioridade: Média',
  },
  'low': {
    key: 'low',
    label: 'Baixa',
    badgeClass: 'bg-muted text-muted-foreground border-border/50',
    dotColor: 'bg-muted-foreground',
    rechartsColor: '#94a3b8',
    ariaLabel: 'Prioridade: Baixa',
  },
};

export const SLA_STATUS_MAP: Record<SLAStatusKey, StateConfig> = {
  'ok': {
    key: 'ok',
    label: 'No prazo',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    rechartsColor: '#10b981',
    ariaLabel: 'SLA: No prazo',
  },
  'warning': {
    key: 'warning',
    label: 'Atenção',
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    rechartsColor: '#f59e0b',
    ariaLabel: 'SLA: Atenção (<= 25% tempo restante)',
  },
  'attention': {
    key: 'attention',
    label: 'Crítico',
    badgeClass: 'bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-400',
    dotColor: 'bg-orange-500',
    rechartsColor: '#f97316',
    ariaLabel: 'SLA: Crítico (<= 10% tempo restante ou menos de 2 horas)',
  },
  'breached': {
    key: 'breached',
    label: 'Vencido',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/40 font-bold',
    dotColor: 'bg-destructive',
    rechartsColor: '#ef4444',
    ariaLabel: 'SLA: Vencido / Estourado',
  },
};
```

---

## 4. Tabela de Migração Completa

| Dimensão | Valor | Cor / Visual Atual | Token & Visual Proposto | Arquivos Afetados (Nº) | Risco & Mitigação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Status** | `in-progress` | `bg-yellow-500` (Âmbar/Amarelo) | `bg-cyan-500/10 text-cyan-700 dark:text-cyan-400` (Cyan/Sky) | `StatusBadge.tsx`, `WorkloadChart.tsx`, `Reports.tsx`, `TechnicianDashboard.tsx` (8 arquivos) | **Médio**: Desacopla o status operacional saudável de alertas e de prioridade média. Recharts passa a usar `#06b6d4`. |
| **Status** | `awaiting-customer` | `bg-purple-500` (conflito c/ Primary) | `bg-purple-500/10 text-purple-700 dark:text-purple-400` | `StatusBadge.tsx`, `Reports.tsx`, `Index.tsx` (5 arquivos) | **Baixo**: Mantém a família roxa mas sincroniza 100% com as fatias do Recharts. |
| **Status** | `cancelled` | `bg-destructive/10 text-destructive` | `bg-muted/80 text-muted-foreground/80 border-border/40` (Neutro) | `StatusBadge.tsx`, `Reports.tsx` (4 arquivos) | **Baixo**: Deixa o destrutivo (vermelho) apenas para SLA vencido e prioridade urgente. |
| **Prioridade** | `low` | `#22c55e` (Verde em Recharts) | `bg-muted text-muted-foreground` / `#94a3b8` (Cinza neutro) | `aggregations.ts`, `PriorityBadge.tsx`, `Reports.tsx` (4 arquivos) | **Baixo**: Elimina a confusão entre chamado aberto de baixa gravidade e chamado resolvido/no prazo. |
| **SLA** | Todas | Indicador solto (dot + texto) | `SLABadge` canônico com altura `h-6`, ícone Lucide e `whitespace-nowrap` | `TechnicianDashboard.tsx`, `SLABadge.tsx`, `TicketHeroHeader.tsx` (6 arquivos) | **Baixo**: Unifica a linha de tabela eliminando a deformação vertical. |
| **Geometria** | Todas | `badgeVariants` sem `whitespace-nowrap` | Adição de `whitespace-nowrap` e `h-6` no CVA canônico | `src/components/ui/badge.tsx`, `StatusBadge.tsx`, `PriorityBadge.tsx`, `SLABadge.tsx` (4 arquivos) | **Zero risco**: Impede em definitivo que "Em Atendimento" quebre em 2 linhas. |
| **Recharts** | Todas | Cores hex hardcoded e invertidas | Consumo de `TICKET_STATUS_MAP[status].rechartsColor` | `WorkloadChart.tsx`, `Reports.tsx`, `Index.tsx` (4 arquivos) | **Baixo**: Gráficos e tabelas passam a refletir exatamente as mesmas cores. |
| **Mapas Locais** | Todas | 31 ocorrências de `switch/if` com classes literais | Substituição direta por `<StatusBadge>`, `<PriorityBadge>`, `<SLABadge>` | `Assets.tsx`, `WebMonitoring.tsx`, `DebugTools.tsx`, `AlertsDashboard.tsx` (12 arquivos) | **Baixo**: Remoção de dead code e mapas ad-hoc duplicados. |

---

## 5. Decisões Necessárias (Decisões de Design Submetidas ao Usuário)

### Decisão 1: "Em Atendimento" sai do âmbar para qual família cromática?
- **Problema Atual:** Quando um chamado está "Em Atendimento", ele está com um técnico trabalhando ativamente nele (estado normal e saudável). Hoje ele é amarelo/âmbar (`bg-yellow-500`), gerando uma colisão crítica com prioridade "Média" (âmbar) e SLA em risco (âmbar), criando alerta visual excessivo e falso cansaço.
- **Opção A (Recomendada — Cyan/Sky):**
  - **Prós:** O tom Ciano/Azul-Piscina (`#06b6d4` / `text-cyan-700 dark:text-cyan-400`) transmite trabalho ativo, frescor e progresso contínuo sem sugerir alarme. Desacopla 100% de botões primários e de alertas.
  - **Contras:** Introduz o tom Cyan nos tokens de status.
- **Opção B (Roxo de Marca / Primary):**
  - **Prós:** Já é utilizado atualmente na fatia de "Em Atendimento" do Recharts em `WorkloadChart.tsx`.
  - **Contras:** Compete visualmente com botões de CTA primários (`Button variant="default"`), com o cabeçalho e com "Aguardando Cliente".

> **Recomendação:** **Opção A (Cyan/Sky)**.

---

### Decisão 2: Tratamento de Chamados "Cancelados"
- **Problema Atual:** Hoje o `StatusBadge` pinta chamados "Cancelados" de vermelho (`destructive`). Cancelamento é um encerramento administrativo neutro, e o vermelho deve ser reservado para SLA Vencido ou Alerta Crítico.
- **Opção A (Recomendada):** Mudar "Cancelado" para cinza neutro apagado (`bg-muted/60 text-muted-foreground/70 border-border/40`), mantendo o vermelho exclusivamente para emergências operacionais.
- **Opção B:** Manter vermelho suave (`bg-destructive/10 text-destructive`).

> **Recomendação:** **Opção A (Neutro)**.

---

### Decisão 3: SLA na Tabela do Dashboard Técnico
- **Problema Atual:** Na tabela de chamados do técnico (`TechnicianDashboard.tsx`), o SLA é renderizado como um ponto solto piscando com texto sem fundo ("1h 45m"), contrastando com os badges de Status e Prioridade.
- **Opção A (Recomendada):** Transformar em `SLABadge` padrão (`h-6 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap gap-1.5`) com ícone de relógio e cor semântica.
- **Opção B:** Manter o estilo inline minimalista, mas com padding e tipografia sincronizados com a linha.

> **Recomendação:** **Opção A (`SLABadge` canônico)**.

---

## 6. Prevenção de Regressão

Para garantir que desenvolvedores ou agentes não voltem a escrever classes literais (`bg-yellow-500`, `text-purple-600`) ou hexadecimais soltos fora da arquitetura de tokens:

1. **Script de Auditoria de Tokens em Build (`npm run verify:tokens`):**
   - Criação de script leve em TypeScript/Node (`scripts/verify-tokens.ts`) executado no `npm run build` e em CI.
   - O script varre `src/components/` e `src/pages/` e falha o processo caso encontre:
     - Classes como `bg-yellow-*`, `bg-purple-*`, `bg-blue-*`, `bg-emerald-*` em tags de badge.
     - Strings hexadecimais literais (`#3b82f6`, `#906090`) em arquivos fora de `src/lib/state-tokens.ts` e `src/index.css`.
2. **Export Canônico:** Toda cor de gráfico consumirá o método `getRechartsColor(status)` exportado por `src/lib/state-tokens.ts`.

---

## 🛑 GATE DE APROVAÇÃO (PARADA OBRIGATÓRIA)

Por favor, revise as decisões acima e indique como deseja prosseguir:
1. **Decisão 1:** Opção A (Cyan/Sky) ou Opção B (Roxo/Primary) para "Em Atendimento"?
2. **Decisão 2:** Opção A (Neutro) ou Opção B (Vermelho) para "Cancelado"?
3. **Decisão 3:** Opção A (`SLABadge` canônico) ou Opção B (Inline ajustado)?
4. **Autorização:** Aprovado para prosseguir com a **Fase 2 (Implementação por Lotes)**?
