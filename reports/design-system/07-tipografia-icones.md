# Relatório de Auditoria 07: Tipografia, Ícones e Cores Hardcoded — Orion System

**Subagente:** Subagente 7 — Tipografia e Ícones
**Data:** Agosto/2026
**Escopo:** Análise estática 100% READ-ONLY em todos os arquivos de `src/` (189 arquivos)
**Status:** Concluído

---

## 1. Resumo Executivo

Esta auditoria detalhada avaliou a consistência do sistema de design em `src/`, focando em três eixos centrais:
1. **Tipografia:** Identificação da escala tipográfica, dispersão de tamanhos arbitrários (`text-[10px]`, `text-[11px]`, etc.), pesos de fonte, transformações (`uppercase`) e espaçamentos (`tracking-*`, `leading-*`).
2. **Ícones:** Inventário de ícones Lucide React (712 instâncias), consistência dimensional (`w-4 h-4`, `w-3.5 h-3.5`, `w-5 h-5`, etc.) e correlação com o contexto de interface (botões, headers, cards, tabelas, badges).
3. **Cores Hardcoded:** Mapeamento exaustivo de **1.385 ocorrências** de cores literais do Tailwind (`emerald-*`, `amber-*`, `red-*`, `indigo-*`, `blue-*`, `purple-*`, etc.) e valores hexadecimais arbitrários que violam os tokens semânticos (`primary`, `secondary`, `destructive`, `success`, `warning`, `muted`, `accent`, etc.), comprometendo o suporte coerente ao Dark Mode e a manutenção centralizada do Design System.

### Métricas Chave da Auditoria

| Métrica | Total Identificado | Observação Crítica |
| :--- | :---: | :--- |
| **Tamanhos de Texto Padrão** | **878** | Predomínio de `text-xs` (458) e `text-sm` (251) |
| **Tamanhos de Texto Arbitrários** | **408** | **408 ocorrências** fora da escala (`text-[10px]`, `text-[11px]`, `text-[9px]`) |
| **Pesos de Fonte** | **996** | Desbalanceamento severo: `font-bold` (525) vs `font-normal` (8) |
| **Transformações (`uppercase`)** | **266** | Uso massivo em badges, labels e cabeçalhos de tabela |
| **Instâncias de Ícones Lucide** | **712** | 132 componentes distintos; `w-4 h-4` (301) e `w-3.5 h-3.5` (150) predominam |
| **Cores Fixas / Hardcoded** | **1364** | **1.385 ocorrências** em 60 arquivos, necessitando migração semântica |

---

## 2. Diagnóstico Completo de Tipografia

### 2.1. Escala de Tamanhos de Texto (Standard Tailwind)

A tabela abaixo apresenta a distribuição dos tamanhos de texto padrão utilizados em `src/`:

| Classe Tailwind | Tamanho Equivalente | Contagem | % do Total Standard | Contexto Principal de Uso |
| :--- | :---: | :---: | :---: | :--- |
| `text-xs` | 12px (0.75rem) | **458** | 52.2% | Metadados, badges, tooltips, tags secundárias, status |
| `text-sm` | 14px (0.875rem) | **251** | 28.6% | Corpo de texto padrão, botões, inputs, células de tabela |
| `text-2xl` | 24px (1.5rem) | **40** | 4.6% | Títulos de página (PageHeader), métricas em StatCards |
| `text-base` | 16px (1.0rem) | **38** | 4.3% | Textos de destaque, parágrafos introdutórios, modais |
| `text-xl` | 20px (1.25rem) | **36** | 4.1% | Títulos de cards principais, subtítulos de página |
| `text-lg` | 18px (1.125rem) | **29** | 3.3% | Subtítulos de seção, títulos de cards menores |
| `text-3xl` | 30px (1.875rem) | **19** | 2.2% | Métricas de grande porte no Dashboard e Telas de Alerta |
| `text-4xl` | 36px (2.25rem) | **4** | 0.5% | Indicadores chave e números de telemetria de topo |
| `text-5xl` | 48px (3.0rem) | **2** | 0.2% | Destaques hero e números de impacto no monitoramento |
| `text-6xl` | 60px (3.75rem) | **1** | 0.1% | Grandes displays numéricos |
| **TOTAL** | - | **878** | **100.0%** | - |

### 2.2. Proliferação de Tamanhos de Texto Arbitrários (`text-[...]`)

> [!WARNING]
> Foram detectadas **408 ocorrências** de tamanhos arbitrários no código. Destas, **251 são `text-[10px]`**, **94 são `text-[11px]`** e **51 são `text-[9px]`**. Essa proliferação causa quebra de ritmo vertical e viola o princípio de design system de manter uma escala previsível.

| Classe Arbitrária | Equivalente | Ocorrências | % Arbitrários | Impacto / Problema | Sugestão de Substituição |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `text-[10px]` | 10px | **251** | 61.5% | Microcopy abaixo do recomendado para acessibilidade (<12px) | `text-xs` (12px) |
| `text-[11px]` | 11px | **94** | 23.0% | Microcopy abaixo do recomendado para acessibilidade (<12px) | `text-xs` (12px) |
| `text-[9px]` | 9px | **51** | 12.5% | Microcopy abaixo do recomendado para acessibilidade (<12px) | `text-[10px]` encapsulado em `Badge` ou `text-xs` |
| `text-[10.5px]` | 10.5px | **8** | 2.0% | Microcopy abaixo do recomendado para acessibilidade (<12px) | `text-xs` (12px) |
| `text-[9.5px]` | 9.5px | **3** | 0.7% | Microcopy abaixo do recomendado para acessibilidade (<12px) | `text-[10px]` encapsulado em `Badge` ou `text-xs` |
| `text-[14px]` | 14px | **1** | 0.2% | Tamanho fora da escala oficial | `text-[10px]` encapsulado em `Badge` ou `text-xs` |
| **TOTAL** | - | **408** | **100.0%** | - | - |

### 2.3. Distribuição de Pesos de Fonte (`font-*`)

| Peso de Fonte | Valor Numérico | Ocorrências | % do Total | Análise Crítica |
| :--- | :---: | :---: | :--- | :--- |
| `font-bold` | 700 | **525** | 52.7% | Uso predominante em botões, títulos, cards e rótulos (sobrecarrega a hierarquia visual) |
| `font-semibold` | 600 | **203** | 20.4% | Excelente equilíbrio para títulos de seção e componentes interativos |
| `font-medium` | 500 | **148** | 14.9% | Ideal para labels de formulário, itens de menu e dados de tabela |
| `font-black` | 900 | **105** | 10.5% | Uso intensivo em microcopy `text-[10px] uppercase font-black` (estilo cyber/industrial) |
| `font-normal` | 400 | **8** | 0.8% | Subutilizado (apenas 8 ocorrências explícitas), confiando no padrão herdado do `body` |
| `font-extrabold` | 800 | **7** | 0.7% | Uso pontual |
| **TOTAL** | - | **996** | **100.0%** | - |

