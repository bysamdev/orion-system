# CONTRATO DE DESIGN SYSTEM — PROPOSTA DE PADRONIZAÇÃO (UI/UX)
**Orion System** — Relatório Consolidado de Auditoria e Especificação Canônica
**Data da Auditoria:** 31/08/2026 | **Fase:** 1.5 — Consolidação (Read-Only)

---

## SUMÁRIO EXECUTIVO

A auditoria completa da camada visual do Orion System identificou **3.400+ pontos de inconsistência** distribuídos em 185 arquivos do `src/`. A causa raiz é a convivência de três gerações de código:
1. **Configuração padrão do shadcn/ui** (`--radius: 0.5rem`, botões `h-10 rounded-md`, `AlertDialog` `rounded-lg`).
2. **Customizações intermediárias pontuais** aplicadas direto no `className` das páginas (`rounded-xl`, `rounded-2xl`, `rounded-3xl`, alturas `h-8` a `h-14`, paddings manuais).
3. **Cores estáticas utilitárias do Tailwind** (1.364 ocorrências de `emerald-*`, `amber-*`, `red-*`, `purple-*`, `blue-*`) em vez de tokens semânticos (`success`, `warning`, `destructive`, `primary`, `accent`).

Este documento consolida os achados dos 8 subagentes de auditoria, estabelece o **Contrato Canônico de 3 Camadas** para unificar a identidade visual (preservando 100% da estética *cyber/glassmorphism/dark/cyan*), define o **Plano de Migração em 6 Lotes Independentes** e apresenta a **Lista de Decisões Abertas** para validação pelo Sam.

---

## A. DIAGNÓSTICO QUANTITATIVO CONSOLIDADO

### 1. Botões e Ações (296 botões mapeados em 185 arquivos)
| Propriedade | Valores distintos encontrados | Ocorrências | Candidato canônico |
|---|---|---|---|
| **Tipo de Elemento** | `<Button>` (shadcn) vs `<button>` cru | 250 shadcn (84,5%) / 46 nativo (15,5%) | `<Button>` (100% dos casos com ação) |
| **Altura de Botão** | `h-6`, `h-7`, `h-8`, `h-9`, `h-10`, `h-11`, `h-12`, `h-14`, `h-32`, `h-auto`, `h-full` (11 valores) | 129 (`h-10`), 84 (`h-9`), 44 (`h-8`), 11 (`h-7`), 8 (`h-11`), 5 (`h-12`), 15 outros | **`h-9` (36px - sm/padrão denso)** e **`h-10` (40px - md/padrão)** |
| **Border Radius** | `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`, `rounded-none` (6 valores) | 188 (`rounded-md`), 55 (`rounded-xl`), 28 (`rounded-lg`), 16 (`rounded-full`), 9 outros | **`rounded-xl` (12px)** para manter coerência com cards |
| **Padding Horizontal** | Implícito CVA (199), `px-3` (32), `px-4` (24), `px-2` (18), `p-0` (12), `px-6` (6), outros (5) | 15 valores manuais / 97 overrides | **CVA centralizado (`px-3` em sm, `px-4` em md, `px-6` em lg)** |
| **Icon-Only Buttons** | Sem `aria-label`/`title` (18), Área de toque < 44px (42 de 44) | 44 botões de ícone | **`aria-label` obrigatório + min-h-[36px]/min-w-[36px] com wrapper touch 44px** |

---

### 2. Cards, Superfícies e Containers (299 instâncias em 43 arquivos)
| Propriedade | Valores distintos encontrados | Ocorrências | Candidato canônico |
|---|---|---|---|
| **Radius de Superfície** | `rounded-xl` (220), `rounded-lg` (133), `rounded-full` (121), `rounded-md` (43), `rounded` (26), `rounded-2xl` (13), `rounded-3xl` (2) | 7 valores / 558 nós | **`rounded-xl` (12px)** para cards padrão; **`rounded-2xl` (16px)** para modais/painéis |
| **Padding Interno** | `p-4` (104), `p-6` (45), `p-3` (37), `p-2` (36), `p-0` (25), `p-3.5` (20), `p-5` (18), `p-2.5` (17), `p-8` (15) | 9 valores principais | **`p-4` (compacto/dashboards)** e **`p-6` (padrão/seções completas)** |
| **Opacidade de Fundo** | `bg-card` (58), `bg-muted/20` (44), `bg-muted/30` (40), `bg-primary/10` (37), `bg-muted` (26), `bg-muted/10` (22) | 18 variações de alpha | **Token `--surface-card` (`bg-card/60 backdrop-blur-md`)** |
| **Bordas** | `border` (240), `border-border/40` (148), `border-border/50` (47), `border-border/60` (26), `border-border` (24) | 5 níveis de opacidade | **`border border-border/40` (padrão ouro do Orion)** |
| **Inversão de Raio Aninhado** | Card pai `rounded-lg` (8px) com filho `rounded-xl` (12px) | **49 ocorrências críticas** | **Regra $R_{filho} \le R_{pai} - Padding$** |

