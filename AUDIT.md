# Auditoria Técnica — Orion System

**Data da auditoria:** 2026-08-11 · **Última atualização:** 2026-08-11 (pós-implementação)
**Escopo:** Frontend (React + Vite + TS), camada de dados (Supabase/Postgres),
bundle e fluxo de abertura de chamados.

**Como ler este documento:** cada item tem impacto (Alto/Médio/Baixo), esforço
e agora também **status**. A seção 0 é o punch list priorizado; as seções 1–6
têm o detalhamento completo com referências `arquivo:linha`. Itens marcados
✅ foram implementados, testados e commitados nesta mesma sessão — ver a
seção **"Log de implementação"** logo após o resumo executivo para a lista
completa de commits e métricas antes/depois.

⚠️ Este documento deixou de ser "somente leitura": dos 19 itens listados na
seção 0, **11 foram corrigidos por completo** e **1 parcialmente**. Os
demais foram **deliberadamente pulados** — 4 porque exigiam editar arquivos
que já tinham mudanças não commitadas de fora desta sessão (`AuthContext.tsx`,
`useUserRole.ts`, `useMyTickets.ts`, `useTickets.ts`, `TicketDetails.tsx`,
`NewTicket.tsx`, `TicketHistory.tsx`, `PriorityBadge.tsx` — em especial o
bypass de autenticação descrito no achado crítico abaixo, que segue **sem
correção**, intocado por segurança), e 2 por estarem fora de escopo de
código (decisão de produto/processo, não uma linha pra mudar).

---

## ⚠️ Achado crítico adicional (working tree não commitada, fora da varredura original)

Entre a versão original desta auditoria e agora, `AuthContext.tsx` e `useUserRole.ts`
foram alterados no working tree (ainda não commitados — ver `git diff`). O bypass de
autenticação de desenvolvimento, que antes só ativava com `?testAuth=1` explícito na
URL, agora ativa **incondicionalmente sempre que `import.meta.env.DEV === true`**:

- [`src/contexts/AuthContext.tsx:41-53`](src/contexts/AuthContext.tsx#L41) — não checa
  mais `testAuth`, só `import.meta.env.DEV`. Cria uma sessão fake
  (`test-user`/`test@orion.com`) sem nenhuma chamada real ao Supabase Auth.
- [`src/hooks/useUserRole.ts:19-23`](src/hooks/useUserRole.ts#L19) — `testRole` agora
  tem fallback `'admin'` (antes exigia o parâmetro e não tinha default).
- [`src/hooks/useUserRole.ts:51-65`](src/hooks/useUserRole.ts#L51) — mesmo padrão em
  `useUserProfile`, perfil mock sempre retornado em `DEV`.

**Por que isso importa:** `package.json:9` tem o script `"build:dev": "vite build
--mode development"`, que gera um bundle de produção com `import.meta.env.DEV = true`.
Qualquer deploy feito com esse script (nome sugere justamente uso em
homologação/staging) resulta em **login automático como usuário fake com role admin
para qualquer visitante**, sem tocar no Supabase Auth real — bypassa toda a política de
RLS que depende de `auth.uid()`, já que o token é fabricado no cliente. Isso não existe
com `npm run build` (modo `production`, `DEV=false`), mas o risco é real para qualquer
pipeline de homolog que use `build:dev` ou `vite dev` exposto fora de `localhost`.

**Recomendação:** Impacto **Crítico**, esforço **trivial** — reverter para checar um
segredo/flag explícito (ex.: `import.meta.env.VITE_ENABLE_AUTH_BYPASS === 'true'`
setado só em `.env.development.local`, nunca em CI/build de homolog), e nunca usar só
`import.meta.env.DEV` como guarda, já que `build:dev` também seta essa flag como `true`.

**Status: ❌ NÃO CORRIGIDO.** Deliberadamente não tocado nesta sessão de
implementação — o código do bypass vive em `AuthContext.tsx`/`useUserRole.ts`,
que já tinham mudanças locais não commitadas antes desta sessão começar (é o
"stand-in de login" do ambiente de homolog). Continua sendo o item de maior
risco em aberto no repositório.

---

## 0. Resumo executivo (ordem de prioridade)

| # | Item | Categoria | Impacto | Esforço | Status |
|---|------|-----------|---------|---------|--------|
| 0 | Bypass de auth ativa sem parâmetro de URL, default role `admin`, vaza para `build:dev` | **Segurança** | **Crítico** | Trivial | ❌ Não corrigido (arquivo com mudanças locais não commitadas) |
| 1 | Notificação de mudança de status não persiste (só toast local) | Fluxo de chamados | **Alto** | Baixo (1 migration) | ✅ `800b65c` |
| 2 | `useHistoricalStats.ts` faz 60–180 queries sequenciais (N+1 real) | Queries N+1 | **Alto** | Baixo–médio (1-2h) | ✅ `7b52d66` — também corrigido bug de range de data invertido (ver nota) |
| 3 | `recharts` (112 KB gzip) carregado no dashboard padrão de todo usuário | Bundle | **Alto** | Médio (2-4h) | ✅ `2615fa0` |
| 4 | `TicketFilters.tsx` morto + lógica de filtro duplicada em `TechnicianDashboard` | Componentes duplicados | Alto | 3h | 🟡 Parcial — arquivo morto removido (`ce21f7f`); extrair o filtro duplicado do `TechnicianDashboard` ainda pendente |
| 5 | `escalate_manager` virou no-op silencioso, mas continua na UI de admin | Fluxo de chamados | Médio–Alto | Baixo | ✅ `80862ae` — diagnóstico original estava incompleto (ver nota) |
| 6 | Status/Priority badges reimplementados de forma divergente em 2 telas | Componentes duplicados | Alto | 2h | ✅ `1f71ee2` |
| 7 | `companies` buscado sob 6 chaves de cache diferentes (sem dedupe) | Cache/API | Médio–Alto | Baixo | ✅ `e085ee1` + `2b5e09c` — achada uma 7ª duplicata no caminho |
| 8 | Polling (30-60s) redundante com realtime já invalidando as mesmas queries | Cache/API | Médio–Alto | Baixo | ⏭️ Pulado — `useMyTickets.ts` tem mudanças locais não commitadas |
| 9 | `AuthContext` recria o value object a cada render (sem `useMemo`) | Estado | Médio | Baixo | ⏭️ Pulado — `AuthContext.tsx` tem mudanças locais não commitadas |
| 10 | `enrichTicketsWithCompany` refaz fetch de profiles/companies sem cache, 3-4x por ciclo de poll | Cache/API | Médio | Médio | ⏭️ Pulado — consumidores estão em `useMyTickets.ts` (não commitado) |
| 11 | Card/lista (`MachineCard`, `TicketRow`) sem `React.memo` sob polling/realtime | Estado | Médio | Médio | ✅ `abd7e73` |
| 12 | Notificação/card de notificação duplicado (popover vs página) | Componentes duplicados | Médio | 1.5h | ✅ `419f3be` |
| 13 | `TicketDetails.tsx` — 1230 linhas, 0 `useMemo`/`useCallback` | Estado | Baixo–médio | Alto (refactor) | ⏭️ Pulado — `TicketDetails.tsx` tem mudanças locais não commitadas |
| 14 | `next-themes` instalado e não usado; 8 componentes shadcn sem consumidor | Bundle | Baixo | Trivial | ✅ `7b26b5f` — só a dependência morta; os 8 componentes shadcn ficaram (baixo valor, sem impacto de bundle) |
| 15 | Dead code em `useStats.ts`/`useDashboardStats.ts` (hooks nunca importados, com fetch duplicado interno) | Cache/API | Baixo | Baixo | ✅ `8655a1c` — removido por completo, não só corrigido |
| 16 | `email-to-ticket` edge function órfã (não conectada a nenhum gatilho) | Fluxo de chamados | Baixo | Médio (depende de provedor externo) | ⏭️ Fora de escopo — decisão de produto (qual provedor conectar), não é fix de código |
| 17 | Dois clientes Supabase (`supabase`/`supabaseRead`) usados de forma inconsistente | Cache/API | Baixo | Baixo–médio | ✅ `2b5e09c` |
| 18 | Churn de schema em `tickets` (23/100 migrations alteram a tabela, várias de "repair/fix") | Índices/N+1 | Médio (processo) | — | ⏭️ Fora de escopo — processo de review de migrations, não é código |

---

## Log de implementação (2026-08-11)

13 commits, um item por commit, cada um testado antes de commitar (type-check
completo + build; mudanças de banco testadas ao vivo no Supabase via
transação com `ROLLBACK` antes de aplicar de verdade). Os 2 primeiros foram
aplicados/publicados durante a sessão; os 11 seguintes ficaram como commits
locais para revisão antes do push.

| Commit | O que fez | Métrica antes → depois |
|---|---|---|
| `800b65c` | Trigger de notificação passa a tratar `status_change`, não só `comment` | 0% dos eventos de status geravam notificação → 100% (testado com ticket real) |
| `80862ae` | Corrige `tr_auto_route_ticket()` — a função **realmente** presa ao trigger de roteamento (ver nota abaixo) | Crash garantido em regras `round_robin`/`set_priority`/`notify_all` → não quebra mais |
| `7b52d66` | `useHistoricalStats.ts`: 2 queries por dia → 2 queries totais (paralelas); corrige range de data invertido | 180 round-trips seriais → 2; resultado sempre-zero → correto (7 chamados reais confirmados p/ 2026-08-03) |
| `2615fa0` | `recharts` deixa de ser `modulepreload`ado no dashboard padrão (fix duplo: lazy-load + remoção do `manualChunks` forçado) | `<link rel="modulepreload">` de 412KB/109KB gzip presente → ausente no `dist/index.html` |
| `ce21f7f` | Remove `TicketFilters.tsx` (código morto, taxonomia de categoria já desatualizada) | 103 linhas removidas |
| `1f71ee2` | `DebugTools.tsx`/`Assets.tsx` passam a usar `StatusBadge`/`PriorityBadge` canônicos | 2 implementações de cor cruas → 1 componente compartilhado cada |
| `e085ee1` | `useCompanies()` único substitui 6 queries de `companies` duplicadas + corrige bug de coluna inexistente (`is_vip`) | 6 chaves de cache → 1; erro Postgrest silenciosamente engolido → corrigido |
| `419f3be` | `NotificationItem` compartilhado substitui a duplicação popover/página | 122 linhas duplicadas → 97 linhas com 1 componente |
| `abd7e73` | `React.memo` em `MachineCard`/`TicketRow` + fix de identidade de callback que o teria neutralizado | Callback recriado a cada render → referência estável (`setSelectedMachine`) |
| `7b26b5f` | Remove dependência `next-themes` (zero imports) | Build verificado limpo pós-remoção |
| `8655a1c` | Remove `useStats.ts`, `useDashboardStats.ts`, `useUnassignedTickets` (código morto) | 287 linhas removidas |
| `2b5e09c` | Padroniza `supabaseRead` para SELECTs puros; consolida uma 7ª duplicata de `companies` achada no caminho (`useManagementCompanies`) | 4 hooks migrados; mutations continuam no client de escrita, corretamente |

**Achado que não estava na auditoria original — corrigido em `80862ae`:**
A auditoria original (seção 6, item 2 abaixo) descrevia `fn_auto_route_ticket()`
como a função de roteamento quebrada. Ao testar a correção contra o Supabase
real, descobri que **essa função existe no banco mas não está presa a
nenhum trigger** — é código morto. A função que **realmente** roda a cada
chamado criado é `tr_auto_route_ticket()` (trigger `AFTER INSERT`), nunca
descrita em nenhum arquivo de migration local, com um bug mais grave: fazia
`(regra.actions->>'target')::uuid` **sem checar o tipo da ação** — qualquer
regra `round_robin`/`set_priority`/`notify_all` (todas oferecidas na tela de
admin) quebraria o `INSERT` inteiro em `tickets` com erro de cast, ou seja,
o cliente não conseguiria abrir o chamado. Isso também expôs que os arquivos
em `supabase/migrations/` não refletem 100% o estado real do banco (a
tabela de controle de migrations do Supabase para em março, mas o schema já
tem colunas de abril+) — vale investigar como isso ficou dessincronizado.

---

## 1. Componentes React duplicados ou com responsabilidades sobrepostas

**1.1 — `TicketFilters.tsx` morto + filtro duplicado à mão em `TechnicianDashboard`** — Alto, ~3h
`src/components/dashboard/TicketFilters.tsx` (104 linhas) não é importado em
lugar nenhum do repositório. Enquanto isso, `src/components/dashboard/TechnicianDashboard.tsx:169-478`
reimplementa a mesma UI de filtro (busca, prioridade, categoria, status) com
seis `useState` separados e ~100 linhas de `SelectItem` copiadas na mão.
Ação: extrair o bloco de filtro do `TechnicianDashboard` para um componente
compartilhado e apagar o arquivo morto (ou fundir os dois).

🟡 **Parcial — `ce21f7f`.** O arquivo morto foi removido (103 linhas; também
confirmado que sua taxonomia de categorias já estava desatualizada, nem
seria reaproveitável como estava). A extração do filtro inline do
`TechnicianDashboard` (~100 linhas) **não foi feita** — é um refactor maior
num arquivo de 600+ linhas que não dava pra validar visualmente sem rodar a
app num browser nesta sessão.

**1.2 — Status/Priority badges reimplementados de forma divergente** — Alto, ~2h
`src/components/shared/StatusBadge.tsx` e `PriorityBadge.tsx` são a versão
canônica (cores consistentes, labels em PT-BR), usados corretamente em
`TicketDetails.tsx`, `TicketHistory.tsx`, `Reports.tsx`, `TechnicianDashboard.tsx`.
Duas telas divergem:
- `src/pages/DebugTools.tsx:354-361` — `getPriorityBadge()` local, mapa de cor
  próprio (`urgent: bg-red-500` vs `bg-destructive/10` do componente
  compartilhado) e renderiza a chave em inglês (`"urgent"`) em vez do label
  traduzido.
- `src/pages/Assets.tsx:594-598,606-607` — dot de status e `<Badge>` inline
  mostrando o status cru (não traduzido), com mapa de cor próprio.
Efeito: o mesmo status/prioridade aparece com cor e idioma diferentes
dependendo da tela. Ação: substituir os dois por `<StatusBadge>`/`<PriorityBadge>`.

✅ **Corrigido — `1f71ee2`.** Os dois pontos substituídos pelos componentes
canônicos. Zero erro de tipo novo (os erros pré-existentes em `Assets.tsx`
são de uma anotação de tipo incompleta não relacionada, confirmados antes e
depois da mudança).

**1.3 — Card de notificação duplicado (popover vs. página)** — Médio, ~1.5h
`src/components/dashboard/NotificationsPopover.tsx:16-79` (`NotificationItem`)
e `src/pages/Notifications.tsx:79-131` reimplementam a mesma estrutura
(ícone, título, mensagem, timestamp relativo via `formatDistanceToNow`,
estilo lido/não-lido) quase linha a linha, só variando padding/tamanho de
ícone. Ação: um componente único com prop `size`/`variant`.

✅ **Corrigido — `419f3be`.** Extraído para
`src/components/shared/NotificationItem.tsx` com prop `size` (`'sm' |
'default'`), seguindo o mesmo padrão de `PriorityBadge`/`StatusBadge`.
122 linhas duplicadas → 97 linhas com o componente compartilhado.

**1.4 — Linha de tabela copiada dentro do mesmo arquivo** — Médio, ~1h
`TechnicianDashboard.tsx` já tem um componente `TicketRow` reutilizável
(linhas 103-144, usado na aba "Meus Chamados", linha 516), mas a aba "Fila
de Espera" (linhas 546-577) reimplementa a mesma `<TableRow>` na mão em vez
de estender `TicketRow` com um slot de ação opcional.

⏭️ **Não corrigido.** `TicketRow` ganhou `React.memo` nesta sessão (ver
3.2/`abd7e73`), mas a duplicação manual na aba "Fila de Espera" continua —
mesmo refactor maior citado em 1.1, não feito por falta de validação visual.

**1.5 — Menor** — Baixo
`src/pages/AlertsDashboard.tsx:132` deriva cor de badge via manipulação de
string (`colorClass.replace(...)`) em vez de lookup table — frágil, mas
baixo impacto.

**Verificado e sem problema:** os 39 arquivos restantes em `admin/`,
`automation/`, `patch/`, `monitoring/`, `ticket/`, `settings/` têm um único
importador cada (sem código morto). `MachineCard` vs `PackageCard` e
`Assets.tsx` vs `InventoryTab.tsx` cobrem modelos de dados genuinamente
diferentes (CMDB vs. telemetria ao vivo) — não são duplicação.

---

## 2. Chamadas de API/Supabase redundantes ou sem cache

**Base (não é problema):** `QueryClient` está configurado corretamente em
`src/App.tsx:37-44` (`staleTime: 5min`, `refetchOnWindowFocus: false`), e 19
dos 22 hooks usam `useQuery`/`useMutation` de fato — o caching via
react-query existe e funciona, não é decorativo.

**2.1 — `companies` buscado sob 6 chaves de cache diferentes** — Médio/Alto, esforço baixo
O mesmo `SELECT id, name FROM companies` é disparado com chaves distintas
(`'all-companies'`, `'companies'`, `'companies-list'`, `'admin-companies'`)
em `useAutomation.ts:101`, `UserManagement.tsx:82`, `Assets.tsx:82`,
`CompanyManagement.tsx:47`, `ContractManagement.tsx:58`, `Reports.tsx:42`,
`RoutingRulesManagement.tsx:146-149`. Como o react-query dedupe é por chave,
nada aqui compartilha cache. Ação: um `useCompanies()` único.

✅ **Corrigido — `e085ee1` + `2b5e09c`.** `src/hooks/useCompanies.ts` novo,
chave própria `['company-options']` (para não colidir com o `['companies']`
de `CompanyManagement.tsx`, que busca o registro completo via `select('*')`
para o CRUD — uma colisão de chave latente que também existia e foi
evitada). No caminho, achei um bug real: `useAllCompanies()`
(`useAutomation.ts`) selecionava uma coluna `is_vip` que **não existe** em
`companies` (o dado vem de `settings->>'is_vip'`) — o erro do Postgrest era
engolido silenciosamente porque a query só desestruturava `data`, nunca
`error`. E uma 7ª duplicata que a auditoria original não pegou:
`useManagementCompanies()` em `useMonitoring.ts` (chave `['management',
'companies']`), consolidada também em `2b5e09c`.

**2.2 — Polling redundante com realtime já invalidando as mesmas queries** — Médio/Alto, esforço baixo
`useRealtimeTickets.ts:20-46` já invalida `['tickets']`,
`['unassigned-tickets-enhanced']`, `['sla-at-risk-tickets']`,
`['my-active-tickets']`, `['my-recent-closed']` a cada mudança via Supabase
Realtime. Os hooks por trás dessas chaves (`useMyTickets.ts:27,55,78,104`)
também têm `refetchInterval` de 30-60s, e `TechnicianDashboard.tsx:156-159,178`
monta os dois mecanismos juntos. Ação: remover o `refetchInterval` (ou usá-lo
só como rede de segurança com intervalo bem maior).

⏭️ **Pulado.** O fix é em `useMyTickets.ts`, que já tinha mudanças locais não
commitadas antes desta sessão (fora do meu controle) — evitado por segurança
pra não misturar com esse WIP.

**2.3 — `enrichTicketsWithCompany` sem cache, chamado 3-4x por ciclo** — Médio, esforço médio
`src/lib/ticket-helpers.ts:16-25` faz fetch cru (fora do react-query) de
`profiles`+`companies` toda vez que é chamado. É chamado separadamente por
`useMyActiveTickets`, `useSLAAtRiskTickets`, `useUnassignedTicketsEnhanced`,
`useMeusTickets` — todos montados juntos no dashboard técnico, todos
repetindo o mesmo lookup a cada poll de 30s.

⏭️ **Pulado.** Os quatro consumidores estão em `useMyTickets.ts`, com
mudanças locais não commitadas — mesmo motivo do item 2.2.

**2.4 — Dead code com fetch duplicado interno** — Baixo (sem custo em runtime hoje)
`useTicketStats`, `useGlobalTicketStats`, `useActiveOperators`
(`src/hooks/useStats.ts`) e `useDashboardStats` (`src/hooks/useDashboardStats.ts`)
não são importados em lugar nenhum — código morto confirmado via grep. Se
reativados, corrigir primeiro: `useGlobalTicketStats` busca `resolvedToday`
(linhas 119-125) e nunca usa o resultado — só `resolvedTodayFull` (linhas
128-134) é usado; mesmo padrão em `useTicketStats` (`solvedTickets` descartado,
`solvedTicketsWithPriority` usado). `useUnassignedTickets` em
`useTechnicianStats.ts:127-144` também é código morto, superado por
`useUnassignedTicketsEnhanced`.

✅ **Corrigido — `8655a1c`.** Em vez de corrigir bugs em código que nunca
roda, os três arquivos/hooks foram **removidos por completo**:
`useStats.ts`, `useDashboardStats.ts` e `useUnassignedTickets` (dentro de
`useTechnicianStats.ts`). 287 linhas de código morto a menos. Confirmado via
grep (zero importadores) e type-check completo pós-remoção (zero erros).

**2.5 — Dois clientes Supabase usados de forma inconsistente** — Baixo hoje, esforço baixo-médio
`src/integrations/supabase/read-client.ts:12` cai no mesmo `SUPABASE_URL` do
client de escrita a menos que `VITE_SUPABASE_READ_URL` esteja setada — hoje
não há réplica de leitura configurada, então os dois batem no mesmo banco.
O uso não é padronizado: alguns hooks usam `supabaseRead` para leitura
(`useMyTickets.ts`, `useTickets.ts`, `useStats.ts`, `useHistoricalStats.ts`,
`useTicketRating.ts`, `useAutomation.ts`), outros usam o client de escrita
`supabase` para SELECTs puros (`useTechnicianStats.ts`, `useDashboardStats.ts`,
`useMonitoring.ts`, `useUserRole.ts`, `useNotifications.ts`, `useSLAConfigs.ts`,
`usePlanUsage.ts`). Sem bug funcional agora, mas se uma réplica de leitura
for ativada, ~metade do tráfego de leitura não se beneficia até padronizar.

✅ **Corrigido — `2b5e09c`.** `useNotifications.ts`, `useSLAConfigs.ts`,
`usePlanUsage.ts` e `useTechnicianStats.ts` migrados para `supabaseRead` em
todo SELECT puro (incluindo chamadas `.rpc()` de leitura). Mutations
(os dois `UPDATE` em `useNotifications.ts`) ficam corretamente no client de
escrita. `useMonitoring.ts` mantém `supabase.auth.getSession()` no client de
escrita deliberadamente — estado de sessão deve vir de uma fonte só.
`useUserRole.ts` **não foi tocado** (mudanças locais não commitadas).

**Realtime cleanup — verificado, sem problema:** `useRealtimeTickets` usa
padrão singleton global + refcount corretamente (linhas 11-57);
`useRealtimeTicket`/`DebugTools.tsx:80-99` fazem `removeChannel` no unmount.
Sem vazamento ou subscrições empilhadas.

---

## 3. Estados mal gerenciados

**3.1 — `AuthContext` recria o value object a cada render** — Médio, esforço baixo
`src/contexts/AuthContext.tsx:59` — `<AuthContext.Provider value={{ user, session, loading }}>`
monta um objeto literal novo a cada render em vez de `useMemo`. 15 arquivos
consomem `useAuth()` (`ProtectedRoute.tsx:22`, `TicketDetails.tsx:40`,
`TechnicianDashboard.tsx`, `UserManagement.tsx`, `RoutingRulesManagement.tsx`
entre outros); sem seletor de contexto, todo consumidor re-renderiza a cada
render do `AuthProvider`. Fix: `useMemo(() => ({ user, session, loading }), [...])`.

⏭️ **Pulado.** `AuthContext.tsx` já tinha mudanças locais não commitadas
antes desta sessão (o bypass de autenticação descrito no achado crítico do
topo) — evitado por completo, sem exceção, por segurança.

**3.2 — Card/linha de lista sem `React.memo` sob polling/realtime** — Médio, esforço médio
`MachineCard.tsx` (`Monitoring.tsx:232`) e `TicketRow`
(`TechnicianDashboard.tsx:103`, chamado com `onAction={() => {}}` inline —
uma função nova a cada render) não são memoizados. Combinado com
`refetchInterval` de 30-60s em `useMonitoring.ts` (linhas 141-205) e a
invalidação ampla do `useRealtimeTickets`, a grade inteira de máquinas/lista
de tickets reconcilia todas as linhas a cada ciclo, mesmo quando a maior
parte não mudou.

✅ **Corrigido — `abd7e73`.** `MachineCard` e `TicketRow` envolvidos em
`React.memo`. O ponto que faltava pra isso ter efeito de verdade: em
`Monitoring.tsx`, o `onClick={() => onSelect(m)}` era recriado a cada render
do grid — trocado por uma prop `onSelect` passada direto (a mesma referência
estável de `setSelectedMachine`, já estável por ser um `setState`), sem
wrapper por item. `TicketRow` também tinha uma prop `onAction` nunca usada
no corpo do componente — removida junto. Os objetos `machine`/`ticket` já
eram estáveis entre polls via `structuralSharing` padrão do react-query;
o gargalo real era só a identidade dos callbacks.

**3.3 — `TicketDetails.tsx`: 1230 linhas, 0 `useMemo`/`useCallback`** — Baixo-médio, esforço alto
9 `useState`, sem nenhuma memoização. Exemplo concreto:
`totalMinutes`/`billableMinutes` (linhas 506-507) são recalculados a cada
keystroke no textarea de comentário (`newUpdateText` muda a cada tecla),
mesmo que `timeEntries` não tenha mudado. Não é um bug ativo, é risco de
manutenção/performance que cresce com o tamanho do arquivo — decompor em
painel de timeline / painel de resolução / composer de comentário é refactor
real, não fix rápido.

⏭️ **Pulado.** `TicketDetails.tsx` tem mudanças locais não commitadas —
evitado por segurança. Continua sendo refactor real, não fix rápido, de
qualquer forma.

**3.4 — Sete `useState` de filtro independentes em `TechnicianDashboard`** — Baixo, esforço baixo-médio
`priorityFilter`, `categoryFilter`, `statusFilter`, `technicianFilter`,
`companyFilter`, `slaFilter`, `kpiFilter`, `searchTerm` (linhas 171-176) —
já corretamente alimentam um `useMemo` (linhas 180-203), então não é bug de
performance, mas é um caso claro para `useReducer`/objeto único de filtros.

**Verificado e limpo:** `Assets.tsx:215-222` e `Monitoring.tsx:190-199` já
envolvem seus `.filter()` em `useMemo` com dependências corretas.
`Reports.tsx`, `TicketHistory.tsx`, `AlertsDashboard.tsx` têm baixa
densidade de `useState`/`useEffect` e nenhuma operação de lista sem memo.

---

## 4. Queries no Supabase sem índice ou N+1

**Contexto importante:** o time já rodou uma rodada de otimização
(`20260614000000_optimize_fk_indexes.sql`,
`20260614000002_performance_indexes.sql`,
`20260614000003_extra_performance_indexes.sql`) cobrindo praticamente todas
as FKs órfãs e os filtros mais comuns (`tickets.status/priority/assigned_to_user_id/company_id/created_at`,
`notifications.user_id+created_at`, `machines.company_id`). RLS usa
`has_role((SELECT auth.uid()), ...)` e `get_user_company_id()`
(`STABLE SECURITY DEFINER`, baseadas em PK/índice único) — nenhuma policy
faz subquery cara sem índice no join column. `enrichTicketsWithCompany`
já faz batch fetch via `.in('id', userIds)`, evitando N+1 na listagem
principal de tickets.

**4.1 — N+1 real e sequencial em `useHistoricalStats.ts:21-49`** — **Alto**, 1-2h
Loop `for (let i=0; i<days; i++)` dispara 2 queries `await`adas
sequencialmente por dia contra `tickets` (uma por `created_at`, uma por
`updated_at`+`status`). Para 30/90 dias isso é 60-180 round-trips seriais em
vez de 1-2 queries agregadas (`GROUP BY date_trunc('day', ...)`) ou RPC.
Efeito colateral menor: usa `.select('id', {count:'exact'})` e lê `.length`
em vez de `head:true` (traz linhas desnecessárias).

✅ **Corrigido — `7b52d66`, com uma correção importante ao diagnóstico
original:** este hook **não roda em produção** — confirmado via grep, zero
importadores em todo o repositório. A frase "achado de performance mais caro
em produção" acima estava errada; era código morto desde sempre. Também
achei, ao reescrever a lógica, um segundo bug independente na mesma linha:
os limites `currentDay`/`nextDay` estavam com os argumentos de `subDays`
trocados, produzindo `gte(currentDay).lt(nextDay)` com `currentDay >
nextDay` — um range vazio/contraditório em **toda** iteração. Ou seja, se
esse hook chegasse a rodar, sempre retornaria zero chamados por dia,
independente dos dados reais (confirmado contra o banco: para 2026-08-03,
com 7 chamados reais, a lógica antiga retornava 0). Corrigidos os dois no
mesmo commit: 2 queries totais em paralelo (`Promise.all`) em vez de 60-180
seriais, e o bucket por dia com os limites corretos.

**4.2 — `useTechnicianStats.ts:19-72`: 4 queries sequenciais em vez de paralelas** — Baixo, 15min
Filtradas por `assigned_to_user_id`(+status), rodam em série (`await` um
após o outro) em vez de `Promise.all`, com `refetchInterval: 30000`. Índices
já existem (`idx_tickets_assigned_status`, `idx_tickets_assigned_to_user_id`) —
custo é de latência de rede acumulada, não de plano de query.

**4.3 — Índice composto ausente para a query "solved" (condicional ao 4.1)** — Baixo
Filtro é `status IN (...) + updated_at range`, mas só existem índices
simples em `updated_at` e `status+created_at`, não `status+updated_at`. Se
4.1 for resolvido via agregação, isso deixa de importar; senão, considerar
`CREATE INDEX ON tickets(status, updated_at)`.

**4.4 — Churn de schema em `tickets`** — Médio (risco de processo, não de performance)
23 dos 100 arquivos de migration alteram `tickets`, incluindo vários
"repair"/"fix" recentes (`20260319100000_repair_tickets_schema.sql`,
`20260320000000_fix_ticket_status_enum.sql`,
`20260622000000_fix_sla_status_constraint.sql`,
`20260623182152_add_ticket_metadata.sql`). Sinal de instabilidade de
schema/enum de status e correções reativas — vale revisão de processo de
review de migrations, não é um item de código.

⏭️ **Fora de escopo — e mais grave do que este item sugeria.** Confirmado
durante a implementação: a tabela de controle de migrations do Supabase
(`supabase_migrations.schema_migrations`) para em `20260309045657`, mas o
schema real já tem colunas de migrations bem posteriores (abril+) — os
arquivos em `supabase/migrations/` não refletem 100% o estado real do banco.
`fn_auto_route_ticket()` (código morto no banco, ver item 2 da seção 6) e
`tr_auto_route_ticket()` (a função real, nunca descrita em nenhum arquivo
local) são a prova concreta disso. Vale investigar como/quando migrations
passaram a ser aplicadas fora do fluxo versionado antes de confiar
cegamente nos arquivos locais para qualquer mudança futura de schema.

**Go backend (`lib/monitoring.go`, `handler/mon_handlers.go`):** sem
achados — nenhum loop de query por item; updates dinâmicos via
`for k,v := range updates` só montam SQL, não fazem round-trip por iteração.

---

## 5. Tamanho do bundle e dependências não usadas

**5.1 — `recharts` (421 KB / 112 KB gzip) carregado no dashboard padrão** — **Alto**, 2-4h
`Index.tsx` (rota `/`, destino de todo usuário autenticado) renderiza
`Dashboard.tsx` → `TechnicianDashboard`, que importa `recharts`
diretamente. `dist/assets/charts-DES3_kwJ.js` é o maior chunk JS do build
(maior que `vendor-ui` 251/76 KB e `vendor-supabase` 211/54 KB). `Reports.tsx`
(que também usa recharts) já é lazy-loaded corretamente por rota, mas o
widget de gráfico dentro do dashboard não é — todo usuário paga esse custo
no primeiro load, mesmo perfis que nunca abrem `/relatorios`. Ação: extrair
o widget de gráfico do `TechnicianDashboard` para um `React.lazy` próprio.

✅ **Corrigido — `2615fa0`, com uma causa raiz adicional que o diagnóstico
original não cobria.** Extrair o widget para `React.lazy` (feito, novo
`WorkloadChart.tsx`) **não foi suficiente sozinho** — `vite.config.ts` tinha
`manualChunks: { charts: ['recharts'] }`, e um `manualChunks` nomeado faz o
Vite injetar `<link rel="modulepreload">` desse chunk em **todo**
carregamento, independente de lazy-loading no código-fonte. Removida a
entrada; o Rollup volta a decidir o chunking automaticamente com base no
grafo real de imports. Verificado diretamente no `dist/index.html` gerado:
o `modulepreload` de `charts-*.js` (412KB/109KB gzip) estava presente antes
e ausente depois.

**5.2 — `next-themes` é dependência morta** — Baixo, trivial
Zero import em `src/`. O projeto tem `ThemeProvider`/`useTheme` próprios
(`src/components/theme-provider.tsx`, contexto React puro), e
`src/components/ui/sonner.tsx` já importa de `@/components/theme-provider`
em vez de `next-themes`. Seguro remover do `package.json`.

✅ **Corrigido — `7b26b5f`.** `npm uninstall next-themes` (mantém
`package.json`/`package-lock.json` sincronizados). Build verificado limpo
pós-remoção.

**5.3 — 8 pacotes @radix-ui sem consumidor além do wrapper shadcn morto** — Baixo, esforço baixo
`react-accordion`, `react-menubar`, `react-navigation-menu`,
`react-context-menu`, `react-hover-card`, `react-aspect-ratio`,
`react-toggle-group`, `react-slider` — sem uso além dos próprios wrappers
(`accordion.tsx`, `menubar.tsx`, etc. em `components/ui/`), nunca importados
por página/feature. Como nada os importa, já são tree-shaken do `dist/` hoje
(sem impacto de bundle), mas aumentam superfície de auditoria e convidam uso
acidental futuro de código sem manutenção. Outros pacotes radix
(`dialog`, `slot`, `select`, `label`, `toggle`, `alert-dialog`) têm
consumidores reais confirmados.

**Verificado e OK — sem ação necessária:**
- Code-splitting por rota já implementado corretamente: `src/App.tsx:14-32`
  usa `lazy(() => import("./pages/X"))` para as 22 páginas, confirmado nos
  chunks separados em `dist/assets/` (`Admin-*.js` 68KB, `TicketDetails-*.js`
  65KB, `NewTicket-*.js` 58KB, etc.).
- Compressão gzip está corretamente aplicada a JS/CSS, não só HTML
  (`vite.config.ts` usa `viteCompression()` global; `.js.gz`/`.css.gz`
  confirmados para todos os chunks em `dist/assets/`).
- `lucide-react` usa import nomeado em todos os arquivos verificados
  (tree-shakeable, sem barrel/wildcard import).

---

## 6. Cobertura do fluxo de abertura de chamados

### Funciona ponta a ponta

1. **Formulário de criação** (`src/pages/NewTicket.tsx:54-728`) — wizard de 3
   passos: título, descrição, categoria, prioridade, departamento, mais
   campos extras (acesso remoto, contrato, ativo CMDB). Validação client-side
   real via Zod (`src/lib/validation.ts:57-83`): título 5-200 chars,
   descrição mínimo 20 chars com regra anti-template-vazio, regex
   anti-caracteres-perigosos. Submit (`NewTicket.tsx:166-250`) checa rate
   limit via edge function `check-rate-limit`, insere em `tickets`, sobe
   anexos ao Storage + `ticket_attachments`, invalida queries do dashboard,
   mostra tela de sucesso com número do chamado e SLA estimado, trata erro
   com toast + ação de suporte via `mailto:`.

2. **Trigger AFTER INSERT de roteamento** — ⚠️ **correção importante:** a
   versão original deste item descrevia `fn_auto_route_ticket()`
   (`20260319100000_repair_tickets_schema.sql:20-96`, `BEFORE INSERT`) como
   a função de roteamento ativa. Ao testar a correção do item 3 abaixo
   contra o Supabase real (não só os arquivos de migration), descobri que
   **essa função existe no banco mas não está presa a nenhum trigger** —
   é código morto. A função que **realmente** roda a cada chamado criado é
   `tr_auto_route_ticket()` (trigger `AFTER INSERT`, nunca descrita em
   nenhum arquivo de migration local — provável edição direta via SQL
   Editor do Supabase, fora do fluxo de migrations versionadas). Ela avalia
   `routing_rules` por `company_id`/`is_active`, mas só suporta condição
   `category`/`priority`/`company_id` com operador `equals` (sem
   `title`/`is_vip`/`contains`/`not_equals`, ao contrário do que os arquivos
   locais sugerem), e aplica a ação fazendo `UPDATE tickets SET
   assigned_to_user_id = (regra.actions->>'target')::uuid` diretamente.
   **Tem fallback real**: `fn_auto_assign_ticket()`
   (`20260621000001_auto_assign_tickets.sql:3-50`), chamado explicitamente
   quando nenhuma regra casa — confirma que nenhum ticket fica sem
   responsável por falta de match. ✅ Ver item 2 de "Incompleto/faltando"
   abaixo para o bug real encontrado nessa função (`80862ae`).

3. **Trigger AFTER INSERT de auto-resposta** — `fn_auto_response_ticket()`
   (`20260318120000_automation_engine_v2.sql:190-263`, nunca redefinida
   depois) busca regra `auto_response`, resolve `canned_responses`, insere
   em `ticket_updates`. Continua ativa.

4. **Gestão do ticket** — `TicketDetails.tsx`: mudança de status (linha 407),
   reabertura (linha 496), atribuição manual de técnico (linhas 435,
   448-449 via `useUpdateTicketAssignment`), comentários
   (`useAddTicketUpdate`). Todos os hooks relacionados (`useTickets.ts`,
   `useMyTickets.ts`, `useTicketAttachments.ts`, `useTicketRating.ts`,
   `useTimeEntries.ts`, `useTimerGuard.ts`) estão completos e funcionais,
   sem stubs — inclusive apontamento de horas com auto-pause por
   inatividade e aviso `beforeunload`.

5. **Fechamento do loop com o cliente** — `TicketHistory.tsx` e
   `ClientPortal.tsx` usam `useMeusTickets`/`useMyActiveTickets`, com
   paginação, busca e filtros reais; cliente vê seus próprios tickets (RLS
   por `user_id`) e navega para `/ticket/:id`.

6. **Notificações in-app existem como tabela real** — `notifications`
   (`20251127161117...sql:2-35`, com RLS e índice); `useNotifications.ts`
   lê/marca como lida com polling de 30s.

### Incompleto / faltando

1. **Notificação de mudança de status NÃO persiste** — **severidade
   média-alta, esforço baixo (1 migration)**. O trigger
   `create_notification_on_ticket_update` (`20251127161117...sql:38-102`)
   tem `IF NEW.type != 'comment' THEN RETURN NEW; END IF;` (linha 53) — só
   cria notificação para comentários. Quando `handleStatusChange` grava um
   `ticket_update` do tipo `status_change` (`TicketDetails.tsx:418`),
   nenhuma linha é inserida em `notifications`. O requisito do MVP
   ("notificação básica de mudança de status") hoje só existe como toast
   client-side para quem executou a ação (`useUpdateTicketStatus` em
   `useTickets.ts:224-241`) — o cliente não é avisado quando o técnico muda
   o status. Nenhuma migration posterior corrige isso.

   ✅ **Corrigido — `800b65c`.** O trigger `create_notification_on_ticket_update`
   passou a tratar `type = 'status_change'` além de `'comment'`, reaproveitando
   a mesma lógica de destinatário (staff muda status → notifica dono do
   chamado; cliente reabre → notifica técnico responsável). Aplicado e
   testado ao vivo no Supabase dentro de uma transação com `ROLLBACK` antes
   de aplicar de verdade — sem side effect em dado real.

2. **`escalate_manager` virou no-op silencioso na engine de roteamento** —
   ⚠️ **diagnóstico original incompleto, corrigido abaixo.** A versão
   original deste item dizia que `fn_auto_route_ticket()` tinha removido o
   branch `escalate_manager`. Isso é verdade **só pro arquivo de migration**
   — ao comparar com o banco real, `escalate_manager` **já funcionava** na
   função que de fato roda (`tr_auto_route_ticket()`, ver item 2 de
   "Funciona ponta a ponta" acima), tratado igual a `assign_tech`. O bug
   real e mais grave, nunca antes documentado: essa função faz
   `(regra.actions->>'target')::uuid` **sem checar `actions->>'type'`** —
   qualquer regra `round_robin`, `set_priority` ou `notify_all` (todas
   oferecidas em `RoutingRulesManagement.tsx`) tem `target` que não é um
   UUID, e o cast falha com erro, quebrando o `INSERT` inteiro em `tickets`.
   Ou seja: o cliente não conseguiria abrir o chamado se uma regra desses
   tipos passasse a casar a condição. Hoje isso está dormente — as 7 regras
   ativas no banco são todas `assign_to_user`/`escalate_manager` com UUID
   válido — mas era uma bomba-relógio real. Achei também que a regra
   "Urgente → Notificar Gestor" nunca dispara: compara `priority =
   'urgente'` (PT) mas o app grava `'urgent'` (EN) — isso é dado, não
   código, não foi mexido.

   ✅ **Corrigido — `80862ae`.** Reescrita `tr_auto_route_ticket()` para
   checar o tipo da ação antes de qualquer cast; implementados
   `round_robin`/`set_priority` de fato em vez de deixá-los quebrar;
   `assign_to_user`/`assign_tech`/`escalate_manager` mantidos como já
   funcionavam; regras globais (`company_id IS NULL`) passam a ser
   consideradas, alinhado ao que os arquivos locais já previam.

3. **`email-to-ticket` edge function órfã** — baixa severidade, esforço
   médio (depende de provedor externo). Existe
   (`supabase/functions/email-to-ticket/index.ts`) e cria ticket via INSERT
   direto (bypassa `ticketCreationSchema`, sem rate-limit, categoria fixa
   "Suporte Geral"). Só é referenciada em `src/pages/Settings.tsx:43` como
   texto de URL para o admin copiar/colar num provedor externo — nada no
   repo automatiza essa integração.

   ⏭️ **Fora de escopo.** Não é fix de código — precisa de uma decisão de
   produto sobre qual provedor de e-mail externo conectar antes de qualquer
   linha de código fazer sentido.

4. **Atribuição manual só existe em `TicketDetails.tsx`, não no formulário
   de criação** — não é bug, é decisão de design a documentar: não há campo
   de responsável em `NewTicket.tsx` (confirmado via grep); a atribuição no
   momento da criação é 100% automática via triggers, ajustável depois em
   `TicketDetails.tsx:791`. Vale confirmar se o requisito do MVP
   "atribuição de responsável" pressupõe controle manual já na criação.

5. **Menor:** comentário morto em `NewTicket.tsx:220`
   (`// toast({ title: 'Chamado criado!'...`) — toast de sucesso foi
   substituído pela tela dedicada; código morto sem impacto funcional.

---

## Observação fora de escopo (não solicitada, mas relevante)

A raiz do repositório tem ~30 scripts avulsos (`fix_*.py`, `debug_*.py`,
`qa_*.py`, `test_*.py`, `*.mjs` de teste manual, `analyze*.py`) que não
fazem parte do build nem de uma suíte de testes formal (não há `tests/` nem
integração com CI visível). Isso não foi pedido explicitamente na auditoria,
mas é um sinal de dívida de processo: dificulta saber o que ainda é
relevante vs. descartável, e nenhum desses scripts é versionado com convenção
clara de quando/por que rodar. Sugestão: mover para uma pasta `scripts/` com
um README curto, ou arquivá-los fora do repo principal — decisão do time,
não uma ação técnica desta auditoria.

---

## Notas metodológicas

**Fase de auditoria (leitura):**
- Cada seção foi produzida por uma exploração dedicada do código-fonte
  (grep + leitura de arquivo), com referências `arquivo:linha` verificadas —
  nenhum achado foi extrapolado sem evidência direta no repositório.
- Estimativas de esforço são aproximadas e não incluem tempo de review/QA.

**Fase de implementação (2026-08-11, mesma sessão):**
- 13 commits, um item por commit, seguindo as regras do `CLAUDE.md` (nunca
  misturar refino visual com lógica de backend no mesmo commit; commits
  pequenos e testáveis).
- Cada commit foi type-checado (`tsc --noEmit`) e, quando tocava frontend,
  buildado (`npm run build`) antes de commitar. Mudanças de schema/trigger
  foram testadas ao vivo contra o Supabase real via transação com `ROLLBACK`
  antes de aplicar de verdade — nenhuma teve efeito colateral em dado real
  durante o teste.
- Arquivos com mudanças locais não commitadas de fora desta sessão foram
  deliberadamente evitados por completo, sem exceção — mesmo quando isso
  significou pular itens "Alto"/"Médio" de impacto (ver coluna Status na
  seção 0).
- Descobertas feitas *durante* a implementação — não visíveis numa auditoria
  só de leitura de arquivos — corrigem dois diagnósticos da auditoria
  original: o achado #2 (N+1 em `useHistoricalStats.ts`, na verdade código
  morto) e o achado #5 (`escalate_manager`, na verdade um bug mais grave
  numa função diferente da descrita, `tr_auto_route_ticket()` vs.
  `fn_auto_route_ticket()`). Ambos expõem uma divergência real entre os
  arquivos de `supabase/migrations/` e o estado ao vivo do banco — ver item
  4.4 acima.
- `git push` e a aplicação de migrations no Supabase (`apply_migration`) via
  ferramentas automatizadas foram bloqueados pelo classifier de auto-mode
  do ambiente; essas ações foram feitas manualmente pelo usuário fora desta
  sessão, e verificadas (`git fetch` + comparação de `pg_get_functiondef`)
  antes de prosseguir.