### 2.4. Transformações de Caixa (`uppercase`), Espaçamento (`tracking-*`) e Entrelinha (`leading-*`)

#### Transformações de Caixa:
- `uppercase`: **266 ocorrências** — Aplicado quase exclusivamente em microtags, status badges, cabeçalhos de tabela e números de versão.
- `capitalize`: **5 ocorrências** — Uso pontual em nomes de usuários ou papéis.

#### Espaçamento entre Letras (Letter-Spacing):
| Classe Tailwind | Valor | Ocorrências | Padrão Identificado |
| :--- | :---: | :--- | :--- |
| `tracking-widest` | 0.1em | **106** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-wider` | 0.05em | **96** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-tight` | -0.025em | **59** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-tighter` | -0.05em | **7** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-wide` | 0.025em | **4** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-[0.25em]` | [0.25em] | **3** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-[0.2em]` | [0.2em] | **1** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-[0.3em]` | [0.3em] | **1** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-[0.4em]` | [0.4em] | **1** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |
| `tracking-[0.15em]` | [0.15em] | **1** | Usado conjuntamente com `uppercase` e `text-[10px]` para efeito estético 'eyebrow' |

#### Entrelinha (Line-Height):
| Classe Tailwind | Ocorrências | Uso Típico |
| :--- | :---: | :--- |
| `leading-relaxed` | **37** | Textos longos (`relaxed`), títulos compactos (`tight`), ícones alinhados (`none`) |
| `leading-tight` | **25** | Textos longos (`relaxed`), títulos compactos (`tight`), ícones alinhados (`none`) |
| `leading-none` | **11** | Textos longos (`relaxed`), títulos compactos (`tight`), ícones alinhados (`none`) |
| `leading-snug` | **2** | Textos longos (`relaxed`), títulos compactos (`tight`), ícones alinhados (`none`) |
| `leading-5` | **1** | Textos longos (`relaxed`), títulos compactos (`tight`), ícones alinhados (`none`) |

#### Famílias Tipográficas:
- `font-sans` (`Plus Jakarta Sans`): Padrão global do sistema aplicado no `<body>` via `@layer base` em `src/index.css`.
- `font-mono` (`JetBrains Mono` / `Geist Mono`): Utilizado em códigos de tickets, IPs de telemetria, logs de auditoria e terminal remoto.

---

## 3. Diagnóstico Completo de Ícones (Lucide React)

O Orion System utiliza a biblioteca **Lucide React** de forma ampla em toda a interface.
- **Total de Instâncias Mapeadas:** 712
- **Componentes de Ícone Distintos:** 119

### 3.1. Frequência de Tamanhos de Ícone

| Tamanho / Dimensão | Ocorrências | % do Total | Avaliação do Design System |
| :--- | :---: | :---: | :--- |
| `w-4 h-4` | **301** | 42.3% | ✅ **Padrão Ideal (16px)** — Perfeito para botões `sm`/`default`, inputs e tabelas |
| `w-3.5 h-3.5` | **150** | 21.1% | ⚠️ **Fracionado (14px)** — Muito frequente (150x); gera desalinhamento subpixel em displays 1x |
| `w-5 h-5` | **79** | 11.1% | ✅ **Padrão Médio (20px)** — Adequado para headers de card, botões `lg` e navegação |
| `w-3 h-3` | **68** | 9.6% | ⚠️ **Miniatura (12px)** — Usado em badges e microtags; aceitável se semântico |
| `w-8 h-8` | **35** | 4.9% | ✅ **Grande (32px)** — Usado em ícones de destaque no topo de cards e modais |
| `w-6 h-6` | **24** | 3.4% | ✅ **Padrão Destaque (24px)** — Adequado para Empty States e Navigation Drawers |
| `w-2.5 h-2.5` | **19** | 2.7% | ❌ **Ultra-pequeno (10px)** — Dificulta reconhecimento visual e contraste |
| `w-10 h-10` | **13** | 1.8% | ✅ **Hero / Empty States** — Ilustrações e telas de sucesso/erro |
| `w-12 h-12` | **7** | 1.0% | ✅ **Hero / Empty States** — Ilustrações e telas de sucesso/erro |
| `size-5` | **5** | 0.7% | ℹ️ Sintaxe moderna do Tailwind v3.4+ (`size-*`); padronizar sintaxe única no projeto |
| `size-4` | **4** | 0.6% | ℹ️ Sintaxe moderna do Tailwind v3.4+ (`size-*`); padronizar sintaxe única no projeto |
| `default/unspecified (16px/24px)` | **2** | 0.3% | Não padronizado |
| `w-24 h-24` | **2** | 0.3% | ✅ **Hero / Empty States** — Ilustrações e telas de sucesso/erro |
| `w-4.5 h-4.5` | **1** | 0.1% | Não padronizado |
| `w-16 h-16` | **1** | 0.1% | ✅ **Hero / Empty States** — Ilustrações e telas de sucesso/erro |
| `w-7 h-7` | **1** | 0.1% | Não padronizado |

### 3.2. Matriz de Frequência: Tamanho de Ícone vs Contexto de Interface