---

### 3. Controles de Formulário (239 controles em 41 arquivos)
| Propriedade | Valores distintos encontrados | Ocorrências | Candidato canônico |
|---|---|---|---|
| **Altura de Input** | `h-7`, `h-8`, `h-9`, `h-10`, `h-11`, `h-12`, `h-14` (7 valores) | 162 (`h-10`), 48 (`h-9`), 14 (`h-11`), 8 (`h-8`), 7 outros | **`h-10` (40px padrão)** e **`h-9` (36px inline/tabelas)** |
| **Radius de Input** | `rounded-md` (142), `rounded-xl` (51), `rounded-lg` (23), `rounded-2xl` (12), `rounded-full` (11) | 6 valores distintos | **`rounded-xl` (12px)** |
| **Acessibilidade (Labels)** | Controles sem associação de label (173 / 72,4%), com label visual mas sem `id`/`htmlFor` (90) | 173 controles órfãos | **`<Label htmlFor={id}>` obrigatório em 100% dos inputs** |
| **Focus Ring** | `ring-ring` (84), `ring-primary/20` (32), `ring-primary/30` (18), `ring-amber-500/30` (6) | 4 estilos de anel | **`focus-visible:ring-2 focus-visible:ring-primary/50`** |
| **Componentes Faltantes** | `SearchInput`, `DatePicker`, `Combobox`, `RadioGroup` | 8 reimplementações ad-hoc | **Criar componentes canônicos em `src/components/ui/`** |

---

### 4. Overlays e Feedback (Dialog, AlertDialog, Popover, Tooltip, Badges, Toasts)
| Propriedade | Valores distintos encontrados | Ocorrências | Candidato canônico |
|---|---|---|---|
| **Radius de Overlays** | `Dialog` (`rounded-xl`), `AlertDialog` (`rounded-lg`), `Popover`/`Tooltip` (`rounded-md`) | 3 geometrias conflitantes | **`rounded-2xl` para Dialog/Alert; `rounded-xl` para Popover/Dropdown; `rounded-lg` para Tooltip** |
| **Motor de Notificação** | Radix `useToast` (37 arquivos) vs `Sonner` (9 arquivos) | **2 motores montados juntos no App.tsx** | **? — DECISÃO NECESSÁRIA (Opção A: Unificar em Sonner; Opção B: Unificar em Radix)** |
| **Badges de Status** | 4 estilos para "Online", 3 estilos para "Offline", descoloração monocromática em Assets | 35 arquivos com badges manuais | **Componente `<StatusBadge status="..." />` centralizado com CVA** |
| **Alertas Inline** | 49 caixas de alerta ad-hoc criadas com `<div>` manual por falta de variantes no `<Alert>` | 18 arquivos | **Adicionar variantes `warning`, `info`, `success` ao `alert.tsx`** |

---

### 5. Tipografia, Ícones e Cores
| Propriedade | Valores distintos encontrados | Ocorrências | Candidato canônico |
|---|---|---|---|
| **Microtipografia Arbitrária** | `text-[10px]` (251), `text-[11px]` (94), `text-[9px]` (51), `text-[13px]` (12) | **408 ocorrências fora da escala** | **Tokens `text-2xs` (10px) e `text-micro` (9px)** |
| **Pesos Tipográficos** | `font-bold` (525), `font-semibold` (203), `font-black` (105), `font-medium` (155), `font-normal` (8) | 996 ocorrências | **Normalizar: `font-medium` (corpo/inputs), `font-semibold` (cards/subtítulos), `font-bold` (títulos/headers)** |
| **Tamanhos de Ícone** | `w-4 h-4` (301), `w-3.5 h-3.5` (150), `w-5 h-5` (79), `w-3 h-3` (68), `w-8 h-8` (35), `w-2.5 h-2.5` (19) | 712 ícones mapeados | **Escala canônica: `w-3` (12px badge), `w-4` (16px botão/tabela), `w-5` (20px header), `w-8` (32px hero)** |
| **Cores Tailwind Hardcoded** | `emerald` (344), `amber` (310), `red` (237), `green` (88), `blue` (82), `indigo` (69), `rose` (48), `orange` (39), `purple` (33) | **1.364 ocorrências em 60 arquivos** | **Substituição 100% por tokens `success`, `warning`, `destructive`, `primary`, `accent`, `info`** |

