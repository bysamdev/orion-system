# Relatório de Auditoria de Design System: Controles de Formulário
**Data:** 31 de Agosto de 2026  
**Auditor:** Subagente 5 — Controles de Formulário (Fase 1: Auditoria Read-Only)  
**Escopo:** Mapeamento e auditoria exaustiva de `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `RadioGroup`, `Combobox`, `DatePicker` e `SearchInput` em `src/components/ui/` e em todos os formulários e telas do diretório `src/`.

---

## 1. Sumário Executivo & Diagnóstico Geral

A auditoria de controles de formulário do **Orion System** analisou **185 arquivos TypeScript/TSX** no diretório `src/`, catalogando um total de **239 controles interativos de entrada de dados** distribuídos em **41 arquivos** de componentes e páginas.

### Principais Indicadores Quantitativos:
- **Total de Controles Auditados:** 239
- **Inputs de Texto / Número / Data / Arquivo (`<Input>` e `<input>`):** 93 (86 `<Input>` shadcn, 7 `<input>` nativos)
- **Áreas de Texto Multilinha (`<Textarea>` e `<textarea>`):** 13 (12 `<Textarea>` shadcn, 1 `<textarea>` nativo)
- **Seletores Dropdown (`<Select>` e `<SelectTrigger>`):** 120 elementos (60 pares Select / SelectTrigger)
- **Controles de Seleção Booleana (`<Checkbox>`):** 2 instâncias
- **Interruptores Alternadores (`<Switch>`):** 11 instâncias
- **Rótulos de Campo (`<Label>`, `<label>`, `<FormLabel>`):** 132 instâncias
- **Controles Órfãos de Acessibilidade (sem vínculo via `id`/`htmlFor`, `<FormItem>` ou `aria-label`):** **173 controles (72,4%)**
  - **90 controles (37,7%)** possuem `<Label>` ou `<label>` renderizado visualmente ao lado, mas **sem qualquer vínculo programático** (`id` ou `htmlFor`), quebrando leitores de tela e clique no texto do label.
  - **83 controles (34,7%)** não possuem **nenhum rótulo textual** (barras de busca, filtros de tabela, seletores rápidos de status, datepickers de relatório).
  - Apenas **57 controles (23,8%)** possuem vínculo correto de `id` e `htmlFor`.
  - Apenas **4 controles (1,7%)** utilizam o ecossistema integrado `react-hook-form` + `form.tsx` (restrito exclusivamente a `src/pages/NewTicket.tsx`).

---

### Diagnóstico Crítico dos 10 Componentes-Chave:

| Componente | Presença no `ui/` | Usos em Telas | Principais Desvios & Inconsistências Identificadas |
| :--- | :---: | :---: | :--- |
| **`Input`** | ✅ Sim | 93 | Fragmentação em **7 alturas distintas** (`h-7` a `h-14`), **4 variações de radius** (`rounded-md` a `rounded-2xl`) e múltiplos anéis de foco (`ring-ring`, `ring-primary/20`, `ring-primary/30`). |
| **`Textarea`** | ✅ Sim | 13 | Variação de altura mínima de `min-h-[80px]` a `min-h-[180px]`; ausência de auto-expand; font-size alternando entre `text-sm`, `text-base` e `font-mono`. |
| **`Select`** | ✅ Sim | 60 | `SelectTrigger` utiliza `focus:` (CSS puro) em vez de `focus-visible:`, causando anel de foco indesejado em cliques de mouse no desktop. Alturas variam de `h-7` a `h-12`. |
| **`Checkbox`** | ✅ Sim | 2 | Subutilizado (apenas 2 usos). Possui cantos `rounded-sm` (4px), destoando dos inputs (`rounded-md` 6px) e cards (`rounded-xl` 12px). Área de toque (16x16px) falha no padrão touch (44x44px). |
| **`Switch`** | ✅ Sim | 11 | Utilizado em configurações e modais administrativos sem `id` / `htmlFor` ou `aria-label`. Clique no rótulo ao lado não ativa o switch na maioria dos casos. |
| **`Label`** | ✅ Sim | 132 | **5 tipografias divergentes** nas páginas: desde o padrão `text-sm font-medium` até micro-labels `text-[10px] font-black uppercase tracking-widest text-muted-foreground/60`. |
| **`RadioGroup`** | ❌ **Ausente** | 0 | Inexistente no Design System. Escolhas mutuamente exclusivas são forçadas em `<Select>` ou grupos de botões tipo toggle. |
| **`Combobox`** | ❌ **Ausente** | 0 | Inexistente como componente oficial no `ui/`. `cmdk` está instalado, mas telas reimplementam dropdowns de busca ad-hoc com posicionamento absoluto. |
| **`DatePicker`** | ❌ **Ausente** | 4 | `react-day-picker` está listado nas dependências, mas não há `calendar.tsx` nem `date-picker.tsx`. Telas usam `<Input type="date">` nativo com visual e acessibilidade não padronizados. |
| **`SearchInput`** | ❌ **Ausente** | 6+ | Inexistente como componente unificado. Cada tela recria do zero `<div className="relative">` + `<Search>` + `<Input pl-*>` com paddings (`pl-9` a `pl-14`) e alturas arbitrárias. |

---

## 2. Tabelas de Frequência Quantitativa

### 2.1. Distribuição de Alturas de Controles de Entrada
| Altura Efetiva / Classe | Quantidade | Percentual | Contexto de Uso Principal |
| :--- | :---: | :---: | :--- |
| **Padrão Implícito (`h-10` / 40px)** | 202 | 84,5% | Inputs e SelectTriggers padrão do shadcn/ui. |
| **`h-9` (36px)** | 12 | 5,0% | Formulário de Regras (`RuleForm.tsx`), Busca Global (`TopBar.tsx`), Filtros (`WebMonitoring.tsx`). |
| **`h-10` explícito (40px)** | 11 | 4,6% | Filtros de Histórico (`TicketHistory.tsx`), Modais de Ativos (`Assets.tsx`). |
| **`h-11` (44px)** | 7 | 2,9% | Busca e Filtros de Ativos (`Assets.tsx`), Seletor de Status (`TicketDetails.tsx`), Escalação (`EscalateDialog.tsx`). |
| **`h-12` (48px)** | 4 | 1,7% | Busca do Dashboard do Técnico (`TechnicianDashboard.tsx`), Seletores de Novo Chamado (`NewTicket.tsx`). |
| **`h-14` (56px)** | 1 | 0,4% | Barra de Busca Principal da Base de Conhecimento (`KnowledgeBase.tsx`). |
| **`h-7` (28px)** / **`h-8` (32px)** | 2 | 0,8% | Seletores ultra-compactos de status em modais (`ResolutionDialog.tsx`). |
| **Total** | **239** | **100%** | **7 Variações de Altura** |

---

### 2.2. Variações de Border Radius em Formulários
| Border Radius Aplicado | Quantidade | Percentual | Impacto Visual no Design System |
| :--- | :---: | :---: | :--- |
| **`rounded-md` (6px) [Padrão Base UI]** | 208 | 87,0% | Padrão herdado de `input.tsx`, `select.tsx`, `textarea.tsx`. |
| **`rounded-xl` (12px) [Sobrescrita Moderna]** | 25 | 10,5% | Aplicado em buscas e filtros de `Monitoring.tsx`, `Assets.tsx`, `TechnicianDashboard.tsx`, `NewTicket.tsx`. |
| **`rounded-2xl` (16px)** | 1 | 0,4% | Busca hero de `TechnicianDashboard.tsx:537`. |
| **`rounded-lg` (8px)** | 1 | 0,4% | Seletor compacto em `ResolutionDialog.tsx:133`. |
| **`rounded-sm` (4px)** | 2 | 0,8% | Primitiva `checkbox.tsx` e botões de fechar. |
| **`rounded-full`** | 2 | 0,8% | Padrão do `switch.tsx`. |
| **Total** | **239** | **100%** | **6 Variações de Border Radius** |

---

### 2.3. Panorama de Acessibilidade: Associação de Rótulos (WCAG 2.1 - Critério 1.3.1 e 4.1.2)
| Categoria de Acessibilidade | Quantidade | Percentual | Status |
| :--- | :---: | :---: | :--- |
| **Vínculo Correto via `id` + `<Label htmlFor="...">`** | 57 | 23,8% | ✅ Conforme |
| **Vínculo Correto via `react-hook-form` (`<FormLabel>` + `<FormControl>`)** | 4 | 1,7% | ✅ Conforme (apenas `NewTicket.tsx`) |
| **Possui `aria-label` ou `aria-labelledby` Explícito** | 0 | 0,0% | ❌ **0 controles no sistema inteiro** |
| **Label Visual Vizinho Desconectado (Falta `id` / `htmlFor`)** | 90 | 37,7% | ❌ **Falha Crítica de Acessibilidade** |
| **Sem Qualquer Rótulo Visual ou Acessível (Buscas / Filtros)** | 83 | 34,7% | ❌ **Falha Crítica de Acessibilidade** |
| **Controles Base em `src/components/ui/`** | 5 | 2,1% | ℹ️ Primitivas estruturais |
| **Total de Controles Analisados** | **239** | **100%** | **72,4% Órfãos de A11y (173 controles)** |

---

## 3. Auditoria Individual por Controle de Formulário

### 3.1. `<Input>` e `<input>` (Base UI vs Páginas)

#### Definição no Design System (`src/components/ui/input.tsx`):
```tsx
className={cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  className
)}
```

#### Achados e Desvios nos Formulários das Páginas:
1. **Altura e Escala:** O padrão é `h-10` (40px). Em `TechnicianDashboard.tsx:537`, o input de busca é forçado para `h-12` (48px); em `KnowledgeBase.tsx:520` é forçado para `h-14` (56px); em `Assets.tsx:490` é forçado para `h-11` (44px); e em `RuleForm.tsx:146` e `TopBar.tsx:102` é reduzido para `h-9` (36px).
2. **Radius:** A primitiva declara `rounded-md` (6px). As telas modernas forçam `rounded-xl` (12px) e até `rounded-2xl` (16px em `TechnicianDashboard.tsx`), gerando incoerência visual com inputs padrão em modais (`rounded-md`).
3. **Padding e Ícones:** Não há suporte embutido a ícones à esquerda ou à direita no `<Input>`. Telas que adicionam ícones aplicam sobrescritas manuais caóticas: `pl-9` (`Monitoring.tsx`), `pl-10` (`Assets.tsx`, `TopBar.tsx`), `pl-12` (`TechnicianDashboard.tsx`, `TicketHistory.tsx`) e `pl-14` (`KnowledgeBase.tsx`).
4. **Anel de Foco (*Focus Ring*):** A primitiva usa `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Várias páginas sobrescrevem para `focus-visible:ring-primary/20` (removendo o offset), `focus:ring-primary/20` (sem visible), ou `focus-visible:ring-primary/30`, quebrando a padronização do Design Token `ring`.
5. **Estilo de Erro:** A primitiva `<Input>` **não possui tratamento nativo para erros** (como prop `error?: boolean` ou classe dinâmica para `aria-invalid="true"`). Se o input não estiver dentro de um `FormField` de `form.tsx`, ele não ganha borda vermelha (`border-destructive`) em caso de validação inválida.
6. **Inputs Nativos `<input>` sem Shadcn:** 7 ocorrências de `<input>` cru em `TopBar.tsx:77,85`, `AvatarUpload.tsx:125`, `TicketDetails.tsx:825`, sem estilos de acessibilidade ou estados de foco uniformes.

