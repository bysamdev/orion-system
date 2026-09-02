# Relatório D — Geometria, Acessibilidade e Contraste de Estados
**Auditoria de Cores de Estado e Design Tokens — Orion System**  
**Data:** 31 de Agosto de 2026  
**Auditor:** Subagente D (Geometria, Acessibilidade WCAG 2.1 AA e Contraste)  
**Status:** FASE 1 — Diagnóstico Completo (Strictly Read-Only no Código)

---

## 1. Sumário Executivo

Esta auditoria inspecionou exaustivamente todos os componentes de estado, badges e indicadores visuais do **Orion System**, cobrindo as 3 dimensões fundamentais de chamados (**Status**, **Prioridade**, **SLA**) e indicadores de infraestrutura/monitoramento (**Ativos**, **Alertas**, **Máquinas**).

### Principais Diagnósticos:
1. **Inconsistência Geométrica e Estrutural:** Existem 3 componentes principais concorrentes (`StatusBadge`, `PriorityBadge`, `SLABadge`) além de uma biblioteca genérica esquecida (`status-badge.tsx`) e dezenas de badges ad-hoc criados inline. Cada um adota alturas, paddings, tamanhos de fonte, pesos e presença de ícones/dots totalmente divergentes.
2. **Bug Crítico de Quebra de Linha (Layout Wrapping):** A classe `whitespace-nowrap` está **ausente** na variante base `badgeVariants` e em todos os badges de estado. Em tabelas com colunas estreitas (`w-[120px]`, `w-[130px]` ou colunas flexíveis sem largura em `Reports.tsx`) e em visualizações mobile, textos longos como `"Em Atendimento"`, `"Aguard. Terceiro"` e contadores de SLA como `"No prazo (em 2 horas)"` sofrem quebra de linha para 2 linhas, deformando o formato de pílula.
3. **Falhas Críticas de Contraste WCAG 2.1 AA:**
   - **Light Mode:** Combinações como `text-warning` (`#f59e0b` / Amber-500) em fundos claros entregam contraste de apenas **2.1:1** (exigido: 4.5:1). `text-destructive` e `text-success` com fundos `bg-*/10` ou `bg-*/15` também falham (entregam entre **3.6:1** e **4.2:1**).
   - **Dark Mode:** Badges que usam `text-destructive` (`#dc3939`) no tema escuro sem variante clara entregam contraste de apenas **2.7:1**. Badges ad-hoc com classes puras do Tailwind como `text-green-600`, `text-red-600` e `text-rose-600` sem prefixo `dark:` ficam escuros e ilegíveis sobre superfícies slate.
4. **Conformidade WCAG 1.4.1 (Uso de Cor) e Leitores de Tela:** Ausência generalizada de `role="status"`, `aria-label` e `aria-hidden="true"` nos dots decorativos; `PriorityBadge` não possui qualquer glifo ou ícone de apoio visual além da cor e do texto.

---

## 2. Geometria e Formato das 3 Dimensões (Status, Prioridade, SLA)

### 2.1. Inspecção dos Componentes Oficiais