---

### 6. Acessibilidade e Responsividade
| Propriedade | Valores distintos encontrados | Ocorrências | Candidato canônico |
|---|---|---|---|
| **Falha de Contraste WCAG AA** | `text-muted-foreground/50` e `/60` (contraste ~2.0:1 vs 4.5:1 exigido) | 25+ arquivos críticos | **`text-muted-foreground/80` (mínimo) ou `text-muted-foreground` puro** |
| **SLA Badge Dark Mode** | Classes fixas `text-*-700` sem variante `dark:` (contraste 2.38:1 em fundo escuro) | `SLABadge.tsx` | **Adicionar variantes semânticas para dark mode (`dark:text-*-400`)** |
| **Affordance Exclusiva de Hover** | Ações críticas ocultas com `opacity-0 group-hover:opacity-100` | 8 telas (tabelas e cards) | **Ícones visíveis com opacidade reduzida (`opacity-40 hover:opacity-100 group-hover:opacity-100`)** |
| **Movimento Reduzido** | Animações Framer Motion e transitions Tailwind sem `motion-reduce` | 32 componentes animados | **`MotionConfig reducedMotion="user"` global + `motion-reduce:transition-none`** |

---

## B. CONTRATO DE DESIGN PROPOSTO (ARQUITETURA DE 3 CAMADAS)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PRIMITIVE TOKENS (Valores brutos: HSL, PX, REM)         │
├─────────────────────────────────────────────────────────────┤
│ 2. SEMANTIC TOKENS (Aliases: --surface-card, --success...)  │
├─────────────────────────────────────────────────────────────┤
│ 3. COMPONENT TOKENS (CVA Specs: Button, Input, Table...)    │
└─────────────────────────────────────────────────────────────┘
```

### 1. Camada Primitiva (Raw Tokens)

```css
/* Escala de Raio Canônica */
--radius-xs: 0.25rem;  /* 4px - micro tags */
--radius-sm: 0.375rem; /* 6px - tooltips */
--radius-md: 0.5rem;   /* 8px - badges / subcontroles */
--radius-lg: 0.625rem; /* 10px */
--radius-xl: 0.75rem;  /* 12px - botões / inputs / cards padrão */
--radius-2xl: 1rem;    /* 16px - modais / painéis principais */
--radius-3xl: 1.5rem;  /* 24px - hero cards destacados */
--radius-full: 9999px; /* pills / avatars */

/* Escala de Tipografia Adicional no Tailwind */
fontSize: {
  'micro': ['0.5625rem', { lineHeight: '0.75rem' }], /* 9px */
  '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   /* 10px */
  'xs': ['0.75rem', { lineHeight: '1rem' }],         /* 12px */
  'sm': ['0.875rem', { lineHeight: '1.25rem' }],     /* 14px */
  'base': ['1rem', { lineHeight: '1.5rem' }],         /* 16px */
}
```

---

### 2. Camada Semântica (Semantic Tokens)

```css
:root {
  /* Status Semânticos (Modo Claro) */
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 100%;
  --info: 199 89% 48%;
  --info-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  /* Superfícies & Glassmorphism */
  --surface-card: 0 0% 100% / 0.85;
  --surface-panel: 0 0% 98% / 0.95;
  --surface-border: 240 5.9% 90% / 0.6;
  --focus-ring: var(--primary) / 0.5;
}