---

### 3.2. `<Textarea>` e `<textarea>`

#### Definição no Design System (`src/components/ui/textarea.tsx`):
```tsx
className={cn(
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  className
)}
```

#### Achados e Desvios:
1. **Altura Mínima:** A base define `min-h-[80px]`. `NewTicket.tsx:690` força `min-h-[180px]` e `text-base`; `TicketDetails.tsx:872` força `min-h-[160px]` com `p-4 text-base`.
2. **Redimensionamento:** Em `TicketDetails.tsx`, `NewTicket.tsx` e `KnowledgeBase.tsx`, foi aplicada a classe `resize-none`, mas sem nenhum script de auto-ajuste de altura (*auto-resize*), prejudicando a digitação de respostas longas pelo suporte.
3. **Nota Interna em TicketDetails:** `TicketDetails.tsx:874` adiciona estilização contextual: `isInternalNote && "border-amber-500/40 focus-visible:ring-amber-500/30"`. Esse comportamento é um padrão positivo de feedback visual, mas está codificado diretamente via classes ad-hoc em vez de uma variante semântica do Design System.

---

### 3.3. `<Select>`, `<SelectTrigger>` e `<SelectContent>`

#### Definição no Design System (`src/components/ui/select.tsx`):
```tsx
// SelectTrigger
className={cn(
  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  className
)}
```

