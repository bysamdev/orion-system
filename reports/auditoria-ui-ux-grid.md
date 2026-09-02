# Relatório de Auditoria UI/UX, Grid e Código — Orion System

## 1. Parecer do Subagente F (Advogado do Diabo)

Contra-análise pragmática dos achados dos Subagentes A, B, C, D e E:

* **Refatoração de God Components (`TicketDetails.tsx` e `Reports.tsx`):** **NÃO FAZER ANTES DO MVP.** `TicketDetails.tsx` concentra o núcleo do produto (presença, timer, SLA, anexos, notas, resolução). Fatiá-lo agora trará regressões graves em produção às vésperas do lançamento sem entregar 1 pixel a mais de valor percebido pelo cliente.
* **Purismo de Tokens de Cor (Camadas 1 e 2 CSS):** **NÃO FAZER ANTES DO MVP.** Reescrever classes Tailwind utilitárias (`bg-blue-500/10`) para variáveis CSS abstratas (`var(--state-open-bg)`) não altera a interface para o usuário, mas consome dezenas de horas e gera risco de quebra de build.
* **Migração da Sidebar para shadcn oficial:** **NÃO FAZER.** A sidebar atual (`Sidebar.tsx`) funciona, é estável, tem suporte a mobile (sheet/offcanvas) e cumpre 100% da navegação. Trocar por purismo de biblioteca é retrabalho com risco zero de benefício ao usuário.
* **Auditoria exaustiva de A11y / Headings (`h1`->`h2`->`h3`):** **NÃO FAZER ANTES DO MVP.** O Orion System é um software B2B para equipes internas de TI, não um portal público com leitor de tela obrigatório por regulação governamental. Ajustar títulos não altera a experiência visual.
* **`Recharts` com `React.lazy` em `Reports.tsx`:** **NÃO FAZER.** Quem acessa `/relatorios` quer ver gráficos. Carregamento assíncrono só introduz spinners extras e *cumulative layout shift* (CLS). O bundle de 360 kB afeta apenas quem acessa essa rota específica.
* **O que DEVE ser corrigido de imediato:** Falhas reais de uso: tabelas que quebram em telas de 14" e tablets sem scroll horizontal, colisão visual do âmbar (confunde incidente com rotina), `key={index}` em listas mutáveis (embaralha dados), vazamento de Recharts via `MachineDrawer` no dashboard/monitoramento, e campos com anéis de foco invisíveis.

---

## 2. Tabela Unificada de Achados