.dark {
  /* Status Semânticos (Modo Escuro) */
  --success: 142 70% 50%;
  --success-foreground: 144 61% 10%;
  --warning: 38 92% 55%;
  --warning-foreground: 26 83% 10%;
  --info: 199 89% 58%;
  --info-foreground: 200 98% 10%;
  --destructive: 0 72% 55%;
  --destructive-foreground: 0 85% 97%;

  /* Superfícies & Glassmorphism */
  --surface-card: 240 10% 4% / 0.6;
  --surface-panel: 240 10% 6% / 0.85;
  --surface-border: 240 3.7% 15.9% / 0.4;
  --focus-ring: var(--primary) / 0.6;
}
```

---

### 3. Camada de Componentes (Component Specs via CVA)

#### A. Button (`src/components/ui/button.tsx`)
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:shadow-primary/20",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-border/60 bg-background/50 backdrop-blur-sm hover:bg-accent/20 hover:text-accent-foreground hover:border-primary/40",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
      },
      size: {
        sm: "h-8 px-3 text-xs gap-1.5 rounded-lg min-w-[32px]",
        default: "h-9 px-4 text-sm gap-2 rounded-xl min-w-[36px]",
        lg: "h-11 px-6 text-base gap-2.5 rounded-xl min-w-[44px]",
        icon: "h-9 w-9 p-0 rounded-xl",
        "icon-sm": "h-8 w-8 p-0 rounded-lg",
        "icon-xs": "h-7 w-7 p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

#### B. Input & Controles (`src/components/ui/input.tsx`)
```typescript
const inputClasses = "flex h-9 w-full rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50";
```

#### C. Card & Superfícies (`src/components/ui/card.tsx`)
```typescript
const cardClasses = "rounded-xl border border-border/40 bg-card/60 backdrop-blur-md text-card-foreground shadow-sm transition-all";
```

#### D. Table (`src/components/ui/table.tsx`)
- **`TableHead`:** `h-10 px-4 text-left align-middle text-2xs uppercase font-bold tracking-wider text-muted-foreground/80 bg-muted/20 border-b border-border/40`
- **`TableCell`:** `p-3.5 align-middle text-sm border-b border-border/20`
- **`TableRow`:** `hover:bg-muted/30 data-[state=selected]:bg-muted/40 transition-colors`

---

## C. PLANO DE MIGRAÇÃO EM LOTES (IMPACTO VISUAL ÷ RISCO)

| Lote | Escopo | Arquivos Afetados | Linhas Alteradas (est.) | Risco de Regressão | Exige Decisão Prévia? |
|---|---|---|---|---|---|
| **Lote 1: Fundação & Tokens** | `tailwind.config.ts`, `src/index.css`, `src/App.css` (remoção), criação de `text-2xs`, `text-micro`, `--success`, `--warning`, `--info`, `.surface-glass` | 3 arquivos | ~80 linhas | **Muito Baixo (Zero quebra de runtime)** | Não (Alinhado) |
| **Lote 2: Componentes Base UI** | Padronização CVA em `src/components/ui/` (`button.tsx`, `card.tsx`, `input.tsx`, `table.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `badge.tsx`, `alert.tsx`) | 8 arquivos | ~220 linhas | **Baixo (Aditivo de variantes)** | Sim (Validar altura canônica) |
| **Lote 3: Novos Componentes Canônicos** | Criação de `<SearchInput>`, `<StatusBadge>`, `<TableEmptyState>`, `<TablePagination>`, `<DialogHeaderAction>` | 5 novos arquivos | ~350 linhas | **Muito Baixo (Novos componentes)** | Não |
| **Lote 4: Unificação de Cores Hardcoded** | Migração das 1.364 ocorrências de `emerald-*`, `amber-*`, `red-*` para tokens semânticos | 60 arquivos | ~1.400 linhas | **Baixo (Apenas classes CSS)** | Não |
| **Lote 5: Limpeza de Overrides nas Telas** | Remoção de classes inline redundantes (`rounded-3xl`, `h-10`, `border-border/40` manuais) em páginas | 45 arquivos | ~850 linhas | **Médio (Ajuste fino de layout)** | Não |
| **Lote 6: A11y, Touch Targets & Toaster** | Vínculo de `htmlFor`/`id` nos 173 inputs, touch wrapper 44px, unificação do motor de Toast | 41 arquivos | ~400 linhas | **Baixo** | Sim (Escolha do motor Toast) |

---

## D. PREVENÇÃO DE REGRESSÃO

Para garantir que a consistência visual seja mantida e nunca mais sofra degradação:

1. **Regra de Lint via ESLint / Tailwind Plugin:**
   - Adicionar regra no `.eslintrc.cjs` que proíbe classes de cores literais (`text-emerald-500`, `bg-amber-400`, etc.) em arquivos `.tsx` fora de `src/components/ui/` e `src/lib/constants/`.
   - Proibir tamanhos arbitrários de fonte (`text-[10px]`, `text-[11px]`) forçando o uso de `text-2xs` e `text-micro`.

2. **Centralização Estrita no `buttonVariants` e `badgeVariants`:**
   - Proibir a concatenação manual de `h-*` e `rounded-*` por cima de `<Button>` e `<Badge>`. O componente deve emitir aviso de tipo TypeScript se classes de dimensões conflitantes forem passadas.

3. **Automação no CI:**
   - Adicionar script `npm run check:design-tokens` no pre-commit / GitHub Actions para barrar PRs com novas cores hardcoded.

---

## E. LISTA DE PERGUNTAS ABERTAS E DECISÕES DO SAM

### ❓ Decisão 1: Altura Canônica Padrão dos Botões e Inputs
- **Contexto:** Hoje coexistem `h-9` (36px, 84 usos), `h-10` (40px, 129 usos) e `h-8` (32px, 44 usos).
- **Opção A (Recomendada):** `h-9` (36px) como tamanho `default` e `h-10` (40px) como `lg`. Isso otimiza a densidade da interface de monitoramento e alinha botões com inputs.
- **Opção B:** `h-10` (40px) como `default` e `h-9` (36px) como `sm`.
- *Custo de Migração:* Ambas têm custo idêntico (~40 arquivos ajustados via CVA).

### ❓ Decisão 2: Border Radius Principal de Superfície e Controles
- **Contexto:** Coexistem `rounded-md` (8px), `rounded-xl` (12px), `rounded-2xl` (16px) e casos isolados de `rounded-3xl` (24px).
- **Opção A (Recomendada):** `rounded-xl` (12px) para botões, inputs, cards e popovers; `rounded-2xl` (16px) para modais (`Dialog`/`AlertDialog`) e painéis hero; eliminar os `rounded-3xl` que causavam violação de padding.
- **Opção B:** `rounded-2xl` (16px) para tudo (estilo mais orgânico, exige aumentar paddings internos de cards para `p-6`).
- *Custo de Migração:* Opção A afeta ~30 arquivos; Opção B afeta ~75 arquivos.

### ❓ Decisão 3: Unificação do Motor de Toasts / Notificações
- **Contexto:** O projeto tem montados simultaneamente no `App.tsx` o `<Toaster />` do Radix (37 arquivos) e o `<Sonner />` (9 arquivos).
- **Opção A (Recomendada):** Padronizar 100% no **Sonner** (`toast.success()`, `toast.error()`). É mais moderno, empilha notificações elegantemente, tem melhor suporte a temas dark/glass e reduz bundle.
- **Opção B:** Padronizar 100% no **Radix UI `useToast`** (mantém a maior parte do código atual, mas visualmente mais engessado).
- *Custo de Migração:* Opção A exige migrar 37 chamadas em ~25 arquivos; Opção B exige migrar 9 chamadas em 6 arquivos.

### ❓ Decisão 4: Estratégia para Ações Ocultas em Tabelas (Hover vs Touch)
- **Contexto:** Botões de "Editar", "Excluir", "Implantar" em 8 tabelas usam `opacity-0 group-hover:opacity-100`, ficando invisíveis em iPads/touch.
- **Opção A (Recomendada):** Manter os botões sempre visíveis com opacidade atenuada (`opacity-40 hover:opacity-100 group-hover:opacity-100`). Mantém o visual limpo no desktop sem quebrar o uso touch.
- **Opção B:** Adicionar menu suspenso de 3 pontos (`DropdownMenu`) na última coluna para agrupar ações.
- *Custo de Migração:* Opção A afeta 8 arquivos (ajuste de classe); Opção B exige refatorar colunas de ações.

---

## 🛑 GATE DE APROVAÇÃO — PARADA OBRIGATÓRIA

A Fase 1 (Auditoria) e Fase 1.5 (Consolidação) estão concluídas de forma **100% READ-ONLY**. Nenhum arquivo de código em `src/` foi modificado.

Aguardando a revisão do Sam sobre as decisões abertas (Decisões 1 a 4) e aprovação para iniciar a **Fase 2 (Implementação por Lotes)**.