#### Achados e Desvios:
1. **Divergência Crítica de Foco (`focus:` vs `focus-visible:`):** Enquanto `input.tsx` e `textarea.tsx` usam `focus-visible:ring-2`, o `SelectTrigger` utiliza `focus:ring-2`. Isso faz com que no desktop, ao clicar com o mouse no seletor, o anel de foco seja exibido permanentemente, diferindo do comportamento dos outros inputs.
2. **Proliferação de Alturas:** Encontrados triggers com `h-7` (`ResolutionDialog.tsx:133`), `h-9` (`RuleForm.tsx:87`, `WebMonitoring.tsx:1176`), `h-10` (padrão em modais), `h-11` (`TicketDetails.tsx:991`, `Assets.tsx:513`), e `h-12` (`NewTicket.tsx:723, 767, 845, 861`).
3. **Incompatibilidade de Radius:** O container `SelectContent` possui `rounded-md`, mas os triggers nas telas usam `rounded-xl` (`Assets.tsx`, `TechnicianDashboard.tsx`, `WebMonitoring.tsx`), criando uma quebra estética entre o botão de disparo e a lista suspensa aberta.
4. **Alinhamento do Ícone Chevron:** O ícone `ChevronDown` tem classe fixa `h-4 w-4 opacity-50` em `select.tsx`, mas em triggers `h-7` ou `h-12` o espaçamento vertical fica desproporcional.

---

### 3.4. `<Checkbox>`

#### Definição no Design System (`src/components/ui/checkbox.tsx`):
```tsx
className={cn(
  "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  className
)}
```

#### Achados e Desvios:
1. **Subutilização:** Apenas 2 ocorrências no sistema todo (`InstitutionalLegalDialog.tsx` e `TicketChecklist.tsx`). Em tabelas com seleção múltipla, ou não há checkbox ou foram usados botões customizados.
2. **Tamanho e Acessibilidade de Toque:** Medindo `h-4 w-4` (16x16px), não atende à recomendação de área de toque mínima de **44x44px** (WCAG 2.5.5) ou **24x24px** (WCAG 2.5.8) em dispositivos móveis, a menos que encapsulado com padding transparente ou vinculado a um `<label>` clicável amplo.
3. **Border Radius:** Possui `rounded-sm` (2px/4px), gerando micro-inconsistência com a linguagem visual geral do sistema.

---

### 3.5. `<Switch>`

#### Definição no Design System (`src/components/ui/switch.tsx`):
```tsx
className={cn(
  "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  className
)}
```

#### Achados e Desvios:
1. **Desconexão de Rótulo:** Nos 11 locais onde o `Switch` é usado (`Settings.tsx`, `ContractManagement.tsx`, `SLAConfiguration.tsx`, `KnowledgeBase.tsx`, `RulesTab.tsx`), o `<Switch>` é colocado lado a lado com um `<Label>` ou `<span>`, mas **sem `id` e sem `htmlFor`**. Clicar no texto não alterna o switch, forçando o usuário a acertar precisamente o componente de 44x24px.
2. **Ausência de `aria-label`:** Nenhum dos switches possui `aria-label` próprio para identificar sua finalidade em ferramentas de tecnologia assistiva.