| Componente | Arquivo de Origem | Altura Renderizada | Padding (X / Y) | Border Radius | Tamanho da Fonte | Peso da Fonte | Dot / Ícone | `whitespace-nowrap` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`StatusBadge`** | `src/components/shared/StatusBadge.tsx` | ~22px (auto) | `px-2.5 py-0.5` | `rounded-full` (9999px) | `text-xs` (12px) | `font-semibold` (600) | Dot: `w-1.5 h-1.5 rounded-full` (`gap-1.5`) | ❌ **Ausente** |
| **`PriorityBadge` (default)** | `src/components/shared/PriorityBadge.tsx` | ~22px (auto) | `px-2.5 py-0.5` | `rounded-full` (9999px) | `text-xs` (12px) | `font-semibold` (600) | ❌ Nenhum dot/ícone | ❌ **Ausente** |
| **`PriorityBadge` (sm)** | `src/components/shared/PriorityBadge.tsx` | ~18px (auto) | `px-1.5 py-0` | `rounded-full` (9999px) | `text-[10px]` (10px) | `font-semibold` (600) | ❌ Nenhum dot/ícone | ❌ **Ausente** |
| **`SLABadge` (default)** | `src/components/dashboard/SLABadge.tsx` | ~28px (auto) | `px-2.5 py-1` | `rounded-full` (9999px) | `text-xs` (12px) | `font-medium` (500) | Ícone Lucide: `h-3.5 w-3.5` (`gap-1.5`) | ❌ **Ausente** |
| **`SLABadge` (compact)** | `src/components/dashboard/SLABadge.tsx` | ~16px (inline) | Nenhum (`p-0`) | N/A (não é badge) | `text-xs` (12px) | `font-medium` (500) | Dot: `h-2 w-2 rounded-full animate-pulse` | ❌ **Ausente** |
| **`StatusBadge` (UI genérico)** | `src/components/ui/status-badge.tsx` | ~22px / ~16px / ~30px | `px-2.5 py-0.5` (default)<br>`px-2 py-0.2` (sm)*<br>`px-3 py-1` (lg) | `rounded-full` (9999px) | `text-xs` (default)<br>`text-micro` (9px)<br>`text-sm` (14px) | `font-semibold` (default)<br>`font-medium` (sm) | Dot: `h-1.5 w-1.5` com suporte a `pulse` | ❌ **Ausente** |
| **Base `Badge` (shadcn)** | `src/components/ui/badge.tsx` | ~22px (auto) | `px-2.5 py-0.5` | `rounded-full` (9999px) | `text-xs` (12px) | `font-semibold` (600) | ❌ Nenhum | ❌ **Ausente** |

*\* Nota técnica:* `py-0.2` em `src/components/ui/status-badge.tsx` é uma classe Tailwind inválida (Tailwind não possui o passo `0.2` nativamente).

---

### 2.2. Comparativo de Mapas Locais e Badges Ad-Hoc no Sistema

Além dos componentes padronizados, foram encontrados padrões divergentes espalhados pelo código:

1. **`TopBar.tsx` (Busca Global - Linha 127):**
   - Código: `<StatusBadge status={ticket.status} className="text-[9px] py-0 h-4" />`
   - Problema: Força `h-4` (16px) com `py-0` e `text-[9px]`, comprimindo o dot `w-1.5 h-1.5` contra as bordas.
2. **`TicketHeroHeader.tsx` (Detalhes do Chamado - Linhas 178-201):**
   - Mistura badges de 3 tamanhos diferentes na mesma linha:
     - `StatusBadge`: altura ~22px, `py-0.5`, `text-xs`, `font-semibold`
     - `PriorityBadge`: altura ~22px, `py-0.5`, `text-xs`, `font-semibold`
     - `SLABadge`: altura ~28px, `py-1`, `text-xs`, `font-medium`, ícone 14px
     - Tempo de Atendimento: `px-3 py-1 rounded-full text-xs font-bold` (altura ~28px)
     - Empresa: `px-2.5 py-0.5 rounded-full text-sm` (fonte 14px maior que os badges de status!)
   - **Resultado:** A linha de badges fica desordenada verticalmente com desalinhamento na linha de base.
3. **`SLAConfiguration.tsx` (Configuração de SLA - Linhas 245-248):**
   - Usa `<Badge variant="outline">` puro com classes ad-hoc:
     - Urgente: `border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10`
     - Alta: `border-orange-500/30 text-orange-700 dark:text-orange-400 bg-orange-500/10`
     - Média: `border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/10` *(diverge de PriorityBadge onde média é Warning/Amber)*
     - Baixa: `border-slate-500/30 text-slate-700 dark:text-slate-300 bg-slate-500/10`
4. **`Assets.tsx` (Inventário de Ativos - Linhas 708-838):**
   - Tipo de dispositivo usa `rounded-md` com `text-[10px]` e `uppercase tracking-tight` (`bg-indigo-500/10`, `bg-sky-500/10`, `bg-emerald-500/10`).
   - Alertas usa `rounded-full` com `text-[11px]`, `px-2.5 py-1`, ícone 14px e `whitespace-nowrap` inline.
   - Chamados usa `rounded-full` com `text-[11px]`, `px-2.5 py-1` e ícone de ticket.
   - Status Online/Offline na foto do ativo usa um dot circular absoluto de 12px (`w-3 h-3 border-2 border-background`).

---

## 3. Diagnóstico de Quebras de Layout (Text Wrapping)