| # | Achado | Categoria | Rota/Arquivo | Visibilidade (A/M/B) | Esforço (P/M/G) | Risco de Regressão | Veredito |
|---|---|---|---|:---:|:---:|:---:|:---:|
| 1 | Colisão do Âmbar (Prioridade Média, Em Atendimento, SLA Atenção na mesma linha) | ERRO | `src/lib/state-tokens.ts:45,127,154`, `TechnicianDashboard.tsx:440` | A | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 2 | 7 Tabelas sem `overflow-x-auto` estourando layout em mobile/tablet | ERRO | `TechnicianDashboard.tsx:494`, `UserManagement.tsx:634`, `CompanyManagement.tsx:294,416`, `ContractManagement.tsx:137`, `ResolutionChecklistManagement.tsx:198`, `HistoryTab.tsx:108` | A | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 3 | `key={index}` em listas mutáveis (perda de foco e dados ao excluir itens) | ERRO | `ResolutionChecklistManagement.tsx:166`, `FileUpload.tsx:155`, `NewTicket.tsx:821` | A | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 4 | Classes CSS inválidas `py-0.2` sem efeito de padding vertical | ERRO | `src/pages/WebMonitoring.tsx:457,488,515,547,1042,1067,1093,1122` | M | P | Nulo | **CORRIGIR ANTES DO MVP** |
| 5 | Classes conflitantes `border-none` e `border border-border/40` na mesma tag | ERRO | `src/pages/TicketDetails.tsx:787,1020,1042` | M | P | Nulo | **CORRIGIR ANTES DO MVP** |
| 6 | Vazamento de 360 kB de Recharts em rotas operacionais via `MachineDrawer` | DÉBITO | `MachineDrawer.tsx:73`, `Monitoring.tsx:50`, `Assets.tsx:40`, `AlertsDashboard.tsx:40` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 7 | Anel de foco invisível por opacidade baixa (`focus:ring-primary/20`) | ERRO | `TopBar.tsx:102`, `TechnicianDashboard.tsx:540`, `TicketHistory.tsx:109`, `TicketDetails.tsx:858`, `NewTicket.tsx:664` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 8 | Timer sem cleanup no unmount gerando warning de estado em componente desmontado | ERRO | `src/pages/AlertsDashboard.tsx:290,499` | B | P | Nulo | **CORRIGIR ANTES DO MVP** |
| 9 | `fallback` defensivo ausente em `WorkloadChart` com risco de crash em runtime | INCONSISTÊNCIA | `src/components/dashboard/WorkloadChart.tsx:32` | A | P | Nulo | **CORRIGIR ANTES DO MVP** |
| 10 | `useMyTickets` desviando dados reais em `DEV` com mocks forçados | ERRO | `src/hooks/useMyTickets.ts:151` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 11 | `TabsList` com `flex-wrap` colidindo pílulas em resoluções estreitas | ERRO | `src/pages/Admin.tsx:75`, `src/pages/Automacoes.tsx:33` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 12 | Quebra de largura canônica e padding duplo na Base de Conhecimento | ERRO | `src/pages/KnowledgeBase.tsx:496,532,645` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 13 | Saltos de grid RMM (`md:grid-cols-2` direto para `2xl:grid-cols-3` em telas 1080p) | INCONSISTÊNCIA | `src/pages/Monitoring.tsx:462,498,554` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 14 | Cores fixas em botões inline (`bg-indigo-600` em drawer) | INCONSISTÊNCIA | `src/components/monitoring/MachineDrawer.tsx:846` | B | P | Nulo | **CORRIGIR ANTES DO MVP** |
| 15 | `text-muted-foreground/50` com contraste ilegível (2.17:1) sob luz forte | ERRO | `TopBar.tsx:102,110`, `TechnicianDashboard.tsx:802`, `TicketHistory.tsx:232` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 16 | Botões icon-only sem `aria-label` nas tabelas principais | ERRO | `TicketHistory.tsx:242,254`, `Assets.tsx:864-932`, `CompanyManagement.tsx:374`, `ContractManagement.tsx:246` | B | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 17 | `as unknown as` mascarando consulta de `api_keys` | ERRO | `src/components/admin/CompanyManagement.tsx:102` | B | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 18 | Re-sincronização de form com props do Supabase Realtime no `MachineDrawer` | ERRO | `src/components/monitoring/MachineDrawer.tsx:520-526` | M | P | Baixo | **CORRIGIR ANTES DO MVP** |
| 19 | Inconsistência de densidade de tabela entre Dashboard (`h-12`) e Histórico (`h-11`) | INCONSISTÊNCIA | `TechnicianDashboard.tsx:744`, `TicketHistory.tsx:201`, `Assets.tsx:677` | M | M | Baixo | PÓS-LANÇAMENTO |
| 20 | Conflito `--radius` vs `rounded-*` espalhado em 651 ocorrências | DÉBITO | Base inteira (`src/`) | B | M | Baixo | PÓS-LANÇAMENTO |
| 21 | Inputs órfãos sem associação estrita de `htmlFor`/`id` | ERRO | `ContractManagement.tsx:279`, `SLAConfiguration.tsx:155`, `Assets.tsx:384` | B | M | Baixo | PÓS-LANÇAMENTO |
| 22 | Hierarquia quebrada de headings (`h1` pulando para `h3` e `h4`) | ERRO | `TicketDetails.tsx:779`, `TechnicianDashboard.tsx:81`, `NewTicket.tsx:500` | B | P | Baixo | PÓS-LANÇAMENTO |
| 23 | Re-render por dependências faltantes em `FileUpload.tsx` | INCONSISTÊNCIA | `src/components/ticket/FileUpload.tsx:74,87` | B | P | Nulo | PÓS-LANÇAMENTO |
| 24 | Subcontainer simulação flex na lista de endpoints web | INCONSISTÊNCIA | `src/pages/WebMonitoring.tsx:688-740` | M | M | Baixo | PÓS-LANÇAMENTO |
| 25 | Desalinhamento vertical de cartões de máquina com/sem alertas | INCONSISTÊNCIA | `src/components/monitoring/MachineCard.tsx:395-425` | B | P | Baixo | PÓS-LANÇAMENTO |
| 26 | God Component: `TicketDetails.tsx` (1.445 linhas / 15 responsabilidades) | DÉBITO | `src/pages/TicketDetails.tsx` | B | G | Alto | PÓS-LANÇAMENTO |
| 27 | God Component: `Reports.tsx` (1.194 linhas / 6 queries / 7 gráficos) | DÉBITO | `src/pages/Reports.tsx` | B | G | Médio | PÓS-LANÇAMENTO |
| 28 | Sidebar customizada ignorando `ui/sidebar.tsx` oficial do shadcn | DÉBITO | `src/components/dashboard/Sidebar.tsx` | B | M | Médio | **NÃO FAZER** |
| 29 | Migração de classes Tailwind de estado para CSS Variables 3-layer puro | DÉBITO | `src/index.css`, `src/lib/state-tokens.ts` | B | G | Médio | **NÃO FAZER** |
| 30 | `Recharts` com `React.lazy` dentro da rota de Relatórios | DÉBITO | `src/pages/Reports.tsx:55` | B | P | Baixo | **NÃO FAZER** |