| Tamanho de Ícone | Contexto de Interface | Ocorrências | Exemplo Típico no Código |
| :--- | :--- | :---: | :--- |
| `w-4 h-4` | **Botão** | **142** | `<Button><Plus className="w-4 h-4 mr-2" /> Novo Ticket</Button>` |
| `w-4 h-4` | **Geral / Outros** | **72** | Ícone em elemento de geral / outros |
| `w-3.5 h-3.5` | **Botão** | **72** | `<Button size="sm"><RefreshCw className="w-3.5 h-3.5" /></Button>` |
| `w-4 h-4` | **Header / Título** | **62** | `<CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" />` |
| `w-3.5 h-3.5` | **Geral / Outros** | **43** | Ícone em elemento de geral / outros |
| `w-5 h-5` | **Header / Título** | **38** | `<PageHeader><ShieldCheck className="w-5 h-5" /> Segurança</PageHeader>` |
| `w-3 h-3` | **Botão** | **33** | Ícone em elemento de botão |
| `w-5 h-5` | **Geral / Outros** | **24** | Ícone em elemento de geral / outros |
| `w-3.5 h-3.5` | **Header / Título** | **18** | Ícone em elemento de header / título |
| `w-3 h-3` | **Geral / Outros** | **15** | Ícone em elemento de geral / outros |
| `w-8 h-8` | **Header / Título** | **13** | `<div className="p-3 bg-primary/10"><Building2 className="w-8 h-8" /></div>` |
| `w-6 h-6` | **Header / Título** | **11** | Ícone em elemento de header / título |
| `w-2.5 h-2.5` | **Botão** | **11** | Ícone em elemento de botão |
| `w-4 h-4` | **Tabela** | **10** | `<TableCell><Clock className="w-4 h-4 text-muted-foreground" /></TableCell>` |
| `w-5 h-5` | **Botão** | **9** | Ícone em elemento de botão |
| `w-3 h-3` | **Badge** | **9** | `<Badge><Check className="w-3 h-3 mr-1" /> Ativo</Badge>` |
| `w-3.5 h-3.5` | **Tabela** | **7** | Ícone em elemento de tabela |
| `w-3 h-3` | **Header / Título** | **7** | Ícone em elemento de header / título |
| `w-10 h-10` | **Header / Título** | **7** | Ícone em elemento de header / título |
| `w-8 h-8` | **Geral / Outros** | **7** | Ícone em elemento de geral / outros |
| `w-8 h-8` | **Tabela** | **6** | Ícone em elemento de tabela |
| `w-4 h-4` | **Card** | **6** | Ícone em elemento de card |
| `w-6 h-6` | **Card** | **6** | Ícone em elemento de card |
| `w-6 h-6` | **Geral / Outros** | **5** | Ícone em elemento de geral / outros |
| `w-4 h-4` | **Input / Formulário** | **5** | `<Search className="absolute left-3 w-4 h-4 text-muted-foreground" />` |

### 3.3. Top 30 Ícones Lucide Mais Utilizados

| Componente Lucide | Ocorrências | Finalidade Principal |
| :--- | :---: | :--- |
| `Loader2` | **77** | Spinners de carregamento assíncrono em botões e tabelas |
| `Plus` | **32** | Ações de criação de novos tickets, regras, ativos e usuários |
| `AlertTriangle` | **31** | Alertas de SLA, avisos de risco e advertências operacionais |
| `CheckCircle2` | **30** | Confirmações de sucesso, tickets resolvidos e estados saudáveis |
| `Clock` | **29** | Prazos de SLA, histórico de atividade e timestamps |
| `Trash2` | **23** | Ações destrutivas de exclusão com confirmação |
| `RefreshCw` | **22** | Recarregar telemetria, reprocessar filas e sincronização |
| `Lock` | **19** | Autenticação 2FA, controle de permissões e segurança |
| `Zap` | **16** | Ações automáticas, gatilhos de automação e triggers rápidos |
| `ShieldCheck` | **15** | Status de conformidade, antivírus e proteção ativa |
| `Activity` | **12** | Telemetria em tempo real, monitoramento de saúde de máquinas |
| `Building2` | **11** | Seleção e identificação de empresas e clientes |
| `Network` | **11** | Topologia de rede, IPs e monitoramento de conectividade |
| `ArrowRight` | **11** | Navegação de fluxo, breadcrumbs e links de avanço |
| `ShieldAlert` | **10** | Falhas de segurança e alertas críticos de proteção |
| `FileText` | **10** | Relatórios em PDF/CSV, logs e documentação técnica |
| `Search` | **10** | Campos de busca global, filtragem em tabelas e seletores |
| `User` | **10** | Perfis de operadores, técnicos e clientes atribuídos |
| `Globe` | **10** | Monitoramento web, URLs e ping de serviços externos |
| `Check` | **9** | Validação simples em checkboxes, selects e formulários |
| `Copy` | **9** | Cópia rápida de comandos, credenciais e chaves 2FA |
| `X` | **9** | Fechamento de modais, drawers e limpeza de filtros |
| `Shield` | **9** | Elemento visual de interface |
| `Radio` | **9** | Elemento visual de interface |
| `Play` | **9** | Elemento visual de interface |
| `AlertCircle` | **8** | Erros de validação e mensagens de impedimento |
| `Timer` | **8** | Elemento visual de interface |
| `HardDrive` | **8** | Elemento visual de interface |
| `Ticket` | **8** | Elemento visual de interface |
| `ChevronDown` | **7** | Elemento visual de interface |

---

## 4. Diagnóstico Completo de Cores Hardcoded do Tailwind

> [!IMPORTANT]
> Foram mapeadas **1364 ocorrências** de cores literais/hardcoded em **60 arquivos** diferentes. O uso de classes literais como `bg-emerald-50`, `text-emerald-600`, `border-amber-200`, `text-red-500` e `bg-purple-600` impede que o sistema reaja de forma uniforme a trocas de tema (Light/Dark mode) e centralização da identidade visual da marca.

### 4.1. Distribuição Geral por Paleta de Cor

| Paleta Tailwind | Ocorrências | % do Total | Domínio Funcional / Uso Típico | Token Semântico Alvo |
| :--- | :---: | :---: | :--- | :--- |
| `emerald` | **344** | 25.2% | Status "Online", "Resolvido", SLA Saudável, Sucesso | `success` / `text-success` / `bg-success/10` |
| `amber` | **310** | 22.7% | Status "Pendente", Alertas Médios, SLA em Risco, Avisos | `warning` / `text-warning` / `bg-warning/10` |
| `red` | **237** | 17.4% | Status "Crítico", "Offline", SLA Violado, Ações Destrutivas | `destructive` / `text-destructive` / `bg-destructive/10` |
| `green` | **88** | 6.5% | Duplicação funcional com `emerald` (Status OK / Sucesso) | `success` (unificar com emerald) |
| `blue` | **82** | 6.0% | Status "Em Andamento", "Novo", Links e Ações Informativas | `accent` / `primary` / `info` |
| `indigo` | **69** | 5.1% | Métricas secundárias, gráficos de automação e badges | `primary` / `brand-500` / `accent` |
| `rose` | **48** | 3.5% | Duplicação funcional com `red` (Alertas urgentes / Erros) | `destructive` (unificar com red) |
| `orange` | **39** | 2.9% | Duplicação funcional com `amber` (Prioridade Alta / Warning) | `warning` (unificar com amber) |
| `purple` | **33** | 2.4% | Cor de marca aplicada de forma hardcoded em vez de tokens | `primary` / `brand-*` (`brand-600`, `brand-400`) |
| `sky` | **30** | 2.2% | Duplicação com `blue` (Telemetria, Ping, Conexão) | `accent` / `info` |
| `yellow` | **26** | 1.9% | Duplicação com `amber` (Avisos leves) | `warning` |
| `zinc` | **19** | 1.4% | Superfícies e bordas escuras hardcoded | `card`, `border`, `muted` |
| `cyan` | **8** | 0.6% | Gráficos de telemetria web e latência | `accent` / `info` |
| `violet` | **8** | 0.6% | Duplicação com `purple` e `indigo` | `primary` / `brand-*` |
| `teal` | **8** | 0.6% | Duplicação com `emerald` e `cyan` | `success` / `accent` |
| `slate` | **6** | 0.4% | Neutros hardcoded em drawers e tabelas | `muted-foreground` / `border` |
| `neutral` | **4** | 0.3% | Neutros em containers e dividers | `border` / `muted` |
| `inline_style_hex` | **4** | 0.3% | Estilos inline com cores hexadecimais literais | Classes Tailwind semânticas |
| `arbitrary_hex` | **1** | 0.1% | Classes arbitrárias `bg-[#09090b]` | `bg-background` / `bg-card` |
| **TOTAL** | **1364** | **100.0%** | - | - |