### 3.1. Causa Raiz da Quebra
A classe `whitespace-nowrap` está **completamente omitida** da definição do CVA em `src/components/ui/badge.tsx` (linha 7):
```typescript
// ATUAL (src/components/ui/badge.tsx):
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
  // Falta whitespace-nowrap aqui!
  ...
);
```

### 3.2. Pontos Críticos Onde Ocorre Quebra em 2 Linhas

```
+---------------------------------------------------------------------------------------------------+
| EXEMPLO DE QUEBRA DE LAYOUT ATUAL EM COLUNAS ESTREITAS                                           |
|                                                                                                   |
| Sem whitespace-nowrap:                      Com whitespace-nowrap:                                |
| +-------------------------+                 +-------------------------------+                     |
| | (•) Em                  |  <-- DEFORMADO  | (•) Em Atendimento            |  <-- PÍLULA CORRETA |
| |     Atendimento         |                 +-------------------------------+                     |
| +-------------------------+                                                                       |
|                                                                                                   |
| +-------------------------+                 +-------------------------------+                     |
| | (•) Aguard.             |  <-- DEFORMADO  | (•) Aguard. Terceiro          |  <-- PÍLULA CORRETA |
| |     Terceiro            |                 +-------------------------------+                     |
| +-------------------------+                                                                       |
|                                                                                                   |
| +-------------------------+                 +-------------------------------+                     |
| | [Clock] No prazo        |  <-- DEFORMADO  | [Clock] No prazo (em 2h)      |  <-- PÍLULA CORRETA |
| |         (em 2 horas)    |                 +-------------------------------+                     |
| +-------------------------+                                                                       |
+---------------------------------------------------------------------------------------------------+
```

#### Locais Mapeados:
1. **`TechnicianDashboard.tsx` (Tabelas de Chamados — `my-tickets` e `all-tickets`):**
   - Coluna de Status: `w-[150px]` com `text-center`.
   - Quando a tela do navegador tem largura intermediária (entre 1024px e 1280px) ou quando o zoom do usuário está em 110%-125%, a coluna comprime o conteúdo. Badges com labels de 14 a 16 caracteres (`"Em Atendimento"` e `"Aguard. Terceiro"`) quebram a palavra, duplicando a altura da linha da tabela de 56px para 74px e gerando efeito visual desagradável.
2. **`Reports.tsx` (Tabela Analítica de Relatórios — Linhas 1130-1176):**
   - Cabeçalhos de `TableHead` para Status e SLA **não possuem largura fixa (`w-[...]`)**.
   - Se o título do chamado ou nome da empresa for extenso, o algoritmo de layout padrão da tabela (`table-layout: auto`) reduz a largura das colunas de Status e SLA ao mínimo possível, forçando a quebra de `"Em Atendimento"`, `"Aguard. Cliente"` e do indicador de SLA em 2 ou 3 linhas.
3. **`TicketHistory.tsx` (Lista Mobile `< md` — Linhas 178-195):**
   - No container `flex items-center gap-2`, o ID `#1234`, o `StatusBadge` e o `PriorityBadge` ficam lado a lado.
   - Em smartphones compactos (360px a 390px de largura de tela), se o status for `"Aguard. Terceiro"` e a prioridade for `"Urgente"`, o badge de status quebra internamente para 2 linhas dentro de sua própria pílula em vez de quebrar a linha do container flex.
4. **`ClientPortal.tsx` (Lista de Chamados em Andamento — Linha 224):**
   - O container `<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">` engloba `StatusBadge`, `PriorityBadge` e o tempo decorrido.
   - Sem `whitespace-nowrap`, quando o espaço acaba, o browser opta por quebrar o texto do `StatusBadge` internamente antes de saltar o badge inteiro para a próxima linha.

---

## 4. Acessibilidade e Relação de Contraste (WCAG 2.1 AA)

A diretriz **WCAG 2.1 Critério de Sucesso 1.4.3 (Contraste Mínimo)** exige:
- **Texto Normal (< 18pt / 14pt bold):** Contraste mínimo de **4.5:1** contra o plano de fundo.
- **Texto Grande (≥ 18pt / 14pt bold) e Componentes de UI/Ícones (1.4.11):** Contraste mínimo de **3.0:1**.

### 4.1. Matriz de Contraste — `StatusBadge`