---

## 3. Lote de Correções Mecânicas (Baixo Risco, Alto Impacto)

Correções pontuais, sintáticas e diretas agrupadas para execução rápida e segura:

1. **Classes CSS Inválidas e Conflitantes:**
   * `src/pages/WebMonitoring.tsx` (8 ocorrências): Substituir classe fantasma `py-0.2` por `py-0.5`.
   * `src/pages/TicketDetails.tsx` (3 ocorrências): Remover `border-none` que colide com `border border-border/40` nas linhas 787, 1020 e 1042.
   * `src/components/monitoring/MachineDrawer.tsx` (1 ocorrência): Trocar `bg-indigo-600` inline da linha 846 pela variante padrão semântica.
2. **Defensiva de Runtime e Vazamentos:**
   * `src/components/dashboard/WorkloadChart.tsx` (1 ocorrência): Inserir `(workload ?? []).reduce(...)` na linha 32.
   * `src/pages/AlertsDashboard.tsx` (1 ocorrência): Adicionar `useEffect` de cancelamento do `refreshTimerRef` na desmontagem.
   * `src/components/monitoring/MachineDrawer.tsx` (1 ocorrência): Mudar dependência de sincronização de `[machine]` para `[machine?.id]` na linha 526.
3. **Listas Mutáveis com Chaves Estáveis (`key`):**
   * `src/components/admin/ResolutionChecklistManagement.tsx` (L166): Trocar `key={index}` por identificador estável.
   * `src/components/ticket/FileUpload.tsx` (L155): Trocar `key={index}` por `key={`${file.name}-${file.size}`}`.
   * `src/pages/NewTicket.tsx` (L821): Trocar `key={i}` por `key={`${f.name}-${f.size}`}`.
4. **Quebra de Containers e Tabs:**
   * `src/pages/Admin.tsx` (L75) e `src/pages/Automacoes.tsx` (L33): Trocar `flex-wrap` por `flex-nowrap overflow-x-auto` no `TabsList`.
   * `src/pages/KnowledgeBase.tsx` (L496, 532): Remover `lg:px-12` e `max-w-4xl` redundantes para alinhar com o layout global de 1600px.
   * `src/pages/Monitoring.tsx` (L462): Adicionar `xl:grid-cols-3` no grid de máquinas RMM para monitores 1080p.
5. **Acessibilidade Rápida (Foco e Nomes):**
   * `TopBar.tsx`, `TechnicianDashboard.tsx`, `TicketHistory.tsx`, `TicketDetails.tsx`: Mudar `focus-visible:ring-primary/20` para `focus-visible:ring-primary` (anel de foco nítido).
   * `TicketHistory.tsx` (L242, 254): Adicionar `aria-label="Página anterior"` e `aria-label="Próxima página"` nos botões de chevron.

**Contagem de arquivos no lote mecânico:** 11 arquivos · ~25 linhas modificadas · Risco de regressão: quase zero.

---

## 4. Ficha das 3 Correções Estruturais Prioritárias

### Correção 1: Descolamento Semântico do Âmbar e Ciclo de Vida do Chamado
* **Abordagem:** Mover o status "Em Atendimento" para Ciano/Info (`cyan-500` / `#06b6d4`), reservando Âmbar estritamente para alertas térmicos/SLA e Laranja/Vermelho para risco/urgência.
* **Arquivos Tocados:** `src/lib/state-tokens.ts`, `src/components/dashboard/TechnicianDashboard.tsx`, `src/pages/ClientPortal.tsx`, `src/components/ticket/UnifiedTimeline.tsx`.
* **O que pode quebrar:** Se houver testes unitários que busquem a classe textual `bg-amber-500` para validar o status em atendimento (verificado: `state-tokens.test.ts` já aceita a paleta via contrato).
* **Critério de Sucesso Verificável:** Na tabela do dashboard do técnico, uma linha com chamado de prioridade "Média" em status "Em Atendimento" exibe badge amarelo na prioridade e badge ciano no status, sem colisão de cor.
* **Contra-argumento do Subagente F:** *"Mudar a cor de 'Em Atendimento' causa churn visual para técnicos já habituados com o amarelo atual."*
  * **Resposta:** A colisão atual gera fadiga de alerta (*alert fatigue*). Três badges âmbar na mesma linha fazem o técnico ignorar alertas reais de SLA estourando. A mudança melhora a eficiência cognitiva operacional imediatamente.

---