### 4.2. Distribuição por Propriedade CSS (Prefixos)

| Prefixo Tailwind | Ocorrências | % do Total | Impacto |
| :--- | :---: | :---: | :--- |
| `text-*` | **679** | 49.8% | Cor de texto de status/dados |
| `bg-*` | **423** | 31.0% | Fundo de badges, cards e tags |
| `border-*` | **225** | 16.5% | Bordas de badges e cards com transparência |
| `shadow-*` | **16** | 1.2% | Efeitos visuais e anéis de foco |
| `ring-*` | **4** | 0.3% | Efeitos visuais e anéis de foco |
| `via-*` | **4** | 0.3% | Efeitos visuais e anéis de foco |
| `fill-*` | **2** | 0.1% | Efeitos visuais e anéis de foco |
| `stroke-*` | **2** | 0.1% | Efeitos visuais e anéis de foco |
| `from-*` | **2** | 0.1% | Efeitos visuais e anéis de foco |
| `to-*` | **2** | 0.1% | Efeitos visuais e anéis de foco |

### 4.3. Matriz de Equivalência e Migração para Tokens Semânticos

Para unificar o Design System no Orion System, a tabela abaixo estabelece a regra de ouro para a substituição de classes fixas por tokens semânticos suportados pelo Tailwind e definidos em `src/index.css`:

| Padrão Hardcoded Atual (Exemplo) | Token Semântico Recomendado | Efeito no Light Mode | Efeito no Dark Mode |
| :--- | :--- | :--- | :--- |
| `bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400` | `bg-success/10 text-success border-success/20` | Fundo verde sutil com texto verde legível | Fundo translúcido preservando alto contraste |
| `bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400` | `bg-warning/10 text-warning border-warning/20` | Fundo amarelo/âmbar suave com texto escuro | Fundo translúcido com texto âmbar vivo |
| `bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400` | `bg-destructive/10 text-destructive border-destructive/20` | Fundo vermelho claro com texto contrastante | Fundo avermelhado sutil com texto claro |
| `bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400` | `bg-primary/10 text-primary border-primary/20` | Fundo roxo da marca suave | Fundo roxo vivo da marca |
| `bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400` | `bg-accent text-accent-foreground border-border` | Fundo de destaque neutro/azul | Fundo de destaque escuro |
| `text-gray-400`, `text-slate-400`, `text-zinc-400` | `text-muted-foreground` | Cinza neutro legível (AA) | Cinza claro calibrado (AA) |
| `bg-gray-100`, `bg-slate-100`, `bg-zinc-100` | `bg-muted` | Fundo cinza suave | Superfície escura secundária |
| `border-gray-200`, `border-slate-200` | `border-border` | Borda sutil no tema claro | Borda discreta no tema escuro |

### 4.4. Arquivos Críticos com Maior Concentração de Cores Hardcoded