---

### 3.6. `<Label>` e `form.tsx`

#### Definição no Design System (`src/components/ui/label.tsx` e `src/components/ui/form.tsx`):
```tsx
const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
```

#### Achados e Desvios nas Páginas:
1. **Caos Tipográfico nos Labels de Formulários:** Foram identificadas **5 variantes de tipografia de label** aplicadas manualmente via classes:
   - *Padrão:* `text-sm font-medium leading-none` (`label.tsx`)
   - *Micro Uppercase Black:* `text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1` (`TechnicianDashboard.tsx:563`, `TicketHistory.tsx:131`)
   - *Micro Uppercase Bold:* `text-[10px] font-bold text-muted-foreground uppercase px-1` (`TicketDetails.tsx:989`)
   - *Small Bold Uppercase:* `text-xs font-bold uppercase tracking-wider` (`RuleForm.tsx:65, 69, 75`)
   - *Compact Muted:* `text-xs text-muted-foreground` (`Reports.tsx:409, 418, 427, 443`)
2. **Subutilização de `form.tsx`:** O wrapper `react-hook-form` com `FormItem`, `FormLabel`, `FormControl` e `FormMessage` existe e está perfeito em `src/components/ui/form.tsx`, mas é utilizado em **apenas 1 arquivo** (`NewTicket.tsx`). Em todos os outros 40 arquivos, os desenvolvedores escreveram formulários controlados manualmente por `useState`, esquecendo de adicionar `id` e `htmlFor`.

---

### 3.7. `RadioGroup` (Diagnóstico de Ausência)
- **Status:** ❌ **Inexistente no repositório**.
- **Impacto:** O Orion System não possui a primitiva `@radix-ui/react-radio-group` nem o arquivo `src/components/ui/radio-group.tsx`. Quando há seleção exclusiva de 2 a 4 opções (ex: Tipo de visualização Cards vs Tabela em `Monitoring.tsx`, Período em `WebMonitoring.tsx`, Tipo de Pacote em `NewPackageDialog.tsx`), as telas recorrem a grupos de `<Button variant="ghost">` ou a `<Select>`.

---

### 3.8. `Combobox` / Searchable Select (Diagnóstico de Ausência)
- **Status:** ❌ **Inexistente como componente oficial no `ui/`**.
- **Impacto:** Embora o pacote `cmdk` e o componente `command.tsx` estejam presentes, não há um componente `Combobox` padronizado. Seletores de busca (como seleção de artigos, respostas prontas em tickets e seleção de máquinas) são implementados via popovers caseiros com menus absolutos (`CannedResponseSelector.tsx`, `TicketDetails.tsx:879`), com comportamentos de teclado e acessibilidade inconsistentes.

---

### 3.9. `DatePicker` (Diagnóstico de Ausência)
- **Status:** ❌ **Inexistente como componente oficial no `ui/`**.
- **Impacto:** Os pacotes `react-day-picker` e `date-fns` estão instalados em `package.json`, mas não existe `src/components/ui/calendar.tsx` nem `date-picker.tsx`. Telas com filtro de data (`Reports.tsx:410, 419`, `ContractManagement.tsx:256, 264`) utilizam `<Input type="date" />` nativo HTML5. Isso causa:
  - Visual não integrado (popover cinza nativo do Chrome/Edge/Firefox).
  - Impossibilidade de estilizar estados de seleção e intervalos (*date range*).
  - Formatação de data não uniforme entre navegadores.

---

### 3.10. `SearchInput` (Diagnóstico de Ausência e Comparativo)
- **Status:** ❌ **Inexistente como componente unificado**.
- **Impacto:** A busca é o controle mais utilizado no Orion System, mas cada tela a implementa do zero com dimensões e espaçamentos incompatíveis:

| Tela / Arquivo | Tag | Altura | Radius | Padding | Ícone & Posição | Placeholder | Focus Ring |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| `TopBar.tsx:102` | `<input>` | `h-9` | `rounded-md` | `pl-10 pr-4` | `<Search>` (left-3.5) | `Buscar tickets por #número...` | `focus:ring-primary/20` |
| `TechnicianDashboard.tsx:537` | `<Input>` | `h-12` | `rounded-2xl` | `pl-12` | `<Search>` (left-4) | `Busque por #número, título...` | `focus-visible:ring-primary/20` |
| `Monitoring.tsx:803` | `<Input>` | `h-10` | `rounded-xl` | `pl-9` | `<Search>` (left-3) | `Buscar máquinas, IP, usuário...` | Padrão + `focus:bg-background` |
| `Assets.tsx:490` | `<Input>` | `h-11` | `rounded-xl` | `pl-10` | `<Search>` (left-3.5) | `Pesquisar por Hostname, IP...` | `focus-visible:ring-primary/20` |
| `TicketHistory.tsx:108` | `<Input>` | `h-10` | `rounded-md` | `pl-12` | `<Search>` (left-4) | `Buscar por #número, ID...` | `focus-visible:ring-primary/20` |
| `KnowledgeBase.tsx:520` | `<Input>` | `h-14` | `rounded-xl` | `pl-14 pr-6` | `<Search>` (left-5 h-5) | `Digite sua dúvida (ex: Team...` | `focus-visible:ring-primary/30` |
| `CannedResponseSelector.tsx:63` | `<Input>` | `h-10` | `rounded-md` | `px-3` (sem pl) | `<Search>` separado | `Buscar por título, conteúdo...` | Padrão |