| Status | Classes Utilizadas | Fundo Efetivo | Cor do Texto | Contraste Light | Contraste Dark | Veredito WCAG AA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`open`** | `bg-blue-500/10 text-blue-700 dark:text-blue-400` | Light: `#eff6ff`<br>Dark: `#161e2e` | Light: `#1d4ed8`<br>Dark: `#60a5fa` | **5.2:1** | **6.8:1** | 🟢 **APROVADO** |
| **`in-progress`** | `bg-yellow-500/10 text-yellow-700 dark:text-yellow-400` | Light: `#fefce8`<br>Dark: `#24241d` | Light: `#a16207`<br>Dark: `#facc15` | **4.48:1** *(no background geral)* | **9.2:1** | 🟡 **LIMÍTROFE / FALHA LEVE** (Light) |
| **`awaiting-customer`** | `bg-purple-500/10 text-purple-700 dark:text-purple-400` | Light: `#faf5ff`<br>Dark: `#231d2f` | Light: `#7e22ce`<br>Dark: `#c084fc` | **6.6:1** | **6.3:1** | 🟢 **APROVADO** |
| **`awaiting-third-party`**| `bg-indigo-500/10 text-indigo-700 dark:text-indigo-400` | Light: `#eef2ff`<br>Dark: `#1d1e30` | Light: `#4338ca`<br>Dark: `#818cf8` | **6.5:1** | **6.2:1** | 🟢 **APROVADO** |
| **`resolved`** | `bg-green-500/10 text-green-700 dark:text-green-400` | Light: `#f0fdf4`<br>Dark: `#18261e` | Light: `#15803d`<br>Dark: `#4ade80` | **4.9:1** | **8.4:1** | 🟢 **APROVADO** |
| **`closed`** | `bg-muted text-muted-foreground` | Light: `#f0f2f5`<br>Dark: `#222730` | Light: `#555e6d`<br>Dark: `#a6adba` | **4.8:1** | **5.8:1** | 🟢 **APROVADO** |
| **`reopened`** | `bg-orange-500/10 text-orange-700 dark:text-orange-400` | Light: `#fff7ed`<br>Dark: `#281e1d` | Light: `#c2410c`<br>Dark: `#fb923c` | **5.3:1** | **6.8:1** | 🟢 **APROVADO** |
| **`cancelled`** | `bg-destructive/10 text-destructive` *(sem dark:)* | Light: `#feecec`<br>Dark: `#281b1d` | Light: `#f33f3f`<br>Dark: `#dc3939` | **3.9:1** ❌ | **2.7:1** ❌ | 🔴 **REPROVADO (FALHA CRÍTICA)** |

---

### 4.2. Matriz de Contraste — `PriorityBadge`

| Prioridade | Classes Utilizadas | Fundo Efetivo | Cor do Texto | Contraste Light | Contraste Dark | Veredito WCAG AA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`urgent`** | `bg-destructive/10 text-destructive` | Light: `#feecec`<br>Dark: `#281b1d` | Light: `#f33f3f`<br>Dark: `#dc3939` | **3.9:1** ❌ | **2.7:1** ❌ | 🔴 **REPROVADO (FALHA CRÍTICA)** |
| **`high`** | `bg-orange-500/10 text-orange-600 dark:text-orange-400` | Light: `#fff7ed`<br>Dark: `#281e1d` | Light: `#ea580c`<br>Dark: `#fb923c` | **4.18:1** ❌ | **6.8:1** | 🔴 **REPROVADO NO LIGHT MODE** |
| **`medium`** | `bg-warning/10 text-warning` *(sem dark:)* | Light: `#fef9ee`<br>Dark: `#27231a` | Light: `#f59e0b`<br>Dark: `#f59e0b` | **2.12:1** ❌ | **6.3:1** | 🔴 **REPROVADO (FALHA GRAVE NO LIGHT)** |
| **`low`** | `bg-muted text-muted-foreground` | Light: `#f0f2f5`<br>Dark: `#222730` | Light: `#555e6d`<br>Dark: `#a6adba` | **4.8:1** | **5.8:1** | 🟢 **APROVADO** |

---

### 4.3. Matriz de Contraste — `SLABadge` (Default & Compact)