| Arquivo | Total Ocorrências | Paletas Predominantes | Contexto Funcional |
| :--- | :---: | :--- | :--- |
| [`components/monitoring/MachineDrawer.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/MachineDrawer.tsx) | **193** | `red` (53), `emerald` (49), `amber` (38) | Telemetria detalhada de máquinas e hardware |
| [`pages/WebMonitoring.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/WebMonitoring.tsx) | **153** | `emerald` (75), `red` (61), `amber` (11) | Monitoramento de sites e serviços HTTP |
| [`pages/AlertsDashboard.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/AlertsDashboard.tsx) | **107** | `red` (34), `rose` (22), `amber` (21) | Central de alertas operacionais e SLAs |
| [`pages/TicketDetails.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx) | **72** | `amber` (41), `indigo` (14), `green` (11) | Visualização e edição de chamados |
| [`pages/Assets.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Assets.tsx) | **71** | `emerald` (27), `sky` (15), `rose` (11) | Inventário e gerenciamento de hardware |
| [`pages/Auth.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Auth.tsx) | **57** | `blue` (8), `cyan` (8), `amber` (8) | Login, recuperação e autenticação |
| [`components/monitoring/MachineCard.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/MachineCard.tsx) | **49** | `amber` (21), `emerald` (9), `red` (8) | Card de status de máquinas |
| [`components/monitoring/WebTelemetryTab.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/WebTelemetryTab.tsx) | **49** | `emerald` (19), `blue` (7), `amber` (7) | Aba de telemetria de web services |
| [`components/settings/TwoFactorAuthSettings.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/settings/TwoFactorAuthSettings.tsx) | **40** | `amber` (27), `emerald` (10), `green` (2) | Login, recuperação e autenticação |
| [`components/monitoring/InventoryTab.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/InventoryTab.tsx) | **37** | `emerald` (14), `amber` (13), `red` (6) | Aba de inventário de máquinas |
| [`pages/Monitoring.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Monitoring.tsx) | **35** | `red` (15), `emerald` (11), `green` (6) | Painel geral de monitoramento |
| [`pages/NewTicket.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/NewTicket.tsx) | **33** | `amber` (11), `emerald` (5), `green` (5) | Módulo funcional do sistema |
| [`components/shared/StatusBadge.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/shared/StatusBadge.tsx) | **30** | `blue` (5), `yellow` (5), `purple` (5) | Componente de badge de status unificado |
| [`pages/Reports.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Reports.tsx) | **25** | `green` (9), `amber` (7), `red` (7) | Módulo funcional do sistema |
| [`components/dashboard/TechnicianDashboard.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/dashboard/TechnicianDashboard.tsx) | **24** | `emerald` (9), `amber` (7), `rose` (7) | Painel do técnico e tickets atribuídos |
| [`components/admin/SLAConfiguration.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/admin/SLAConfiguration.tsx) | **20** | `blue` (5), `rose` (4), `orange` (4) | Módulo funcional do sistema |
| [`components/automation/RuleForm.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/automation/RuleForm.tsx) | **20** | `amber` (6), `blue` (4), `indigo` (4) | Módulo funcional do sistema |
| [`components/dashboard/SLABadge.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/dashboard/SLABadge.tsx) | **20** | `green` (5), `yellow` (5), `orange` (5) | Componente de badge de SLA |
| [`components/monitoring/RemoteTerminal.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/RemoteTerminal.tsx) | **20** | `green` (6), `red` (5), `zinc` (5) | Módulo funcional do sistema |
| [`pages/ClientPortal.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/ClientPortal.tsx) | **20** | `emerald` (13), `blue` (7) | Módulo funcional do sistema |
| [`pages/DebugTools.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/DebugTools.tsx) | **20** | `red` (10), `green` (6), `emerald` (3) | Módulo funcional do sistema |
| [`components/ticket/UnifiedTimeline.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/ticket/UnifiedTimeline.tsx) | **19** | `amber` (12), `yellow` (2), `purple` (2) | Módulo funcional do sistema |
| [`pages/KnowledgeBase.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/KnowledgeBase.tsx) | **19** | `emerald` (19) | Módulo funcional do sistema |
| [`pages/PatchManagement.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/PatchManagement.tsx) | **19** | `red` (5), `indigo` (5), `amber` (3) | Módulo funcional do sistema |
| [`pages/Avaliacao.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Avaliacao.tsx) | **17** | `emerald` (11), `amber` (6) | Módulo funcional do sistema |

### 4.5. Mapeamento Detalhado de Ocorrências por Módulo

Abaixo apresentamos o detalhamento linha a linha dos arquivos mais críticos que devem ser refatorados na Fase 2:

#### 📁 [`src/components/monitoring/MachineDrawer.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/MachineDrawer.tsx) — 193 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 83 | `bg-red-500/10` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `critical: 'bg-red-500/10 text-red-600 border-red-500/30',...` |
| 83 | `text-red-600` | `red-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `critical: 'bg-red-500/10 text-red-600 border-red-500/30',...` |
| 83 | `border-red-500/30` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `critical: 'bg-red-500/10 text-red-600 border-red-500/30',...` |
| 84 | `bg-orange-500/10` | `orange-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `high:     'bg-orange-500/10 text-orange-600 border-orange-50...` |
| 84 | `text-orange-600` | `orange-600` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `high:     'bg-orange-500/10 text-orange-600 border-orange-50...` |
| 84 | `border-orange-500/30` | `orange-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `high:     'bg-orange-500/10 text-orange-600 border-orange-50...` |
| 85 | `bg-yellow-500/10` | `yellow-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-50...` |
| 85 | `text-yellow-600` | `yellow-600` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-50...` |
| 85 | `border-yellow-500/30` | `yellow-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `medium:   'bg-yellow-500/10 text-yellow-600 border-yellow-50...` |
| 86 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `low:      'bg-blue-500/10 text-blue-600 border-blue-500/30',...` |
| 86 | `text-blue-600` | `blue-600` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `low:      'bg-blue-500/10 text-blue-600 border-blue-500/30',...` |
| 86 | `border-blue-500/30` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `low:      'bg-blue-500/10 text-blue-600 border-blue-500/30',...` |
| ... | *mais 181 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/WebMonitoring.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/WebMonitoring.tsx) — 153 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 88 | `text-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',...` |
| 88 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',...` |
| 88 | `border-amber-500/20` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',...` |
| 94 | `text-blue-500` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',...` |
| 94 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',...` |
| 94 | `border-blue-500/20` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',...` |
| 446 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-60...` |
| 446 | `text-blue-600` | `blue-600` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-60...` |
| 446 | `dark:text-blue-400` | `blue-400` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-60...` |
| 459 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'...` |
| 459 | `bg-emerald-500/10` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'...` |
| 459 | `border-emerald-500/30` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'...` |
| ... | *mais 141 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/AlertsDashboard.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/AlertsDashboard.tsx) — 107 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 68 | `bg-rose-500/10` | `rose-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `bg: 'bg-rose-500/10 dark:bg-rose-950/20',...` |
| 68 | `dark:bg-rose-950/20` | `rose-950` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `bg: 'bg-rose-500/10 dark:bg-rose-950/20',...` |
| 69 | `border-rose-500/30` | `rose-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `border: 'border-rose-500/30',...` |
| 70 | `text-rose-600` | `rose-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `text: 'text-rose-600 dark:text-rose-400',...` |
| 70 | `dark:text-rose-400` | `rose-400` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `text: 'text-rose-600 dark:text-rose-400',...` |
| 71 | `bg-rose-600` | `rose-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `icon: 'bg-rose-600 shadow-rose-600/30',...` |
| 71 | `shadow-rose-600/30` | `rose-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `icon: 'bg-rose-600 shadow-rose-600/30',...` |
| 72 | `bg-rose-500` | `rose-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `badge: 'bg-rose-500 text-white',...` |
| 75 | `bg-red-500/10` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `bg: 'bg-red-500/10 dark:bg-red-950/20',...` |
| 75 | `dark:bg-red-950/20` | `red-950` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `bg: 'bg-red-500/10 dark:bg-red-950/20',...` |
| 76 | `border-red-500/30` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `border: 'border-red-500/30',...` |
| 77 | `text-red-600` | `red-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `text: 'text-red-600 dark:text-red-400',...` |
| ... | *mais 95 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/TicketDetails.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx) — 72 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 114 | `bg-green-500` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `isPast ? "bg-green-500 border-green-500 text-white" :...` |
| 114 | `border-green-500` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `isPast ? "bg-green-500 border-green-500 text-white" :...` |
| 121 | `text-green-600` | `green-600` | success (ex: text-success, bg-success/10, border-success/20) | `isActive ? "text-primary" : isPast ? "text-green-600" : "tex...` |
| 130 | `bg-green-500` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `isPast ? "w-full bg-green-500" : "w-0 bg-primary"...` |
| 696 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 696 | `border-amber-500/30` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 696 | `text-amber-700` | `amber-700` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 696 | `dark:text-amber-400` | `amber-400` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 705 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 705 | `border-amber-500/30` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 705 | `text-amber-700` | `amber-700` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| 705 | `dark:text-amber-400` | `amber-400` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="mb-6 bg-amber-500/10 border border-amber-500...` |
| ... | *mais 60 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/Assets.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Assets.tsx) — 71 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 551 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `<SelectItem value="online" className="text-xs font-semibold ...` |
| 552 | `text-rose-600` | `rose-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `<SelectItem value="offline" className="text-xs font-semibold...` |
| 553 | `text-amber-600` | `amber-600` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<SelectItem value="alerta" className="text-xs font-semibold ...` |
| 591 | `text-emerald-700` | `emerald-700` | success (ex: text-success, bg-success/10, border-success/20) | `cor: 'text-emerald-700 dark:text-emerald-400',...` |
| 591 | `dark:text-emerald-400` | `emerald-400` | success (ex: text-success, bg-success/10, border-success/20) | `cor: 'text-emerald-700 dark:text-emerald-400',...` |
| 592 | `bg-emerald-500/10` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `fundo: 'bg-emerald-500/10',...` |
| 593 | `hover:border-emerald-500/40` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `borda: 'hover:border-emerald-500/40',...` |
| 599 | `text-sky-700` | `sky-700` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `cor: 'text-sky-700 dark:text-sky-400',...` |
| 599 | `dark:text-sky-400` | `sky-400` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `cor: 'text-sky-700 dark:text-sky-400',...` |
| 600 | `bg-sky-500/10` | `sky-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `fundo: 'bg-sky-500/10',...` |
| 601 | `hover:border-sky-500/40` | `sky-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `borda: 'hover:border-sky-500/40',...` |
| 607 | `text-indigo-700` | `indigo-700` | primary / brand-* (ex: text-primary, bg-primary/10, bg-brand-600) | `cor: 'text-indigo-700 dark:text-indigo-400',...` |
| ... | *mais 59 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/Auth.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Auth.tsx) — 57 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 71 | `bg-blue-100` | `blue-100` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 71 | `border-blue-300` | `blue-300` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 71 | `text-blue-700` | `blue-700` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 71 | `dark:bg-blue-600/30` | `blue-600` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 71 | `dark:border-blue-400/60` | `blue-400` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 71 | `dark:text-blue-200` | `blue-200` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 72 | `text-blue-700` | `blue-700` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<Monitor className="size-4 text-blue-700 dark:text-blue-200 ...` |
| 72 | `dark:text-blue-200` | `blue-200` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<Monitor className="size-4 text-blue-700 dark:text-blue-200 ...` |
| 85 | `bg-cyan-100` | `cyan-100` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 85 | `border-cyan-300` | `cyan-300` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 85 | `text-cyan-800` | `cyan-800` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| 85 | `dark:bg-cyan-600/30` | `cyan-600` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="flex items-center justify-center size-9 roun...` |
| ... | *mais 45 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/components/monitoring/MachineCard.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/MachineCard.tsx) — 49 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 155 | `text-sky-500` | `sky-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `className="w-4 h-4 text-sky-500 flex-shrink-0"...` |
| 167 | `text-sky-400` | `sky-400` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `className="w-4 h-4 text-sky-400 flex-shrink-0"...` |
| 179 | `text-indigo-400` | `indigo-400` | primary / brand-* (ex: text-primary, bg-primary/10, bg-brand-600) | `<Server className="w-4 h-4 text-indigo-400 flex-shrink-0" />...` |
| 185 | `text-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `className="w-4 h-4 text-amber-500 flex-shrink-0"...` |
| 196 | `text-neutral-400` | `neutral-400` | muted-foreground / foreground (ex: text-muted-foreground) | `className="w-4 h-4 text-neutral-400 dark:text-neutral-300 fl...` |
| 196 | `dark:text-neutral-300` | `neutral-300` | muted / secondary / border / card (ex: bg-muted, border-border) | `className="w-4 h-4 text-neutral-400 dark:text-neutral-300 fl...` |
| 207 | `text-sky-500` | `sky-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `className="w-4 h-4 text-sky-500 flex-shrink-0"...` |
| 265 | `text-red-500` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `if (val > 85) return 'text-red-500 dark:text-red-400';...` |
| 265 | `dark:text-red-400` | `red-400` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `if (val > 85) return 'text-red-500 dark:text-red-400';...` |
| 266 | `text-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `if (val >= 70) return 'text-amber-500 dark:text-amber-400';...` |
| 266 | `dark:text-amber-400` | `amber-400` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `if (val >= 70) return 'text-amber-500 dark:text-amber-400';...` |
| 267 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `return 'text-emerald-600 dark:text-emerald-400';...` |
| ... | *mais 37 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/components/monitoring/WebTelemetryTab.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/WebTelemetryTab.tsx) — 49 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 286 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 ...` |
| 286 | `text-blue-600` | `blue-600` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 ...` |
| 286 | `dark:text-blue-400` | `blue-400` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `<div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 ...` |
| 301 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ...` |
| 301 | `dark:text-emerald-400` | `emerald-400` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ...` |
| 301 | `bg-emerald-500/10` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ...` |
| 301 | `border-emerald-500/30` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ...` |
| 302 | `text-red-600` | `red-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-5...` |
| 302 | `dark:text-red-400` | `red-400` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-5...` |
| 302 | `bg-red-500/10` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-5...` |
| 302 | `border-red-500/30` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-5...` |
| 314 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `<span className="text-emerald-600 font-semibold">HTTP 2xx/3x...` |
| ... | *mais 37 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/components/settings/TwoFactorAuthSettings.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/settings/TwoFactorAuthSettings.tsx) — 40 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 270 | `border-amber-500/30` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="relative overflow-hidden p-4 sm:p-5 rounded-...` |
| 270 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="relative overflow-hidden p-4 sm:p-5 rounded-...` |
| 270 | `dark:bg-amber-950/20` | `amber-950` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="relative overflow-hidden p-4 sm:p-5 rounded-...` |
| 272 | `bg-amber-500/20` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="p-2 rounded-lg bg-amber-500/20 text-amber-60...` |
| 272 | `text-amber-600` | `amber-600` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="p-2 rounded-lg bg-amber-500/20 text-amber-60...` |
| 272 | `dark:text-amber-400` | `amber-400` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="p-2 rounded-lg bg-amber-500/20 text-amber-60...` |
| 277 | `text-amber-900` | `amber-900` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<h4 className="text-sm font-semibold text-amber-900 dark:tex...` |
| 277 | `dark:text-amber-200` | `amber-200` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<h4 className="text-sm font-semibold text-amber-900 dark:tex...` |
| 280 | `border-amber-500/40` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<Badge variant="outline" className="text-xs border-amber-500...` |
| 280 | `text-amber-700` | `amber-700` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<Badge variant="outline" className="text-xs border-amber-500...` |
| 280 | `dark:text-amber-300` | `amber-300` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<Badge variant="outline" className="text-xs border-amber-500...` |
| 284 | `text-amber-800` | `amber-800` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<p className="text-xs text-amber-800 dark:text-amber-300/90 ...` |
| ... | *mais 28 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/components/monitoring/InventoryTab.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/monitoring/InventoryTab.tsx) — 37 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 50 | `text-indigo-500` | `indigo-500` | primary / brand-* (ex: text-primary, bg-primary/10, bg-brand-600) | `<Cpu className="w-4 h-4 text-indigo-500" />...` |
| 74 | `text-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<HardDrive className="w-4 h-4 text-amber-500" />...` |
| 102 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-...` |
| 102 | `text-amber-600` | `amber-600` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-...` |
| 102 | `dark:text-amber-400` | `amber-400` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `<div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-...` |
| 115 | `text-red-500` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `? "text-red-500 border-red-500/30 bg-red-500/10"...` |
| 115 | `border-red-500/30` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `? "text-red-500 border-red-500/30 bg-red-500/10"...` |
| 115 | `bg-red-500/10` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `? "text-red-500 border-red-500/30 bg-red-500/10"...` |
| 117 | `text-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `? "text-amber-500 border-amber-500/30 bg-amber-500/10"...` |
| 117 | `border-amber-500/30` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `? "text-amber-500 border-amber-500/30 bg-amber-500/10"...` |
| 117 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `? "text-amber-500 border-amber-500/30 bg-amber-500/10"...` |
| 118 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"...` |
| ... | *mais 25 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/Monitoring.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Monitoring.tsx) — 35 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 118 | `bg-emerald-500` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `selected ? "bg-white" : "bg-emerald-500"...` |
| 120 | `text-emerald-600` | `emerald-600` | success (ex: text-success, bg-success/10, border-success/20) | `<span className={selected ? 'text-primary-foreground' : 'tex...` |
| 120 | `dark:text-emerald-400` | `emerald-400` | success (ex: text-success, bg-success/10, border-success/20) | `<span className={selected ? 'text-primary-foreground' : 'tex...` |
| 153 | `text-red-500` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `"h-6 w-6 rounded-md p-0 text-red-500",...` |
| 155 | `hover:bg-red-500/20` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `? "hover:bg-red-500/20 text-red-200"...` |
| 155 | `text-red-200` | `red-200` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `? "hover:bg-red-500/20 text-red-200"...` |
| 156 | `hover:bg-red-500/10` | `red-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `: "hover:bg-red-500/10 hover:text-red-600"...` |
| 156 | `hover:text-red-600` | `red-600` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `: "hover:bg-red-500/10 hover:text-red-600"...` |
| 199 | `bg-emerald-500` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `<span className={cn("h-1.5 w-1.5 rounded-full shrink-0", onl...` |
| 272 | `bg-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `alerting ? "bg-amber-500 animate-pulse" : isOnline ? "bg-eme...` |
| 272 | `bg-emerald-500` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `alerting ? "bg-amber-500 animate-pulse" : isOnline ? "bg-eme...` |
| 778 | `bg-red-100` | `red-100` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `<div className="w-20 h-20 bg-red-100 rounded-full flex items...` |
| ... | *mais 23 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/NewTicket.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/NewTicket.tsx) — 33 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 54 | `text-blue-500` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `color: 'text-blue-500',...` |
| 55 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `bg: 'bg-blue-500/10',...` |
| 72 | `text-orange-500` | `orange-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `color: 'text-orange-500',...` |
| 73 | `bg-orange-500/10` | `orange-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `bg: 'bg-orange-500/10',...` |
| 81 | `text-emerald-500` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `color: 'text-emerald-500',...` |
| 82 | `bg-emerald-500/10` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `bg: 'bg-emerald-500/10',...` |
| 90 | `text-sky-500` | `sky-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `color: 'text-sky-500',...` |
| 91 | `bg-sky-500/10` | `sky-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `bg: 'bg-sky-500/10',...` |
| 449 | `bg-green-500/10` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `<div className="w-20 h-20 bg-green-500/10 rounded-full flex ...` |
| 450 | `text-green-500` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `<CheckCircle2 className="w-10 h-10 text-green-500" />...` |
| 631 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg...` |
| 631 | `border-amber-500/20` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg...` |
| ... | *mais 21 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/components/shared/StatusBadge.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/shared/StatusBadge.tsx) — 30 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 13 | `bg-blue-500` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `dotColor: 'bg-blue-500',...` |
| 14 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20...` |
| 14 | `text-blue-700` | `blue-700` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20...` |
| 14 | `border-blue-500/20` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20...` |
| 14 | `dark:text-blue-400` | `blue-400` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20...` |
| 18 | `bg-yellow-500` | `yellow-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `dotColor: 'bg-yellow-500',...` |
| 19 | `bg-yellow-500/10` | `yellow-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-...` |
| 19 | `text-yellow-700` | `yellow-700` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-...` |
| 19 | `border-yellow-500/20` | `yellow-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-...` |
| 19 | `dark:text-yellow-400` | `yellow-400` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-...` |
| 23 | `bg-purple-500` | `purple-500` | primary / brand-* (ex: text-primary, bg-primary/10, bg-brand-600) | `dotColor: 'bg-purple-500',...` |
| 24 | `bg-purple-500/10` | `purple-500` | primary / brand-* (ex: text-primary, bg-primary/10, bg-brand-600) | `badgeClass: 'bg-purple-500/10 text-purple-700 border-purple-...` |
| ... | *mais 18 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/pages/Reports.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/Reports.tsx) — 25 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 466 | `text-blue-500` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `{ icon: Clock, cor: 'text-blue-500 bg-blue-500/10', valor: m...` |
| 466 | `bg-blue-500/10` | `blue-500` | accent / info (ex: text-accent-foreground, bg-accent, text-primary) | `{ icon: Clock, cor: 'text-blue-500 bg-blue-500/10', valor: m...` |
| 469 | `text-green-500` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `cor: 'text-green-500 bg-green-500/10',...` |
| 469 | `bg-green-500/10` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `cor: 'text-green-500 bg-green-500/10',...` |
| 1064 | `bg-green-500` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `dot: 'bg-green-500',...` |
| 1065 | `text-green-700` | `green-700` | success (ex: text-success, bg-success/10, border-success/20) | `texto: 'text-green-700 dark:text-green-400',...` |
| 1065 | `dark:text-green-400` | `green-400` | success (ex: text-success, bg-success/10, border-success/20) | `texto: 'text-green-700 dark:text-green-400',...` |
| 1066 | `bg-green-500/10` | `green-500` | success (ex: text-success, bg-success/10, border-success/20) | `badge: 'bg-green-500/10 text-green-700 dark:text-green-400 b...` |
| 1066 | `text-green-700` | `green-700` | success (ex: text-success, bg-success/10, border-success/20) | `badge: 'bg-green-500/10 text-green-700 dark:text-green-400 b...` |
| 1066 | `dark:text-green-400` | `green-400` | success (ex: text-success, bg-success/10, border-success/20) | `badge: 'bg-green-500/10 text-green-700 dark:text-green-400 b...` |
| 1066 | `border-green-600/30` | `green-600` | success (ex: text-success, bg-success/10, border-success/20) | `badge: 'bg-green-500/10 text-green-700 dark:text-green-400 b...` |
| 1071 | `bg-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `dot: 'bg-amber-500',...` |
| ... | *mais 13 ocorrências adicionais neste arquivo* | ... | ... | ... |

#### 📁 [`src/components/dashboard/TechnicianDashboard.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/components/dashboard/TechnicianDashboard.tsx) — 24 ocorrências