---

## 4. Auditoria Completa de Acessibilidade: Mapeamento de Inputs Órfãos (173 Ocorrências)

### 4.1. Análise do Padrão "Label Vizinho Desconectado" (90 Ocorrências)
O erro mais frequente no Orion System é o desenvolvedor renderizar um `<Label>Nome do Campo</Label>` seguido de `<Input value={...} />` sem declarar a propriedade `id` no controle e `htmlFor` no label.
- **Consequência:** Usuários que navegam com leitor de tela (NVDA/JAWS/VoiceOver) ouvem apenas *"Campo de texto em branco"* sem saber se o campo pede nome, e-mail, data ou prioridade. Além disso, clicar no rótulo com o mouse não transfere o foco para o campo.

### 4.2. Análise de Controles Sem Qualquer Rótulo (83 Ocorrências)
Barra de busca de tabelas, seletores de filtro de colunas e botões de paginação inline foram criados sem nenhum elemento textual visível e **sem atributo `aria-label` ou `aria-labelledby`**.

---

### 4.3. Inventário Detalhado dos 173 Controles Órfãos por Arquivo

#### 1. `src/components/admin/ContractManagement.tsx` (8 órfãos)
- `L234 <Select>`: Rotulado visualmente como *"Empresa *"*, mas falta `id` e `htmlFor`.
- `L235 <SelectTrigger>`: Falta `id` e `htmlFor`.
- `L247 <Input>`: Rotulado visualmente como *"Nome do Contrato *"*, mas falta `id`/`htmlFor`.
- `L256 <Input type="date">`: Rotulado visualmente como *"Data Início *"*, mas falta `id`/`htmlFor`.
- `L264 <Input type="date">`: Rotulado visualmente como *"Data Término"*, mas falta `id`/`htmlFor`.
- `L273 <Input type="number">`: Rotulado visualmente como *"Limite Mensal de Chamados"*, mas falta `id`/`htmlFor`.
- `L283 <Textarea>`: Rotulado visualmente como *"Observações"*, mas falta `id`/`htmlFor`.
- `L291 <Switch>`: Rotulado visualmente como *"Contrato ativo"*, mas falta `id`/`htmlFor` e `aria-label`.

#### 2. `src/components/admin/ResolutionChecklistManagement.tsx` (3 órfãos)
- `L147 <Select>`: Rotulado visualmente como *"Categoria do Chamado"*, mas sem `id`/`htmlFor`.
- `L148 <SelectTrigger>`: Sem `id`/`htmlFor`.
- `L169 <Input>`: Item de verificação dinâmico sem `aria-label` ou `htmlFor`.

#### 3. `src/components/admin/RoutingRulesManagement.tsx` (17 órfãos)
- `L208 <Input>`: Rotulado como *"Nome da Regra *"*, mas sem `id`/`htmlFor`.
- `L212 <Input type="number">`: Rotulado como *"Ordem"*, mas sem `id`/`htmlFor`.
- `L217 <Input>`: Rotulado como *"Descrição"*, mas sem `id`/`htmlFor`.
- `L227 <Select>` & `L228 <SelectTrigger>`: Seletor de campo de condição sem `id`/`htmlFor`.
- `L235 <Select>` & `L236 <SelectTrigger>`: Seletor de operador sem `id`/`htmlFor`.
- `L243 <Select>` & `L244 <SelectTrigger>`: Seletor de valor de empresa sem `id`/`htmlFor`.
- `L252 <Select>` & `L253 <SelectTrigger>`: Seletor de valor de prioridade sem `id`/`htmlFor`.
- `L262 <Input>`: Input de valor livre de condição sem `id`/`htmlFor` nem `aria-label`.
- `L273 <Select>` & `L274 <SelectTrigger>`: Seletor de ação sem `id`/`htmlFor`.
- `L284 <Select>` & `L285 <SelectTrigger>`: Seletor de técnico alvo sem `id`/`htmlFor`.
- `L297 <Input>`: Input de alvo da ação sem `id`/`htmlFor` nem `aria-label`.

#### 4. `src/components/admin/SLAConfiguration.tsx` (8 órfãos)
- `L154 <Input>`: Rotulado como *"Nome da Política *"*, mas sem `id`/`htmlFor`.
- `L166 <Switch>`: Rotulado como *"Apenas Horário Comercial"*, mas sem vínculo de `id`/`htmlFor`.
- `L176 <Input type="time">`: Horário Início sem vínculo de `id`/`htmlFor`.
- `L184 <Input type="time">`: Horário Fim sem vínculo de `id`/`htmlFor`.
- `L198 <Input type="number">`: Horas Urgente sem `id`/`htmlFor`.
- `L202 <Input type="number">`: Horas Alta sem `id`/`htmlFor`.
- `L206 <Input type="number">`: Horas Média sem `id`/`htmlFor`.
- `L210 <Input type="number">`: Horas Baixa sem `id`/`htmlFor`.