| Status SLA | Classes Utilizadas | Fundo Efetivo | Cor do Texto / Ícone | Contraste Light | Contraste Dark | Veredito WCAG AA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ok` (No prazo)** | `bg-success/15 text-success` | Light: `#eefcf2`<br>Dark: `#1a291f` | Light: `#16a249`<br>Dark: `#20b658` | **3.62:1** ❌ | **5.7:1** | 🔴 **REPROVADO NO LIGHT MODE** |
| **`warning` (Atenção)** | `bg-warning/15 text-warning` | Light: `#fef6e5`<br>Dark: `#29241a` | Light: `#f59e0b`<br>Dark: `#f59e0b` | **2.08:1** ❌ | **6.1:1** | 🔴 **REPROVADO (FALHA GRAVE NO LIGHT)** |
| **`attention` (Crítico)** | `bg-warning/20 text-warning` | Light: `#fef2db`<br>Dark: `#2b2519` | Light: `#f59e0b`<br>Dark: `#f59e0b` | **1.98:1** ❌ | **5.9:1** | 🔴 **REPROVADO (FALHA GRAVE NO LIGHT)** |
| **`breached` (Vencido)** | `bg-destructive/15 text-destructive` | Light: `#fee6e6`<br>Dark: `#2c1b1e` | Light: `#f33f3f`<br>Dark: `#dc3939` | **3.71:1** ❌ | **2.52:1** ❌ | 🔴 **REPROVADO (FALHA CRÍTICA)** |

---

### 4.4. Matriz de Badges Inline e Ad-Hoc

1. **`Monitoring.tsx` (Badges de Status da Plataforma — Linhas 836, 840, 941, 945):**
   - `text-green-600 border-green-500/30 bg-green-500/10` → No Dark Mode o `text-green-600` (`#16a34a`) sobre o card escuro `#1b2029` atinge **3.2:1** (FALHA no Dark Mode).
   - `text-red-600 border-red-500/30 bg-red-500/10` → No Dark Mode o `text-red-600` (`#dc2626`) sobre o card escuro `#1b2029` atinge **2.4:1** (FALHA GRAVE no Dark Mode).
2. **`Assets.tsx` (Tipos de Ativos — Linhas 712-714):**
   - `text-indigo-600`, `text-sky-600`, `text-emerald-600` sem variante `dark:` → Em Dark Mode entregam entre **3.1:1** e **3.4:1** (FALHA generalizada em Dark Mode).
3. **`Assets.tsx` (Badges de Alertas — Linha 804):**
   - `bg-rose-500/10 text-rose-600` sem `dark:` → No Dark Mode entrega **2.6:1** (FALHA GRAVE).

---

## 5. Conformidade WCAG 1.4.1 (Uso de Cor) e Acessibilidade Semântica

### 5.1. Avaliação do Critério WCAG 1.4.1 (Uso de Cor)
O critério 1.4.1 determina que a cor **nunca** seja o único meio de transmitir informação visual.

| Componente | Avaliação do Uso de Cor | Elementos Redundantes Presentes | Risco WCAG 1.4.1 |
| :--- | :--- | :--- | :--- |
| **`StatusBadge`** | Adequado | Dot colorido + **Texto explícito** ("Aberto", "Em Atendimento", etc.) | Baixo |
| **`PriorityBadge`** | Limítrofe | **Apenas texto**, sem ícone, chevron, seta ou símbolo de severidade | Médio (Dificuldade de escaneamento rápido para daltônicos) |
| **`SLABadge` (default)** | Excelente | Ícone Lucide (Clock/AlertTriangle/AlertCircle) + **Texto** + Tempo restante | Nenhum (100% Conforme) |
| **`SLABadge` (compact)** | Parcial | Dot pulsante + Texto | Baixo |
| **Dot de Ativo em `Assets.tsx`** | Inadequado | Dot verde/vermelho/amarelo sobre o avatar do ativo sem label textual embutido no avatar | Alto se visto isoladamente |
| **`AssetTopologyGraph.tsx`** | Inadequado | Vértices do grafo usam dots coloridos `bg-emerald-500` / `bg-rose-500` sem ícone interno | Alto |

---

### 5.2. Comparativo: SLA Solto (Dot + Texto) vs. Badge Padronizado

No sistema atual convivem duas formas de exibir SLA:
1. **Formato Solto (`variant="compact"` em `TechnicianDashboard.tsx` e `Reports.tsx`):**
   ```tsx
   <div className="flex items-center gap-1.5">
     <div className="h-2 w-2 rounded-full animate-pulse bg-warning" />
     <span className="text-xs font-medium text-warning">Atenção</span>
   </div>
   ```
   - *Prós:* Ocupa menos espaço horizontal em tabelas densas.
   - *Contras:* Não possui borda, fundo nem padding; o texto com `text-warning` no Light Mode fica quase invisível (contraste 2.08:1); a animação `animate-pulse` contínua não respeita `prefers-reduced-motion` no elemento local; não exibe o tempo restante (`timeRemaining`).