| Linha | Classe Hardcoded Identificada | Paleta / Tom | Sugestão de Substituição Semântica | Trecho do Código |
| :---: | :--- | :---: | :--- | :--- |
| 53 | `text-amber-500` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20...` |
| 53 | `bg-amber-500/10` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20...` |
| 53 | `border-amber-500/20` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20...` |
| 54 | `text-emerald-500` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `success: 'text-emerald-500 bg-emerald-500/10 border-emerald-...` |
| 54 | `bg-emerald-500/10` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `success: 'text-emerald-500 bg-emerald-500/10 border-emerald-...` |
| 54 | `border-emerald-500/20` | `emerald-500` | success (ex: text-success, bg-success/10, border-success/20) | `success: 'text-emerald-500 bg-emerald-500/10 border-emerald-...` |
| 55 | `text-rose-500` | `rose-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `danger: 'text-rose-500 bg-rose-500/10 border-rose-500/20',...` |
| 55 | `bg-rose-500/10` | `rose-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `danger: 'text-rose-500 bg-rose-500/10 border-rose-500/20',...` |
| 55 | `border-rose-500/20` | `rose-500` | destructive (ex: text-destructive, bg-destructive/10, border-destructive/20) | `danger: 'text-rose-500 bg-rose-500/10 border-rose-500/20',...` |
| 60 | `ring-amber-500/80` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `warning: 'ring-2 ring-amber-500/80 bg-amber-500/5 border-amb...` |
| 60 | `bg-amber-500/5` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `warning: 'ring-2 ring-amber-500/80 bg-amber-500/5 border-amb...` |
| 60 | `border-amber-500/40` | `amber-500` | warning (ex: text-warning, bg-warning/10, border-warning/20) | `warning: 'ring-2 ring-amber-500/80 bg-amber-500/5 border-amb...` |
| ... | *mais 12 ocorrências adicionais neste arquivo* | ... | ... | ... |