#### 5. `src/components/admin/UserManagement.tsx` (15 órfãos)
- `L577 <Select>` & `L581 <SelectTrigger>`: `<Label htmlFor="department">` aponta para um `id` que **não existe** no `SelectTrigger`.
- `L604 <Select>` & `L610 <SelectTrigger>`: `<Label htmlFor="role">` aponta para um `id` inexistente no `SelectTrigger`.
- `L696 <Select>` & `L700 <SelectTrigger>`: Seletor de departamento no modal de edição sem vínculo.
- `L723 <Select>` & `L727 <SelectTrigger>`: Seletor de empresa sem vínculo no `SelectTrigger`.
- `L749 <Select>` & `L755 <SelectTrigger>`: Seletor de função sem vínculo.
- `L767 <Select>` & `L771 <SelectTrigger>`: Seletor de status sem vínculo.
- `L824 <Select>`: Seletor de transferência de tickets sem `id`/`htmlFor`.
- `L934 <Select>` & `L939 <SelectTrigger>`: Seletor inline de role na tabela sem `aria-label`.

#### 6. `src/components/automation/RuleForm.tsx` (20 órfãos)
- `L66 <Input>`: Nome da regra sem `id`/`htmlFor`.
- `L70 <Input>`: Ordem sem `id`/`htmlFor`.
- `L76 <Input>`: Descrição sem `id`/`htmlFor`.
- `L86 <Select>` & `L87 <SelectTrigger>`: Campo da condição sem `id`/`htmlFor`.
- `L99 <Select>` & `L100 <SelectTrigger>`: Operador da condição sem `aria-label`.
- `L109 <Select>` & `L110 <SelectTrigger>`: Valor da empresa sem `aria-label`.
- `L116 <Select>` & `L117 <SelectTrigger>`: Valor de prioridade sem `aria-label`.
- `L146 <Input>`: Valor de texto sem `aria-label`.
- `L160 <Select>` & `L161 <SelectTrigger>`: Tipo de ação sem `aria-label`.
- `L168 <Select>` & `L169 <SelectTrigger>`: Técnico destino sem `aria-label`.
- `L175 <Select>` & `L176 <SelectTrigger>`: Nova prioridade sem `aria-label`.
- `L205 <Select>` & `L206 <SelectTrigger>`: Resposta pronta sem `aria-label`.

#### 7. `src/components/automation/RulesTab.tsx` (1 órfão)
- `L209 <Switch>`: Toggle de ativação de regra na tabela sem `aria-label`.

#### 8. `src/components/automation/TemplatesTab.tsx` (3 órfãos)
- `L87 <Input>`: Título do template sem `id`/`htmlFor`.
- `L91 <Input>`: Atalho do template sem `id`/`htmlFor`.
- `L96 <Textarea>`: Conteúdo do template sem `id`/`htmlFor`.

#### 9. `src/components/dashboard/TechnicianDashboard.tsx` (10 órfãos)
- `L532 <Input>`: Busca geral de chamados sem `aria-label` ou `id`/`htmlFor`.
- `L564 <Select>` & `L565 <SelectTrigger>`: Filtro de prioridade com `<label>` visual sem `htmlFor`/`id`.
- `L580 <Select>` & `L581 <SelectTrigger>`: Filtro de status com `<label>` visual sem `htmlFor`/`id`.
- `L597 <Select>` & `L598 <SelectTrigger>`: Filtro de categoria com `<label>` visual sem `htmlFor`/`id`.
- `L613 <Select>` & `L614 <SelectTrigger>`: Filtro de SLA com `<label>` visual sem `htmlFor`/`id`.
- `L629 <Input>`: Filtro de empresa sem `id`/`htmlFor`.

#### 10. `src/components/dashboard/TopBar.tsx` (2 órfãos)
- `L77 <input>`: Input oculto de autofill sem acessibilidade.
- `L85 <input>`: Campo de busca global de tickets sem `<label>` ou `aria-label`.

#### 11. `src/components/monitoring/MachineDrawer.tsx` (4 órfãos)
- `L821 <Select>` & `L834 <SelectTrigger>`: Seletor de empresa do ativo sem `id`/`htmlFor`.
- `L873 <Select>` & `L874 <SelectTrigger>`: Seletor de tipo de dispositivo sem `id`/`htmlFor`.

#### 12. `src/components/patch/AgentInstallerCard.tsx` (2 órfãos)
- `L92 <Select>` & `L93 <SelectTrigger>`: Seletor de empresa para download de agente sem `aria-label`.

#### 13. `src/components/patch/DeployDialog.tsx` (4 órfãos)
- `L91 <Select>` & `L92 <SelectTrigger>`: Seletor de grupo de implantação sem `id`/`htmlFor`.
- `L102 <Select>` & `L103 <SelectTrigger>`: Seletor de estratégia sem `id`/`htmlFor`.

#### 14. `src/components/patch/NewPackageDialog.tsx` (6 órfãos)
- `L70 <Input>`: Nome do pacote sem `id`/`htmlFor`.
- `L74 <Select>` & `L75 <SelectTrigger>`: Tipo de pacote sem `id`/`htmlFor`.
- `L87 <Textarea>`: Descrição sem `id`/`htmlFor`.
- `L92 <Input>`: Versão sem `id`/`htmlFor`.
- `L99 <Input>`: URL do instalador sem `id`/`htmlFor`.