### Correção 2: Envolvimento com `overflow-x-auto` nas 7 Tabelas Administrativas e Operacionais
* **Abordagem:** Envolver as tags `<Table>` em contêineres `<div className="w-full overflow-x-auto">` com classe `min-w-[600px]` a `min-w-[800px]`.
* **Arquivos Tocados:** `TechnicianDashboard.tsx:494`, `UserManagement.tsx:634`, `CompanyManagement.tsx:294,416`, `ContractManagement.tsx:137`, `ResolutionChecklistManagement.tsx:198`, `HistoryTab.tsx:108`.
* **O que pode quebrar:** Barras de rolagem duplas se o card pai tiver altura fixa.
* **Critério de Sucesso Verificável:** Em viewport mobile (375px) e tablet (768px), o layout do card permanece contido sem transbordar a tela, e as tabelas rolam suavemente na horizontal.
* **Contra-argumento do Subagente F:** *"Analistas de suporte usam monitores de 24 polegadas no escritório, ninguém gerencia contratos pelo celular."*
  * **Resposta:** Em telas divididas (50% da tela em monitor Full HD), o espaço disponível é de 960px, momento exato em que a tabela de contratos (8 colunas) e a tabela de técnicos estouram e quebram a interface.

---

### Correção 3: Desacoplamento do Recharts no Carregamento Inicial via `MachineDrawer`
* **Abordagem:** Transformar a importação de `PerformanceChart` dentro de `MachineDrawer.tsx` em `React.lazy(() => import('./PerformanceChart'))` com `<Suspense fallback={<Skeleton />}>`.
* **Arquivos Tocados:** `src/components/monitoring/MachineDrawer.tsx:73`.
* **O que pode quebrar:** Flash breve de loading ao abrir a aba "Performance" de uma máquina específica pela primeira vez.
* **Critério de Sucesso Verificável:** O chunk `generateCategoricalChart-*.js` (360 kB) deixa de ser baixado no carregamento de `/sistemas`, `/ativos` e `/central-alertas`, sendo transferido sob demanda apenas se o drawer for acionado.
* **Contra-argumento do Subagente F:** *"360 kB gzipped é 100 kB, o usuário carrega isso em 50ms em banda larga moderna."*
  * **Resposta:** Reduz 100 kB de dados transferidos no carregamento das 3 telas principais de operação, acelerando o LCP em conexões 4G/instáveis de clientes no primeiro acesso.

---

## 5. O que Fica Como Está (Decisões Acatadas do Subagente F)

1. **Refatoração de `TicketDetails.tsx` (1.445 linhas):** Mantido intacto. O risco de quebrar regras de negócio, temporizadores, upload de imagens e presença no Supabase às vésperas do MVP é proibitivo. Ficará agendado para o ciclo Pós-MVP.
2. **Refatoração de `Reports.tsx` (1.194 linhas):** Mantido intacto. Funciona perfeitamente, gera os PDFs e XLSX sem falhas e é usado pontualmente por gestores.
3. **Reescrita da Sidebar com `@/components/ui/sidebar.tsx`:** Rejeitada em definitivo. A sidebar atual está estabilizada e estilizada conforme a marca Orion System. Reconstruí-la gera zero ganho visual para o usuário final.
4. **Purismo de Camadas de Tokens CSS (`--state-*` em CSS Variables puras):** Não será realizada a substituição de classes utilitárias por variáveis manuais CSS. O Tailwind continuará compilando as classes mapeadas em `state-tokens.ts`.
5. **Hierarquia estrita de Headings (`h1`, `h2`, `h3`):** Mantida como está para o MVP. Ajuste cosmético sem impacto na operação da plataforma.

---

## 6. Decisões que Dependem do Usuário

### Decisão Principal: Cor Definitiva do Status "Em Atendimento"

| Opção | Proposta | Impacto Visual | Prós | Contras |
|---|---|---|---|---|
| **Opção A** | **Roxo / Primário** (`--primary` / `hsl(262 83% 58%)`) | Badges na mesma cor dos botões de ação e cabeçalho da marca. | Fortalece a cor da marca no dashboard. | **Alta colisão visual com botões principais (CTAs)** e tabs ativas. Parece um botão clicável. Conflita com "Aguardando Cliente". |
| **Opção B** *(Recomendada)* | **Ciano / Info** (`cyan-500` / `hsl(189 94% 43%)`) | Badge em tom azul-piscina/ciano vibrante. | **Zero colisão com botões primários.** Distinção nítida entre "Aberto" (azul puro), "Em Atendimento" (ciano) e "Média" (âmbar). Código já preparado em `state-tokens.ts`. | Requer manter tom saturado no Dark Mode para contraste adequado. |

---
**FIM DA FASE 2. Nenhuma alteração de código foi realizada. Aguardando sua aprovação e decisão de cor.**