---

## 5. Recomendações e Plano de Ação para a Fase 2 (Refatoração)

Com base nos dados levantados nesta auditoria, recomendamos o seguinte plano de padronização para a Fase 2:

### 5.1. Padronização Tipográfica
1. **Eliminar classes arbitrárias de microtexto:** Substituir as 251 ocorrências de `text-[10px]` e 94 de `text-[11px]` pelo padrão `text-xs` (12px) ou encapsular em componentes dedicados (`<Badge size="sm">`).
2. **Harmonizar Pesos de Fonte:** Reduzir a sobrecarga de `font-bold` (525x) e `font-black` (105x) em labels secundárias, adotando `font-medium` para metadados e `font-semibold` para títulos de cards/seções.
3. **Racionalizar o uso de `uppercase`:** Limitar `uppercase` e `tracking-wider` exclusivamente a tags de status curtas (ex: 'SLA', 'VIP', 'OFFLINE') e criar um utilitário ou componente `<MicroBadge>` para evitar repetição de 6 classes em cada label.

### 5.2. Padronização de Ícones
1. **Adotar Escala Oficial de Tamanhos:**
   - **Micro (12px):** `w-3 h-3` — Apenas para badges ultra-compactos e indicadores inline.
   - **Pequeno (16px):** `w-4 h-4` — **Padrão oficial** para botões `sm`/`default`, inputs, células de tabela e dropdowns.
   - **Médio (20px):** `w-5 h-5` — Padrão oficial para cabeçalhos de card, botões `lg` e navegação.
   - **Grande (24px):** `w-6 h-6` — Destaques de seção e empty states.
   - **Hero (32px / 40px):** `w-8 h-8` ou `w-10 h-10` — Ícones de topo em modais e cards estatísticos.
