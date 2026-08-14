# Relatório de Auditoria — Tradução de Rotas EN → PT-BR

**Fase:** 1 (Auditoria, somente leitura — nenhuma alteração de código feita)
**Fonte:** [src/App.tsx](src/App.tsx) (definição canônica de rotas, React Router v6, `BrowserRouter`/`Routes`/`Route`)

## Achado principal (leia antes de aprovar a Fase 3)

O site **já está majoritariamente em português**. Das 22 rotas de destino real (não-redirect), apenas **3 têm path em inglês**: `/knowledge`, `/assets`, `/patches` — exatamente as 3 que você já mapeou. Todas as outras 19 rotas de destino já usam paths em PT-BR (`/ajustes`, `/relatorios`, `/sistemas`, `/monitoramento`, `/historico`, `/automacoes`, `/notificacoes`, etc.).

Além disso, o app **já tem um sistema de aliases/redirects legados** (via `<Navigate replace>`) para várias dessas rotas — inclusive apelidos em português para `/assets`, `/knowledge` e `/patches` que hoje redirecionam **na direção contrária** à que você quer:

| Rota EN atual (canônica) | Alias PT que já existe e redireciona PARA ela | Situação |
|---|---|---|
| `/assets` | `/ativos` → `/assets`, `/cmdb` → `/assets` | ⚠️ **Colisão de nome**: sua tradução alvo (`/assets → /ativos`) é o **path que já existe como alias**, mas apontando para o lado errado. Não dá para simplesmente "adicionar" `/ativos` como nova rota — o alias atual precisa ser invertido. |
| `/knowledge` | `/manual`, `/tutorial`, `/base-conhecimento`, `/documentacao` → `/knowledge` | Nenhum desses é `/conhecimento` exatamente, sem colisão de nome — mas `/tutorial` é usado como **destino de navegação ativo** em 3 arquivos (não só como alias de URL morta), ver tabela de referências abaixo. |
| `/patches` | `/atualizacoes`, `/updates` → `/patches` | Sem colisão de nome com `/instaladores`. |

Isso muda o formato da migração: para `/assets`, a Fase 3 não é "trocar o path e redirecionar o antigo" — é **inverter uma rota de redirect que já existe**, com risco de laço de redirecionamento (`/ativos → /assets` atual vs. `/assets → /ativos` novo) se a ordem de troca não for cuidadosa.

## Achado adicional — colisão histórica com diretório de build