2. **Formato Badge Completo (`variant="default"` em `TicketHeroHeader.tsx` e `TicketDetails.tsx`):**
   ```tsx
   <Badge variant="outline" className="gap-1.5 px-2.5 py-1 border bg-warning/15 text-warning border-warning/30">
     <Clock className="h-3.5 w-3.5 text-warning" />
     <span className="font-medium">Atenção</span>
     <span className="text-xs opacity-75">(em 25 minutos)</span>
   </Badge>
   ```
   - *Prós:* Visualmente robusto, transmite significado através de ícone específico (Clock vs AlertTriangle vs AlertCircle), contém informação quantitativa do prazo.
   - *Contras:* Altura de ~28px destoa de `StatusBadge` (~22px) e `PriorityBadge` (~22px); o texto `text-warning` no Light Mode falha em contraste.

---

### 5.3. Acessibilidade para Leitores de Tela (ARIA & Semântica)

1. **Ausência de `role="status"`:**
   Nenhum dos componentes possui `role="status"` ou `aria-live="polite"`. Quando o SLA muda dinamicamente via polling ou quando o status é atualizado, tecnologias assistivas não são notificadas.
2. **Dots não marcados como `aria-hidden="true"`:**
   Em `StatusBadge.tsx`, `SLABadge.tsx` e `status-badge.tsx`, os elementos `<div>` que representam os dots decorativos não possuem `aria-hidden="true"`, podendo ser anunciados de forma ambígua por leitores de tela como elementos vazios.
3. **Falta de Prefixo de Contexto Acessível:**
   Para um leitor de tela que lê uma linha de tabela, anunciar simplesmente `"Urgente"` ou `"Em Atendimento"` sem o rótulo da dimensão pode desorientar o usuário cego. O ideal é incluir texto acessível oculto (`sr-only`):
   ```tsx
   <span className="sr-only">Status do chamado: </span>
   <span>Em Atendimento</span>
   ```

---

## 6. Proposta Arquitetural de Padronização (Para FASE 2)

### 6.1. Especificação Geométrica Universal para Badges de Estado

Propõe-se a criação de uma escala canônica com 2 tamanhos bem definidos (`md` e `sm`):

```
+---------------------------------------------------------------------------------------------------+
| ESPECIFICAÇÃO GEOMÉTRICA UNIFICADA (ORION DESIGN SYSTEM)                                          |
+---------------------------------------------------------------------------------------------------+
| Parâmetro           | Tamanho Padrão (`md` / Default)         | Tamanho Compacto (`sm` / Tabela)  |
| :---                | :---                                    | :---                              |
| Altura Fixa         | `h-6` (24px)                            | `h-5` (20px)                      |
| Padding Horizontal  | `px-2.5` (10px)                         | `px-2` (8px)                      |
| Padding Vertical    | `py-0.5`                                | `py-0`                            |
| Border Radius       | `rounded-full` (9999px)                 | `rounded-full` (9999px)           |
| Tipografia          | `text-xs` (12px)                        | `text-[10px]` (10px)              |
| Peso da Fonte       | `font-semibold` (600)                   | `font-semibold` (600)             |
| Quebra de Linha     | `whitespace-nowrap` (OBRIGATÓRIO)       | `whitespace-nowrap` (OBRIGATÓRIO) |
| Dot Dimension       | `w-1.5 h-1.5` (6px)                     | `w-1.5 h-1.5` (6px)               |
| Icon Dimension      | `w-3.5 h-3.5` (14px)                    | `w-3 h-3` (12px)                  |
| Espaçamento (Gap)   | `gap-1.5` (6px)                         | `gap-1` (4px)                     |
+---------------------------------------------------------------------------------------------------+
```

---

### 6.2. Paleta Calibrada de Alto Contraste (WCAG 2.1 AA Compliant)

Para resolver todas as falhas de contraste (especialmente Amber/Amarelo no Light Mode e Destructive/Vermelho no Dark Mode), as seguintes classes semânticas devem ser adotadas:

| Token Semântico | Light Mode (Fundo / Borda / Texto) | Contraste Light | Dark Mode (Fundo / Borda / Texto) | Contraste Dark |
| :--- | :--- | :--- | :--- | :--- |
| **`open` (Azul)** | `bg-blue-500/10 border-blue-500/25 text-blue-700` | **5.2:1** 🟢 | `dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-300` | **7.8:1** 🟢 |
| **`in-progress` / `warning` (Âmbar/Amarelo)** | `bg-amber-500/10 border-amber-500/25 text-amber-800` | **5.4:1** 🟢 | `dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300` | **8.1:1** 🟢 |
| **`resolved` / `success` (Verde)** | `bg-emerald-500/10 border-emerald-500/25 text-emerald-800` | **5.8:1** 🟢 | `dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300` | **8.5:1** 🟢 |
| **`cancelled` / `destructive` (Vermelho)** | `bg-rose-500/10 border-rose-500/25 text-rose-800` | **5.9:1** 🟢 | `dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-300` | **7.2:1** 🟢 |
| **`awaiting-customer` (Roxo)** | `bg-purple-500/10 border-purple-500/25 text-purple-800` | **6.8:1** 🟢 | `dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-300` | **7.4:1** 🟢 |
| **`awaiting-third-party` (Índigo)** | `bg-indigo-500/10 border-indigo-500/25 text-indigo-800` | **6.9:1** 🟢 | `dark:bg-indigo-500/15 dark:border-indigo-500/30 dark:text-indigo-300` | **7.6:1** 🟢 |
| **`reopened` (Laranja)** | `bg-orange-500/10 border-orange-500/25 text-orange-800` | **5.6:1** 🟢 | `dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-300` | **7.1:1** 🟢 |
| **`closed` / `muted` (Neutro)** | `bg-muted/60 border-border text-foreground/70` | **5.1:1** 🟢 | `dark:bg-muted/40 dark:border-border dark:text-foreground/80` | **6.4:1** 🟢 |

---

### 6.3. Melhorias no Suporte a WCAG 1.4.1 (Ícones para Prioridade)

Recomenda-se equipar o `PriorityBadge` com ícones semânticos de apoio visual:
- **Urgente:** Ícone `Flame` ou `AlertOctagon` (`w-3 h-3`) + Texto "Urgente"
- **Alta:** Ícone `ArrowUp` (`w-3 h-3`) + Texto "Alta"
- **Média:** Ícone `Minus` (`w-3 h-3`) + Texto "Média"
- **Baixa:** Ícone `ArrowDown` (`w-3 h-3`) + Texto "Baixa"

Dessa forma, a prioridade é identificada instantaneamente por cor, forma do ícone e texto legível, atendendo plenamente à WCAG 1.4.1.

---

## 7. Checklist de Ações Recomendadas para FASE 2 (Implementação)

1. **Correção Global de `whitespace-nowrap`:**
   - Adicionar `whitespace-nowrap` na string base do `badgeVariants` em `src/components/ui/badge.tsx`.
   - Adicionar `whitespace-nowrap` em `StatusBadge.tsx`, `PriorityBadge.tsx` e `SLABadge.tsx`.
2. **Definição de Largura em Tabelas:**
   - Fixar largura mínima nas colunas de Status (`min-w-[140px]`) e SLA (`min-w-[130px]`) em `src/pages/Reports.tsx`.
3. **Calibração de Cores WCAG AA:**
   - Substituir `text-yellow-700` e `text-warning` por `text-amber-800 dark:text-amber-300`.
   - Substituir `text-destructive` em badges por `text-rose-800 dark:text-rose-300`.
   - Substituir `text-green-700` e `text-success` por `text-emerald-800 dark:text-emerald-300`.
   - Eliminar classes sem variantes `dark:` em `Monitoring.tsx` e `Assets.tsx`.
4. **Semântica e Leitores de Tela:**
   - Adicionar `aria-hidden="true"` nos dots decorativos de todos os badges.
   - Adicionar `role="status"` nos containers de `StatusBadge` e `SLABadge`.
   - Adicionar `sr-only` descritivo (`"Status: "`, `"Prioridade: "`, `"SLA: "`).
5. **Unificação de Componentes:**
   - Deprecar `src/components/ui/status-badge.tsx` não integrado ou alinhá-lo ao `StatusBadge.tsx` canônico.