#### 15. `src/components/settings/AvatarUpload.tsx` (1 órfão)
- `L125 <input type="file">`: Input de arquivo oculto sem `aria-label`.

#### 16. `src/components/ticket/CannedResponseSelector.tsx` (1 órfão)
- `L63 <Input>`: Busca de resposta rápida sem `aria-label`.

#### 17. `src/components/ticket/EscalateDialog.tsx` (5 órfãos)
- `L57 <Select>` & `L58 <SelectTrigger>`: Técnico destino sem `id`/`htmlFor`.
- `L76 <Select>` & `L77 <SelectTrigger>`: Nova prioridade sem `id`/`htmlFor`.
- `L93 <Textarea>`: Motivo da escalação sem `id`/`htmlFor` nem `aria-label`.

#### 18. `src/components/ticket/ResolutionDialog.tsx` (2 órfãos)
- `L126 <Select>` & `L133 <SelectTrigger>`: Seletor de tipo de resolução sem `aria-label`.

#### 19. `src/components/ticket/SatisfactionSurvey.tsx` (1 órfão)
- `L85 <Textarea>`: Comentário opcional sem `id`/`htmlFor` nem `aria-label`.

#### 20. `src/components/ticket/TimeTracker.tsx` (2 órfãos)
- `L162 <Input type="number">`: Minutos apontados sem `aria-label`.
- `L169 <Input>`: Descrição do apontamento sem `aria-label`.

#### 21. `src/pages/Assets.tsx` (11 órfãos)
- `L384 <Select>` & `L389 <SelectTrigger>`: Empresa do ativo no modal sem vínculo de `id`/`htmlFor`.
- `L401 <Select>` & `L405 <SelectTrigger>`: Tipo do ativo no modal sem vínculo de `id`/`htmlFor`.
- `L490 <Input>`: Barra de pesquisa de ativos sem `aria-label` ou `id`.
- `L512 <Select>` & `L513 <SelectTrigger>`: Filtro de empresa na tabela sem `aria-label`.
- `L528 <Select>` & `L529 <SelectTrigger>`: Filtro de tipo de dispositivo na tabela sem `aria-label`.
- `L544 <Select>` & `L545 <SelectTrigger>`: Filtro de status na tabela sem `aria-label`.

#### 22. `src/pages/Avaliacao.tsx` (1 órfão)
- `L142 <Textarea>`: Feedback de satisfação sem `aria-label`.

#### 23. `src/pages/KnowledgeBase.tsx` (8 órfãos)
- `L520 <Input>`: Campo hero de busca na base de conhecimento sem `aria-label`.
- `L786 <Input>`: Título do artigo sem `id`/`htmlFor`.
- `L796 <Select>` & `L800 <SelectTrigger>`: Categoria do artigo sem `id`/`htmlFor`.
- `L813 <Select>` & `L817 <SelectTrigger>`: Status de publicação sem `id`/`htmlFor`.
- `L829 <Switch>`: Switch "Artigo Público" sem vínculo com o texto ao lado.
- `L838 <Textarea>`: Corpo markdown do artigo sem `id`/`htmlFor`.

#### 24. `src/pages/Monitoring.tsx` (5 órfãos)
- `L800 <Input>`: Campo de busca de máquinas (Grid View) sem `aria-label`.
- `L881 <Input>`: Campo de busca de máquinas (Table View) sem `aria-label`.
- `L892 <Select>` & `L893 <SelectTrigger>`: Filtro de grupo/cliente na tabela sem `aria-label`.
- `L1226 <Select>`: Seletor de comando em lote sem `aria-label`.

#### 25. `src/pages/NewTicket.tsx` (8 órfãos)
- `L721 <Select>` & `L723 <SelectTrigger>`: Seletor de categoria sem `id`/`htmlFor`.
- `L765 <Select>` & `L767 <SelectTrigger>`: Seletor de prioridade sem `id`/`htmlFor`.
- `L789 <Input>`: Campo de ID de acesso remoto sem `aria-label` ou `id`/`htmlFor`.
- `L790 <Input>`: Campo de Senha de acesso remoto sem `aria-label` ou `id`/`htmlFor`.
- `L844 <Select>` & `L845 <SelectTrigger>`: Vínculo de contrato sem `id`/`htmlFor`.
- `L860 <Select>` & `L861 <SelectTrigger>`: Vínculo de equipamento sem `id`/`htmlFor`.

#### 26. `src/pages/Reports.tsx` (6 órfãos)
- `L410 <Input type="date">`: Data Início com `<Label>` visual sem `htmlFor`/`id`.
- `L419 <Input type="date">`: Data Fim com `<Label>` visual sem `htmlFor`/`id`.
- `L428 <Select>` & `L429 <SelectTrigger>`: Filtro de empresa com `<Label>` visual sem `htmlFor`/`id`.
- `L444 <Select>` & `L445 <SelectTrigger>`: Filtro de técnico com `<Label>` visual sem `htmlFor`/`id`.

#### 27. `src/pages/Settings.tsx` (3 órfãos)
- `L414 <Switch>`: Notificações de E-mail sem `id`/`htmlFor` e sem `aria-label`.
- `L430 <Switch>`: Notificações Push sem `id`/`htmlFor` e sem `aria-label`.
- `L457 <Input>`: URL do Webhook readonly com label desconectado.