[vite.config.ts:29-36](vite.config.ts#L29) tem um comentário explícito: o Vite por padrão usa `assets/` como pasta de build de JS/CSS, o que colidia com a rota SPA `/assets` (por isso já foi renomeado para `assetsDir: '_assets'`). Isso é só contexto histórico — não é uma ação necessária — mas é um dado a favor de migrar `/assets` para `/ativos` (remove de vez a ambiguidade de nome com a pasta de build), e o comentário do arquivo deveria ser atualizado na Fase 3 se a rota mudar (ele cita `/assets` explicitamente).

## Achado adicional — `robots.txt` já está desatualizado, independente desta tarefa

[public/robots.txt](public/robots.txt) lista `Disallow:` para rotas que **não existem mais** no `App.tsx` atual: `/dashboard`, `/tickets`, `/client-portal`, `/patch-management`, `/knowledge-base`. As rotas reais correspondentes hoje são `/` (protegida), `/ticket/:id`, `/portal`, `/patches`, `/knowledge`. Isso é um bug pré-existente, fora do escopo desta tarefa — reportando conforme instruído, não corrigi.

Também note: o arquivo termina com `Disallow: /` (linha 19), que já bloqueia a indexação de **todo o site** exceto as poucas rotas com `Allow:` explícito (`/`, `/auth`, `/favicon.png`, `/manifest.json`). Ou seja, `/knowledge`, `/assets` e `/patches` **já não são indexadas hoje** — o risco de SEO de renomeá-las é menor do que o esperado, mas o `robots.txt` precisa ser atualizado de qualquer forma na Fase 3 (tanto para corrigir as entradas obsoletas quanto para refletir os novos paths PT).

## `sitemap.xml`

**Não existe** `sitemap.xml` no projeto (busquei em `public/` e no repo inteiro). O item 4 da Fase 3 ("atualizar sitemap.xml") não se aplica — não há arquivo para atualizar.

---

## Tabela — Rotas de destino real (páginas)

| Rota atual (EN/PT) | Rota proposta (PT-BR) | Componente | Pública/Auth | Arquivos que referenciam |
|---|---|---|---|---|
| `/` | *(sem alteração — já neutro)* | `Index` | Auth (todos os papéis) | App.tsx |
| `/auth` | *(sem alteração — já é o termo usado)* | `Auth` | Pública | App.tsx, SetPassword.tsx:98, Avaliacao.tsx:114, Sidebar.tsx:119 |
| `/definir-senha` | *(já PT)* | `SetPassword` | Pública | App.tsx |
| `/avaliacao/:id` | *(já PT)* | `Avaliacao` | Pública | App.tsx |
| `/novo-ticket` | *(já PT)* | `NewTicket` | Auth | App.tsx, ClientPortal.tsx:52,86, TopBar.tsx:149, alias `/novo` |
| `/ajustes` | *(já PT)* | `Settings` | Auth | App.tsx, aliases `/configuracoes`, `/settings` |
| `/admin` | **PENDENTE** (termo técnico ambíguo — ver lista de pendências) | `Admin` | Auth (admin, developer) | App.tsx, NewTicket.tsx:551, SLATab.tsx:29, Sidebar.tsx, aliases `/administracao`, `/painel-admin` |
| `/relatorios` | *(já PT)* | `Reports` | Auth (admin, developer) | App.tsx, Sidebar.tsx |
| `/sistemas` | *(já PT)* | `InfrastructureDashboard` | Auth (admin, developer, technician) | App.tsx, TicketDetails.tsx:1327, Sidebar.tsx |
| `/monitoramento` | *(já PT)* | `Monitoring` | Auth | App.tsx |
| `/central-alertas` | *(já PT)* | `AlertsDashboard` | Auth | App.tsx |
| `/ticket/:id` | *(já PT — "ticket" é o termo usado em toda a UI)* | `TicketDetails` | Auth | App.tsx + 8 arquivos (TicketHistory, TicketDetails, Reports, ClientPortal, TechnicianDashboard, TopBar, TicketHeroHeader) — ⚠️ ver bug fora de escopo abaixo |
| `/historico` | *(já PT)* | `TicketHistory` | Auth | App.tsx, ClientPortal.tsx:62,105, TechnicianDashboard.tsx:680, alias `/history` |
| `/knowledge` | **`/conhecimento`** *(tradução conhecida)* | `KnowledgeBase` | Auth | App.tsx (rota + 4 aliases: `/manual`, `/tutorial`, `/base-conhecimento`, `/documentacao`), Sidebar.tsx:65, TicketDetails.tsx:969, ClientPortal.tsx:74, robots.txt |
| `/assets` | **`/ativos`** *(tradução conhecida — ⚠️ colide com alias existente, ver acima)* | `Assets` | Auth (admin, developer, technician) | App.tsx (rota + 2 aliases: `/ativos`, `/cmdb`), Sidebar.tsx:73, robots.txt, vite.config.ts (comentário) |
| `/monitoramento-web` | *(já PT)* | `WebMonitoring` | Auth (admin, developer, technician) | App.tsx, Sidebar.tsx |
| `/portal` | *(já PT/neutro)* | `ClientPortal` | Auth | App.tsx, Dashboard.tsx:30, aliases `/cliente`, `/area-cliente` |
| `/debug-tools` | **PENDENTE** (não está na lista conhecida; sem links internos — só acessível digitando a URL) | `DebugTools` | Auth (qualquer papel autenticado) | App.tsx apenas |
| `/automacoes` | *(já PT)* | `Automacoes` | Auth (admin, developer) | App.tsx, Sidebar.tsx |
| `/patches` | **`/instaladores`** *(tradução conhecida)* | `PatchManagement` | Auth (admin, developer, technician) | App.tsx (rota + 2 aliases: `/atualizacoes`, `/updates`), Sidebar.tsx:72 |
| `/notificacoes` | *(já PT)* | `Notifications` | Auth | App.tsx, NotificationsPopover.tsx:97, alias `/notifications` |
| `*` (catch-all) | *(não aplicável — não é um path)* | `NotFound` | Pública | App.tsx |

## Tabela — Rotas de redirect/alias legadas (não são páginas, só `<Navigate>`)

Todas definidas em App.tsx:102-118. Nenhuma precisa de tradução (já são o mecanismo de compatibilidade), mas a Fase 3 precisa decidir o que fazer com cada uma quando a rota-alvo mudar de path:

| Alias | Aponta hoje para | Observação |
|---|---|---|
| `/manual` | `/knowledge` | vira `/conhecimento` |
| `/tutorial` | `/knowledge` | vira `/conhecimento` — **usado como destino ativo de `navigate()`/`<Navigate>` em ClientPortal.tsx:143, Monitoring.tsx:359, AlertsDashboard.tsx:179** (não é só alias de URL morta) |
| `/base-conhecimento` | `/knowledge` (preserva query string) | vira `/conhecimento` |
| `/documentacao` | `/knowledge` | vira `/conhecimento` |
| `/configuracoes` | `/ajustes` | sem alteração |
| `/settings` | `/ajustes` | sem alteração |
| `/history` | `/historico` | sem alteração |
| `/novo` | `/novo-ticket` | sem alteração |
| `/notifications` | `/notificacoes` | sem alteração |
| `/ativos` | `/assets` (preserva query string) | ⚠️ **precisa inverter**: vira a rota canônica, e `/assets` passa a ser o alias |
| `/cmdb` | `/assets` (preserva query string) | passa a apontar para `/ativos` |
| `/administracao` | `/admin` | depende da decisão sobre `/admin` (pendência) |
| `/painel-admin` | `/admin` | depende da decisão sobre `/admin` (pendência) |
| `/cliente` | `/portal` | sem alteração |
| `/area-cliente` | `/portal` | sem alteração |
| `/atualizacoes` | `/patches` | vira `/instaladores` |
| `/updates` | `/patches` | vira `/instaladores` |

## Endpoints de API (Go) — fora de escopo, não tocados

Todas as strings `/assets` encontradas fora de `src/` são: alias de import (`@/assets/orion-logo.png`, `@/assets/orion-logo-light.png` — pasta de imagens estáticas, não rota) e o comentário de `vite.config.ts`. Não há endpoint `/api/*` cujo path dependa dos nomes de rota do frontend — não há confusão entre rota de frontend e endpoint de backend a resolver aqui, mas confirmando que **nenhum endpoint de API foi listado ou seria tocado** nesta tarefa, conforme instruído.

---

## Pendências — decisão necessária antes da Fase 3

1. **`/admin`** — termo técnico ambíguo (você mesmo listou "dashboard"/"settings" como exemplos; `/admin` é da mesma categoria). Existem 2 aliases já em PT apontando para ele (`/administracao`, `/painel-admin`) mas nenhum é o path canônico hoje. Manter `/admin` (termo já internacional/comum) ou promover `/administracao` a canônico?
2. **`/debug-tools`** — não está na lista de traduções conhecidas. É uma rota de ferramentas internas sem nenhum link de UI (só acessível via URL direta). Traduzir, manter em inglês, ou remover do roteamento público? Preciso de decisão explícita.
3. **Colisão `/assets` ↔ `/ativos`** (detalhada acima) — preciso confirmar que você quer inverter o alias existente, e a ordem seguro de troca (evitar loop de redirect) antes de implementar.
4. **`robots.txt` desatualizado** (rotas fantasma `/dashboard`, `/tickets`, `/client-portal`, `/patch-management`, `/knowledge-base`) — corrijo junto com a atualização de paths na Fase 3, ou trato como um fix separado (commit isolado, já que não é sobre tradução)?

## Fora de escopo detectado (reportando, não corrigi)

- [src/pages/Assets.tsx:1049](src/pages/Assets.tsx#L1049): `navigate(`/tickets/${ticket.id}`)` usa `/tickets` (plural) — a rota real é `/ticket/:id` (singular, App.tsx:92). Parece um bug de navegação pré-existente, não relacionado à tradução.

---

**Nenhuma alteração de código foi feita nesta fase.** Aguardando sua decisão sobre as 4 pendências acima e a estratégia de redirect antes de liberar a Fase 3.