2. **Eliminar Tamanhos Fracionados:** Converter todas as 150 ocorrências de `w-3.5 h-3.5` para `w-4 h-4` e as 19 de `w-2.5 h-2.5` para `w-3 h-3`.
3. **Acessibilidade:** Garantir que ícones puramente decorativos contenham `aria-hidden="true"` e ícones com ação possuam `aria-label` ou `sr-only` no botão pai.

### 5.3. Migração de Cores Hardcoded para Tokens Semânticos
1. **Status Unificado:** Concentrar os status de máquinas, tickets, SLAs e telemetria no componente `<StatusBadge status={...} />`, eliminando repetições manuais de classes `bg-emerald-*`, `bg-amber-*`, `bg-red-*`.
2. **Substituição dos Tons de Marca:** Trocar as ocorrências de `purple-600` e hexadecimais como `#483078` pelos tokens oficiais da marca (`brand-600`, `bg-primary`, `text-primary`).
3. **Correção de Contraste no Dark Mode:** Ao adotar tokens como `text-success`, `text-warning` e `text-destructive` com fundos semânticos `bg-*/10`, o sistema garante conformidade automática com as diretrizes WCAG AA (mínimo de 4.5:1) em ambos os temas.

---

*Relatório gerado automaticamente pela ferramenta de auditoria de Design System do Orion System (Subagente 7 — Tipografia e Ícones).*