#### 28. `src/pages/TicketDetails.tsx` (4 órfãos)
- `L825 <input type="file">`: Input de upload oculto sem `aria-label`.
- `L865 <Textarea>`: Caixa de resposta ao cliente e nota interna técnica sem `aria-label` ou `id`/`htmlFor`.
- `L990 <Select>` & `L991 <SelectTrigger>`: Progresso do fluxo com label sem `htmlFor`/`id`.

#### 29. `src/pages/TicketHistory.tsx` (5 órfãos)
- `L103 <Input>`: Barra de busca de histórico sem `aria-label`.
- `L132 <Select>` & `L133 <SelectTrigger>`: Filtro de status com label desconectado.
- `L148 <Select>` & `L149 <SelectTrigger>`: Filtro de prioridade com label desconectado.

#### 30. `src/pages/WebMonitoring.tsx` (7 órfãos)
- `L1175 <Select>` & `L1176 <SelectTrigger>`: Filtro de status web sem `aria-label`.
- `L1191 <Select>` & `L1192 <SelectTrigger>`: Filtro de status links sem `aria-label`.
- `L1231 <Select>` & `L1232 <SelectTrigger>`: Tipo de checagem sem `id`/`htmlFor`.
- `L1245 <Select>` & `L1246 <SelectTrigger>`: Intervalo de checagem sem `id`/`htmlFor`.
- `L1275 <Select>` & `L1276 <SelectTrigger>`: Seletor de empresa do link sem `id`/`htmlFor`.

---

## 5. Recomendações e Plano de Ação para a Fase 2 (Implementação)

### 5.1. Criação dos 4 Componentes Faltantes no Design System
1. **`SearchInput` (`src/components/ui/search-input.tsx`):**
   - Encapsular ícone de lupa, botão de limpar (`X`), suporte a atalho (`Ctrl+K` / `/`), indicador de contagem de resultados e tamanhos padronizados (`sm: h-9`, `default: h-10`, `lg: h-12`).
2. **`DatePicker` & `DateRangePicker` (`src/components/ui/date-picker.tsx`):**
   - Integrar `react-day-picker` com `Popover` e `Button` estilizados no tema do Orion System, substituindo todos os `<Input type="date">` nativos.
3. **`Combobox` (`src/components/ui/combobox.tsx`):**
   - Criar componente de seleção pesquisável reutilizável baseado em `cmdk` e `@radix-ui/react-popover`.
4. **`RadioGroup` (`src/components/ui/radio-group.tsx`):**
   - Instalar `@radix-ui/react-radio-group` e criar o componente padrão com suporte a foco acessível por teclado (setas).

---

### 5.2. Refatoração dos Componentes Base em `src/components/ui/`
1. **`select.tsx`:**
   - Trocar `focus:ring-2 focus:ring-ring` por `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` em `SelectTrigger`, alinhando com `Input` e `Textarea`.
2. **`input.tsx` e `textarea.tsx`:**
   - Adicionar prop `error?: boolean` e estilização condicional para `aria-invalid="true"` (`border-destructive focus-visible:ring-destructive/30`).
3. **`checkbox.tsx`:**
   - Adicionar pseudo-área de toque invisível (`after:absolute after:-inset-2.5`) para atingir 44x44px em telas touch.
4. **`label.tsx`:**
   - Criar variantes no CVA do Label (`default`, `uppercase-micro`, `muted-compact`), eliminando as classes inline arbitrárias.

---

### 5.3. Plano Sistemático de Correção de Acessibilidade (173 Ocorrências)
1. **Em Formulários sem React Hook Form (40 arquivos):**
   - Adicionar `id="campo-nome"` ao `<Input>` / `<SelectTrigger>` / `<Textarea>` / `<Switch>` e `htmlFor="campo-nome"` ao `<Label>`.
2. **Em Barras de Busca e Filtros de Tabela (83 ocorrências):**
   - Adicionar `aria-label="Buscar tickets..."`, `aria-label="Filtrar por prioridade"`, `aria-label="Data de início do relatório"`, etc.
3. **Em Switches e Toggles (11 ocorrências):**
   - Envolver o `<Switch>` e o texto em `<Label htmlFor="switch-id" className="flex items-center gap-2 cursor-pointer">`.

---

## 6. Apêndice: Tabela de Referência de Tokens de Formulário Propostos

| Propriedade | Token Proposto | Valor Tailwind | Aplicação |
| :--- | :--- | :--- | :--- |
| **Altura Padrão** | `--form-control-height-default` | `h-10` (40px) | Inputs, SelectTriggers, DatePickers |
| **Altura Compacta** | `--form-control-height-sm` | `h-9` (36px) | Filtros de tabela, TopBar, barras densas |
| **Altura Hero / Grande** | `--form-control-height-lg` | `h-12` (48px) | Busca principal de tickets e KB |
| **Border Radius** | `--form-control-radius` | `rounded-xl` (12px) | Unificar todos os inputs e selects do Orion System |
| **Focus Ring** | `--form-control-ring` | `focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0` | Anel sutil e moderno de 2px com primary a 20% |
| **Border Padrão** | `--form-control-border` | `border border-border/50 bg-background` | Fundo sólido integrado a Dark/Light mode |
| **Border de Erro** | `--form-control-error` | `border-destructive focus-visible:ring-destructive/20 text-destructive` | Feedback imediato de validação |
