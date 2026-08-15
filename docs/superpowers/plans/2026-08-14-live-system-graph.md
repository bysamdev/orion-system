# Live System Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/grafo-sistema`, a 3D interactive map (reagraph) of the Orion System's real architecture, driven by a real Go WebSocket that (for now) emits simulated execution events in the exact contract a future real instrumentation would use.

**Architecture:** A curated, versioned catalog of ~45 real nodes/edges (`architecture.ts`) is the static structure. A Zustand store holds live status per node/edge, updated by `useSystemGraphSocket()`, which connects to a new Go WS hub (`/api/ws/system-graph`) mirroring the existing `handler/ws_terminal.go` auth/lifecycle pattern. `reagraph`'s `GraphCanvas` renders the graph; a small custom `@react-three/fiber` child (rendered inside `GraphCanvas`'s own canvas, never a second one) animates particles along active edges.

**Tech Stack:** React 18.3.1 + Vite 6 + TypeScript, `reagraph@4.22.0` (pinned — see Global Constraints), `zustand@^5.0.15`, `vitest` (new, frontend unit tests), Go 1.25 + chi + `gorilla/websocket` (already in go.mod).

## Global Constraints

- **`reagraph` MUST stay pinned to exactly `4.22.0`** (`"reagraph": "4.22.0"` in package.json, no `^`/`~`). Versions ≥4.23.0 depend on `@react-three/fiber@9.x`/`@react-three/drei@10.x`, which require `react: ^19.0.0` — this project is on React `18.3.1` everywhere. Confirmed via `npm view reagraph@<version> dependencies` across the version range; 4.22.0 is the newest version whose `@react-three/fiber` (8.13.5) peer-requires `react: '>=18.0'`. Do not run `npm update reagraph` or let a lockfile bump move it.
- **Never mount a second `<Canvas>`.** All custom Three.js/R3F content (Task 15, edge particles) renders as `children` of reagraph's own `<GraphCanvas>` (confirmed supported: `GraphCanvasProps.children?: ReactNode`). Two WebGL contexts on one page tanks performance and contradicts the spec's performance requirement.
- **100% additive.** No existing route, handler, page, or exported function signature changes. Every task below only adds new files or adds isolated new entries to `App.tsx` / `Sidebar.tsx` / `handler/router.go`.
- **Portuguese in-app strings, English code identifiers** — matches the rest of the codebase (see any existing page/hook).
- **`/api/ws/system-graph` auth**: token travels in `Sec-WebSocket-Protocol` (subprotocol `orion-bearer` + token as second item), never in query string — mirrors `handler/ws_terminal.go`'s documented reasoning (browsers can't set `Authorization` on a WS handshake; query strings leak into proxy/access logs).
- **AI nodes must reflect real current behavior, not aspirational behavior.** `useTicketCopilot.ts` is fully mocked client-side (no backend call at all — confirmed by reading the file, it's `setTimeout` + hardcoded strings). `useKBSuggestions.ts` does real Postgres textual search; the pgvector RAG path (`match_kb_articles` RPC, `embedding` column) exists in the schema but nothing populates embeddings yet (confirmed via the in-code comment in that file). The catalog descriptions in Task 1 state this honestly — do not upgrade the wording to imply real AI is live.

---

## File Structure

**Frontend (new files only):**
- `src/lib/systemGraph/architecture.ts` — static catalog: `ArchNode`, `ArchEdge`, `NodeKind`, `EdgeKind` types + the ~45-node/~50-edge data.
- `src/lib/systemGraph/architecture.test.ts` — referential-integrity tests for the catalog.
- `src/lib/systemGraph/types.ts` — `SystemEvent`, `NodeStatus` types (shared by store + socket hook).
- `src/lib/systemGraph/store.ts` — `useSystemGraphStore` (Zustand).
- `src/lib/systemGraph/store.test.ts`
- `src/hooks/useSystemGraphSocket.ts` — WS connection + reconnect logic.
- `src/components/systemGraph/GraphView.tsx` — `GraphCanvas` wrapper, custom node rendering, camera.
- `src/components/systemGraph/NodeDetailsSheet.tsx`
- `src/components/systemGraph/EventLogPanel.tsx`
- `src/components/systemGraph/LegendPanel.tsx`
- `src/components/systemGraph/GraphToolbar.tsx` — two-node path selection UX.
- `src/components/systemGraph/EdgeParticles.tsx` — R3F children rendered inside `GraphView`'s canvas.
- `src/pages/LiveSystemGraph.tsx` — composes all of the above.

**Frontend (existing files, isolated additions):**
- `src/App.tsx` — one new lazy import + one new `<Route>`.
- `src/components/dashboard/Sidebar.tsx` — one new nav item.
- `package.json` — `reagraph`, `zustand`, `vitest` (devDependency), plus a `test` script.
- `vite.config.ts` — vitest `test` config block.

**Backend (new file only):**
- `handler/ws_system_graph.go` — hub, auth, simulated event generator, HTTP handler.
- `handler/ws_system_graph_test.go`

**Backend (existing file, isolated addition):**
- `handler/router.go` — one new `r.Get("/api/ws/system-graph", ...)` line, right after the existing `/api/ws/terminal*` lines (same "outside `RequireCompanyScope`" section, since WS can't carry the standard middleware's header).

---

## Task 1: Architecture catalog

**Files:**
- Create: `src/lib/systemGraph/architecture.ts`
- Test: `src/lib/systemGraph/architecture.test.ts`

**Interfaces:**
- Produces: `NodeKind`, `EdgeKind`, `ArchNode`, `ArchEdge`, `ARCH_NODES: ArchNode[]`, `ARCH_EDGES: ArchEdge[]` — every later task that touches graph data imports from here.

- [ ] **Step 1: Add vitest so this and later `.test.ts` files have a runner**

Run:
```bash
npm install -D vitest --save-exact
```

Add to `vite.config.ts` (append a `test` key to the existing `defineConfig({...})` object — do not touch any other key):
```ts
  test: {
    environment: 'node',
    globals: true,
  },
```

Add to `package.json` `"scripts"`:
```json
    "test": "vitest run",
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/systemGraph/architecture.test.ts
import { describe, it, expect } from 'vitest';
import { ARCH_NODES, ARCH_EDGES } from './architecture';

describe('architecture catalog', () => {
  it('has between 35 and 46 nodes', () => {
    expect(ARCH_NODES.length).toBeGreaterThanOrEqual(35);
    expect(ARCH_NODES.length).toBeLessThanOrEqual(45);
  });

  it('has no duplicate node ids', () => {
    const ids = ARCH_NODES.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate edge ids', () => {
    const ids = ARCH_EDGES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every edge source and target references a real node id', () => {
    const nodeIds = new Set(ARCH_NODES.map(n => n.id));
    for (const edge of ARCH_EDGES) {
      expect(nodeIds.has(edge.source), `edge ${edge.id} source ${edge.source} missing`).toBe(true);
      expect(nodeIds.has(edge.target), `edge ${edge.id} target ${edge.target} missing`).toBe(true);
    }
  });

  it('every node has a non-empty description and every kind is one of the six allowed', () => {
    const allowed = new Set(['frontend', 'backend', 'database', 'service', 'api', 'ai']);
    for (const node of ARCH_NODES) {
      expect(node.description.length, `node ${node.id} has empty description`).toBeGreaterThan(0);
      expect(allowed.has(node.kind), `node ${node.id} has invalid kind ${node.kind}`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- architecture.test.ts`
Expected: FAIL with "Cannot find module './architecture'" (file doesn't exist yet).

- [ ] **Step 4: Write the catalog**

```ts
// src/lib/systemGraph/architecture.ts

export type NodeKind = 'frontend' | 'backend' | 'database' | 'service' | 'api' | 'ai';
export type EdgeKind = 'http' | 'db' | 'websocket' | 'realtime' | 'invoke';

export interface ArchNode {
  id: string;
  label: string;
  kind: NodeKind;
  description: string;
  /** Real path in this repo this node represents — for traceability, shown in the details panel. */
  sourceRef?: string;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
}

export const ARCH_NODES: ArchNode[] = [
  // ── Frontend (React pages) ──────────────────────────────────────────────
  { id: 'fe-app', label: 'App Shell', kind: 'frontend', description: 'Roteador raiz da SPA — registra todas as páginas e o wrapper de autenticação/layout.', sourceRef: 'src/App.tsx' },
  { id: 'fe-dashboard', label: 'Dashboard de Tickets', kind: 'frontend', description: 'Página inicial: fila de tickets do técnico/cliente.', sourceRef: 'src/pages/Index.tsx' },
  { id: 'fe-monitoring', label: 'Monitoramento RMM', kind: 'frontend', description: 'Lista de máquinas monitoradas, métricas e comandos remotos.', sourceRef: 'src/pages/Monitoring.tsx' },
  { id: 'fe-infra-dashboard', label: 'Painel de Sistemas', kind: 'frontend', description: 'Visão consolidada de infraestrutura e alertas.', sourceRef: 'src/pages/InfrastructureDashboard.tsx' },
  { id: 'fe-admin', label: 'Painel Admin', kind: 'frontend', description: 'Gestão de usuários, empresas, contratos e regras de roteamento.', sourceRef: 'src/pages/Admin.tsx' },
  { id: 'fe-knowledge-base', label: 'Base de Conhecimento', kind: 'frontend', description: 'Artigos de KB e sugestões de artigos ao abrir um ticket.', sourceRef: 'src/pages/KnowledgeBase.tsx' },
  { id: 'fe-assets', label: 'Ativos (CMDB)', kind: 'frontend', description: 'Inventário de dispositivos e relacionamentos entre ativos.', sourceRef: 'src/pages/Assets.tsx' },
  { id: 'fe-client-portal', label: 'Portal do Cliente', kind: 'frontend', description: 'Área do cliente final para acompanhar seus próprios tickets.', sourceRef: 'src/pages/ClientPortal.tsx' },
  { id: 'fe-live-system-graph', label: 'Live System Graph', kind: 'frontend', description: 'Esta própria página — mapa 3D ao vivo da arquitetura do Orion System.', sourceRef: 'src/pages/LiveSystemGraph.tsx' },

  // ── API (grupos de rota do Go, handler/router.go) ───────────────────────
  { id: 'api-functions', label: '/api/functions/*', kind: 'api', description: 'Rotas administrativas (gestão de usuários, rate limit).', sourceRef: 'handler/router.go' },
  { id: 'api-monitoring', label: '/api/monitoring/*', kind: 'api', description: 'Rotas de RMM: máquinas, grupos, links de rede, endpoints web.', sourceRef: 'handler/router.go' },
  { id: 'api-tickets', label: '/api/tickets/*', kind: 'api', description: 'Resolução de número sequencial de ticket para UUID.', sourceRef: 'handler/router.go' },
  { id: 'api-auth', label: '/api/auth/*', kind: 'api', description: 'Login de máquina do agente RMM.', sourceRef: 'handler/router.go' },
  { id: 'api-ws-terminal', label: '/api/ws/terminal', kind: 'api', description: 'Ponte WebSocket do terminal remoto (browser ⇄ agente).', sourceRef: 'handler/ws_terminal.go' },
  { id: 'api-ws-system-graph', label: '/api/ws/system-graph', kind: 'api', description: 'WebSocket deste próprio grafo — hoje emite eventos simulados, no formato que uma instrumentação real usaria.', sourceRef: 'handler/ws_system_graph.go' },

  // ── Backend Go (handler/*.go, lib/*.go) ─────────────────────────────────
  { id: 'go-auth-handlers', label: 'Auth Handlers', kind: 'backend', description: 'Login de máquina do agente RMM.', sourceRef: 'handler/auth_handlers.go' },
  { id: 'go-fn-handlers', label: 'Function Handlers', kind: 'backend', description: 'CRUD administrativo de usuários (admin-update-user, delete-user-admin, create-user-credentials) e rate limiting.', sourceRef: 'handler/fn_handlers.go' },
  { id: 'go-mon-handlers', label: 'Monitoring Handlers', kind: 'backend', description: 'Dashboard, máquinas, grupos, comandos remotos, alertas de RMM.', sourceRef: 'handler/mon_handlers.go' },
  { id: 'go-network-links-handlers', label: 'Network Links Handlers', kind: 'backend', description: 'CRUD de links de rede monitorados entre máquinas.', sourceRef: 'handler/network_links_handlers.go' },
  { id: 'go-uptime-handlers', label: 'Uptime Handlers', kind: 'backend', description: 'Endpoints web monitorados, integrados ao UptimeRobot.', sourceRef: 'handler/uptime_handlers.go' },
  { id: 'go-ticket-handlers', label: 'Ticket Handlers', kind: 'backend', description: 'Resolução de número sequencial de ticket para UUID.', sourceRef: 'handler/ticket_handlers.go' },
  { id: 'go-ws-terminal', label: 'WS Terminal Hub', kind: 'backend', description: 'Hub que liga o navegador ao agente Windows para sessões de shell remoto.', sourceRef: 'handler/ws_terminal.go' },
  { id: 'go-ws-system-graph', label: 'WS System Graph Hub', kind: 'backend', description: 'Hub de broadcast deste grafo — mesma arquitetura de hub do WS Terminal, mas 1-para-N em vez de 1-para-1.', sourceRef: 'handler/ws_system_graph.go' },
  { id: 'go-lib-db', label: 'lib/db.go', kind: 'backend', description: 'Acesso a Postgres via pgx — escopo multi-empresa (UserScope), consultas de máquinas/tickets/perfis.', sourceRef: 'lib/db.go' },
  { id: 'go-lib-monitoring', label: 'lib/monitoring.go', kind: 'backend', description: 'Regras de negócio de monitoramento: alertas, status de máquina, dashboard.', sourceRef: 'lib/monitoring.go' },
  { id: 'go-lib-supabase', label: 'lib/supabase.go', kind: 'backend', description: 'Cliente para a Admin API do Supabase Auth (criar/atualizar/excluir usuário).', sourceRef: 'lib/supabase.go' },
  { id: 'go-lib-email', label: 'lib/email.go', kind: 'backend', description: 'Envio de email transacional via Resend.', sourceRef: 'lib/email.go' },

  // ── Database ─────────────────────────────────────────────────────────────
  { id: 'db-postgres', label: 'Supabase Postgres', kind: 'database', description: 'Banco relacional central, com RLS por empresa. Inclui o Supabase Vault (extensão supabase_vault) para segredos, como a chave de criptografia de remote_password.', sourceRef: 'supabase/migrations' },
  { id: 'db-tickets', label: 'tickets / ticket_updates', kind: 'database', description: 'Domínio de chamados: tickets, atualizações, anexos, SLA.', sourceRef: 'supabase/migrations' },
  { id: 'db-monitoring', label: 'machines / alerts', kind: 'database', description: 'Domínio de RMM: máquinas monitoradas, métricas, alertas, comandos.', sourceRef: 'supabase/migrations' },

  // ── Services (Edge Functions Deno + agente RMM + externos) ─────────────
  { id: 'svc-admin-update-user', label: 'admin-update-user', kind: 'service', description: 'Edge Function: atualização administrativa de usuário (fallback do endpoint Go equivalente).', sourceRef: 'supabase/functions/admin-update-user/index.ts' },
  { id: 'svc-create-user-credentials', label: 'create-user-credentials', kind: 'service', description: 'Edge Function: criação de usuário com senha provisória e envio de email de boas-vindas.', sourceRef: 'supabase/functions/create-user-credentials/index.ts' },
  { id: 'svc-delete-user-admin', label: 'delete-user-admin', kind: 'service', description: 'Edge Function: exclusão administrativa de usuário.', sourceRef: 'supabase/functions/delete-user-admin/index.ts' },
  { id: 'svc-invite-user-resend', label: 'invite-user-resend', kind: 'service', description: 'Edge Function: convite de usuário por email com token de definição de senha.', sourceRef: 'supabase/functions/invite-user-resend/index.ts' },
  { id: 'svc-email-to-ticket', label: 'email-to-ticket', kind: 'service', description: 'Webhook: cria ticket a partir de email recebido, autenticado por X-Webhook-Secret.', sourceRef: 'supabase/functions/email-to-ticket/index.ts' },
  { id: 'svc-whatsapp-webhook', label: 'whatsapp-webhook', kind: 'service', description: 'Stub de webhook do WhatsApp — ainda sem lógica de negócio.', sourceRef: 'supabase/functions/whatsapp-webhook/index.ts' },
  { id: 'svc-check-rate-limit', label: 'check-rate-limit', kind: 'service', description: 'Edge Function auxiliar de rate limiting.', sourceRef: 'supabase/functions/check-rate-limit/index.ts' },
  { id: 'svc-reset-password', label: 'reset-password-with-token', kind: 'service', description: 'Edge Function: troca de senha via token de recuperação.', sourceRef: 'supabase/functions/reset-password-with-token/index.ts' },
  { id: 'svc-send-password-alert', label: 'send-password-changed-alert', kind: 'service', description: 'Edge Function: notifica o usuário quando a senha é alterada.', sourceRef: 'supabase/functions/send-password-changed-alert/index.ts' },
  { id: 'svc-orion-agent', label: 'orion-agent (RMM)', kind: 'service', description: 'Agente Windows em Go: heartbeat, execução de comandos remotos, ponte do terminal.', sourceRef: 'orion-agent/' },
  { id: 'svc-resend', label: 'Resend', kind: 'service', description: 'API externa de envio de email transacional.', sourceRef: 'lib/email.go' },
  { id: 'svc-supabase-auth', label: 'Supabase Auth', kind: 'service', description: 'Serviço de autenticação e emissão de JWT.', sourceRef: 'lib/supabase.go' },
  { id: 'svc-uptimerobot', label: 'UptimeRobot', kind: 'service', description: 'API externa de monitoramento de disponibilidade de endpoints web.', sourceRef: 'handler/uptime_handlers.go' },

  // ── AI — representados como realmente funcionam hoje, sem inflar ───────
  { id: 'ai-ticket-copilot', label: 'Ticket Copilot', kind: 'ai', description: 'Resumo e sugestão de resposta de ticket na UI. Hoje é inteiramente mockado no frontend (setTimeout + texto fixo) — não chama nenhum backend real ainda.', sourceRef: 'src/hooks/useTicketCopilot.ts' },
  { id: 'ai-kb-search', label: 'Busca de KB', kind: 'ai', description: 'Sugestão de artigos de KB ao digitar um ticket. Hoje é busca textual em Postgres — a RPC match_kb_articles e a coluna embedding para RAG via pgvector existem no schema mas ainda não estão populadas.', sourceRef: 'src/hooks/useKBSuggestions.ts' },
];

export const ARCH_EDGES: ArchEdge[] = [
  // App shell → páginas
  { id: 'e-app-dashboard', source: 'fe-app', target: 'fe-dashboard', kind: 'invoke' },
  { id: 'e-app-monitoring', source: 'fe-app', target: 'fe-monitoring', kind: 'invoke' },
  { id: 'e-app-infra', source: 'fe-app', target: 'fe-infra-dashboard', kind: 'invoke' },
  { id: 'e-app-admin', source: 'fe-app', target: 'fe-admin', kind: 'invoke' },
  { id: 'e-app-kb', source: 'fe-app', target: 'fe-knowledge-base', kind: 'invoke' },
  { id: 'e-app-assets', source: 'fe-app', target: 'fe-assets', kind: 'invoke' },
  { id: 'e-app-portal', source: 'fe-app', target: 'fe-client-portal', kind: 'invoke' },
  { id: 'e-app-graph', source: 'fe-app', target: 'fe-live-system-graph', kind: 'invoke' },

  // Páginas → API / banco direto (via supabase-js/PostgREST)
  { id: 'e-dashboard-db-tickets', source: 'fe-dashboard', target: 'db-tickets', kind: 'db' },
  { id: 'e-dashboard-api-tickets', source: 'fe-dashboard', target: 'api-tickets', kind: 'http' },
  { id: 'e-monitoring-api-monitoring', source: 'fe-monitoring', target: 'api-monitoring', kind: 'http' },
  { id: 'e-monitoring-ws-terminal', source: 'fe-monitoring', target: 'api-ws-terminal', kind: 'websocket' },
  { id: 'e-infra-api-monitoring', source: 'fe-infra-dashboard', target: 'api-monitoring', kind: 'http' },
  { id: 'e-admin-api-functions', source: 'fe-admin', target: 'api-functions', kind: 'http' },
  { id: 'e-kb-db', source: 'fe-knowledge-base', target: 'db-postgres', kind: 'db' },
  { id: 'e-kb-ai-search', source: 'fe-knowledge-base', target: 'ai-kb-search', kind: 'invoke' },
  { id: 'e-dashboard-ai-copilot', source: 'fe-dashboard', target: 'ai-ticket-copilot', kind: 'invoke' },
  { id: 'e-assets-api-monitoring', source: 'fe-assets', target: 'api-monitoring', kind: 'http' },
  { id: 'e-portal-db-tickets', source: 'fe-client-portal', target: 'db-tickets', kind: 'db' },
  { id: 'e-graph-ws-system-graph', source: 'fe-live-system-graph', target: 'api-ws-system-graph', kind: 'websocket' },

  // API → handlers Go
  { id: 'e-api-functions-fn', source: 'api-functions', target: 'go-fn-handlers', kind: 'invoke' },
  { id: 'e-api-monitoring-mon', source: 'api-monitoring', target: 'go-mon-handlers', kind: 'invoke' },
  { id: 'e-api-monitoring-network', source: 'api-monitoring', target: 'go-network-links-handlers', kind: 'invoke' },
  { id: 'e-api-monitoring-uptime', source: 'api-monitoring', target: 'go-uptime-handlers', kind: 'invoke' },
  { id: 'e-api-tickets-ticket', source: 'api-tickets', target: 'go-ticket-handlers', kind: 'invoke' },
  { id: 'e-api-auth-auth', source: 'api-auth', target: 'go-auth-handlers', kind: 'invoke' },
  { id: 'e-api-ws-terminal-hub', source: 'api-ws-terminal', target: 'go-ws-terminal', kind: 'invoke' },
  { id: 'e-api-ws-graph-hub', source: 'api-ws-system-graph', target: 'go-ws-system-graph', kind: 'invoke' },

  // Handlers Go → lib
  { id: 'e-fn-lib-db', source: 'go-fn-handlers', target: 'go-lib-db', kind: 'db' },
  { id: 'e-fn-lib-supabase', source: 'go-fn-handlers', target: 'go-lib-supabase', kind: 'invoke' },
  { id: 'e-fn-lib-email', source: 'go-fn-handlers', target: 'go-lib-email', kind: 'invoke' },
  { id: 'e-mon-lib-db', source: 'go-mon-handlers', target: 'go-lib-db', kind: 'db' },
  { id: 'e-mon-lib-monitoring', source: 'go-mon-handlers', target: 'go-lib-monitoring', kind: 'invoke' },
  { id: 'e-network-lib-db', source: 'go-network-links-handlers', target: 'go-lib-db', kind: 'db' },
  { id: 'e-uptime-lib-db', source: 'go-uptime-handlers', target: 'go-lib-db', kind: 'db' },
  { id: 'e-uptime-uptimerobot', source: 'go-uptime-handlers', target: 'svc-uptimerobot', kind: 'http' },
  { id: 'e-ticket-lib-db', source: 'go-ticket-handlers', target: 'go-lib-db', kind: 'db' },
  { id: 'e-auth-lib-db', source: 'go-auth-handlers', target: 'go-lib-db', kind: 'db' },
  { id: 'e-ws-terminal-agent', source: 'go-ws-terminal', target: 'svc-orion-agent', kind: 'websocket' },
  { id: 'e-ws-graph-lib-db', source: 'go-ws-system-graph', target: 'go-lib-db', kind: 'db' },

  // lib → banco / serviços externos
  { id: 'e-libdb-postgres', source: 'go-lib-db', target: 'db-postgres', kind: 'db' },
  { id: 'e-libdb-tickets', source: 'go-lib-db', target: 'db-tickets', kind: 'db' },
  { id: 'e-libdb-monitoring', source: 'go-lib-db', target: 'db-monitoring', kind: 'db' },
  { id: 'e-libmonitoring-db', source: 'go-lib-monitoring', target: 'db-monitoring', kind: 'db' },
  { id: 'e-libsupabase-auth', source: 'go-lib-supabase', target: 'svc-supabase-auth', kind: 'http' },
  { id: 'e-libemail-resend', source: 'go-lib-email', target: 'svc-resend', kind: 'http' },

  // Edge Functions → banco / auth / externos
  { id: 'e-svc-admin-update-db', source: 'svc-admin-update-user', target: 'db-postgres', kind: 'db' },
  { id: 'e-svc-admin-update-auth', source: 'svc-admin-update-user', target: 'svc-supabase-auth', kind: 'invoke' },
  { id: 'e-svc-create-user-db', source: 'svc-create-user-credentials', target: 'db-postgres', kind: 'db' },
  { id: 'e-svc-create-user-auth', source: 'svc-create-user-credentials', target: 'svc-supabase-auth', kind: 'invoke' },
  { id: 'e-svc-create-user-resend', source: 'svc-create-user-credentials', target: 'svc-resend', kind: 'http' },
  { id: 'e-svc-delete-user-db', source: 'svc-delete-user-admin', target: 'db-postgres', kind: 'db' },
  { id: 'e-svc-delete-user-auth', source: 'svc-delete-user-admin', target: 'svc-supabase-auth', kind: 'invoke' },
  { id: 'e-svc-invite-user-db', source: 'svc-invite-user-resend', target: 'db-postgres', kind: 'db' },
  { id: 'e-svc-invite-user-resend-api', source: 'svc-invite-user-resend', target: 'svc-resend', kind: 'http' },
  { id: 'e-svc-email-ticket-db', source: 'svc-email-to-ticket', target: 'db-tickets', kind: 'db' },
  { id: 'e-svc-reset-pw-db', source: 'svc-reset-password', target: 'db-postgres', kind: 'db' },
  { id: 'e-svc-pw-alert-resend', source: 'svc-send-password-alert', target: 'svc-resend', kind: 'http' },

  // AI (busca de KB usa Postgres textual, Vault não conectado a IA nenhuma)
  { id: 'e-ai-kb-db', source: 'ai-kb-search', target: 'db-postgres', kind: 'db' },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- architecture.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts src/lib/systemGraph/architecture.ts src/lib/systemGraph/architecture.test.ts
git commit -m "feat(system-graph): add curated architecture catalog"
```

---

## Task 2: SystemEvent / NodeStatus types

**Files:**
- Create: `src/lib/systemGraph/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SystemEvent`, `NodeStatus` — used by Task 3 (store), Task 4 (Go mirrors this shape as JSON), Task 6 (socket hook).

- [ ] **Step 1: Write the type file (no test needed — pure type declarations, verified by tsc in later tasks)**

```ts
// src/lib/systemGraph/types.ts

export type NodeStatus = 'idle' | 'processing' | 'success' | 'error';

/** Wire format from /api/ws/system-graph. Mirrored by the Go struct in handler/ws_system_graph.go — keep both in sync. */
export interface SystemEvent {
  id: string;
  timestamp: string; // ISO 8601
  edge_id: string;   // must match an ArchEdge.id from architecture.ts
  status: 'processing' | 'success' | 'error';
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/systemGraph/types.ts
git commit -m "feat(system-graph): add SystemEvent/NodeStatus types"
```

---

## Task 3: Zustand store

**Files:**
- Create: `src/lib/systemGraph/store.ts`
- Test: `src/lib/systemGraph/store.test.ts`

**Interfaces:**
- Consumes: `SystemEvent`, `NodeStatus` (Task 2), `ARCH_EDGES` (Task 1, to resolve `edge_id` → `source`/`target` node ids).
- Produces: `useSystemGraphStore` — a Zustand hook with state `{ nodeStatus: Record<string, NodeStatus>, activeEdgeIds: string[], eventLog: SystemEvent[] }` and actions `applyEvent(event: SystemEvent): void`, `reset(): void`. Task 6 (socket hook) calls `applyEvent`. Task 8/10 (GraphView) reads `nodeStatus`/`activeEdgeIds`. Task 11 (EventLogPanel) reads `eventLog`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/systemGraph/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSystemGraphStore } from './store';
import { ARCH_EDGES } from './architecture';

const sampleEdge = ARCH_EDGES[0]; // e-app-dashboard: fe-app -> fe-dashboard

function makeEvent(status: 'processing' | 'success' | 'error') {
  return {
    id: 'evt-1',
    timestamp: new Date().toISOString(),
    edge_id: sampleEdge.id,
    status,
  };
}

beforeEach(() => {
  useSystemGraphStore.getState().reset();
});

describe('useSystemGraphStore', () => {
  it('starts with every status idle and an empty log', () => {
    const { nodeStatus, activeEdgeIds, eventLog } = useSystemGraphStore.getState();
    expect(nodeStatus).toEqual({});
    expect(activeEdgeIds).toEqual([]);
    expect(eventLog).toEqual([]);
  });

  it('applying a processing event marks source and target as processing and activates the edge', () => {
    useSystemGraphStore.getState().applyEvent(makeEvent('processing'));
    const { nodeStatus, activeEdgeIds } = useSystemGraphStore.getState();
    expect(nodeStatus[sampleEdge.source]).toBe('processing');
    expect(nodeStatus[sampleEdge.target]).toBe('processing');
    expect(activeEdgeIds).toContain(sampleEdge.id);
  });

  it('applying a success event marks target as success and deactivates the edge', () => {
    useSystemGraphStore.getState().applyEvent(makeEvent('processing'));
    useSystemGraphStore.getState().applyEvent(makeEvent('success'));
    const { nodeStatus, activeEdgeIds } = useSystemGraphStore.getState();
    expect(nodeStatus[sampleEdge.target]).toBe('success');
    expect(activeEdgeIds).not.toContain(sampleEdge.id);
  });

  it('applying an error event marks target as error and deactivates the edge', () => {
    useSystemGraphStore.getState().applyEvent(makeEvent('processing'));
    useSystemGraphStore.getState().applyEvent(makeEvent('error'));
    const { nodeStatus, activeEdgeIds } = useSystemGraphStore.getState();
    expect(nodeStatus[sampleEdge.target]).toBe('error');
    expect(activeEdgeIds).not.toContain(sampleEdge.id);
  });

  it('appends every event to the log, newest first, capped at 50', () => {
    for (let i = 0; i < 55; i++) {
      useSystemGraphStore.getState().applyEvent({ ...makeEvent('success'), id: `evt-${i}` });
    }
    const { eventLog } = useSystemGraphStore.getState();
    expect(eventLog.length).toBe(50);
    expect(eventLog[0].id).toBe('evt-54');
  });

  it('ignores an event whose edge_id is not in the catalog', () => {
    useSystemGraphStore.getState().applyEvent({ id: 'x', timestamp: new Date().toISOString(), edge_id: 'does-not-exist', status: 'processing' });
    const { nodeStatus, eventLog } = useSystemGraphStore.getState();
    expect(nodeStatus).toEqual({});
    expect(eventLog).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- store.test.ts`
Expected: FAIL with "Cannot find module './store'".

- [ ] **Step 3: Write the store**

```ts
// src/lib/systemGraph/store.ts
import { create } from 'zustand';
import { ARCH_EDGES } from './architecture';
import type { SystemEvent, NodeStatus } from './types';

const EDGE_BY_ID = new Map(ARCH_EDGES.map(e => [e.id, e]));
const EVENT_LOG_LIMIT = 50;

interface SystemGraphState {
  nodeStatus: Record<string, NodeStatus>;
  activeEdgeIds: string[];
  eventLog: SystemEvent[];
  applyEvent: (event: SystemEvent) => void;
  reset: () => void;
}

export const useSystemGraphStore = create<SystemGraphState>((set, get) => ({
  nodeStatus: {},
  activeEdgeIds: [],
  eventLog: [],

  applyEvent: (event: SystemEvent) => {
    const edge = EDGE_BY_ID.get(event.edge_id);
    if (!edge) return; // unknown edge_id — ignore rather than crash on a bad/future payload

    const { nodeStatus, activeEdgeIds, eventLog } = get();

    const nextNodeStatus = { ...nodeStatus };
    if (event.status === 'processing') {
      nextNodeStatus[edge.source] = 'processing';
      nextNodeStatus[edge.target] = 'processing';
    } else {
      nextNodeStatus[edge.target] = event.status;
    }

    const nextActiveEdgeIds = event.status === 'processing'
      ? Array.from(new Set([...activeEdgeIds, edge.id]))
      : activeEdgeIds.filter(id => id !== edge.id);

    const nextEventLog = [event, ...eventLog].slice(0, EVENT_LOG_LIMIT);

    set({ nodeStatus: nextNodeStatus, activeEdgeIds: nextActiveEdgeIds, eventLog: nextEventLog });
  },

  reset: () => set({ nodeStatus: {}, activeEdgeIds: [], eventLog: [] }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- store.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/systemGraph/store.ts src/lib/systemGraph/store.test.ts
git commit -m "feat(system-graph): add Zustand store for live node/edge status"
```

---

## Task 4: Go WS hub — connection lifecycle and auth

**Files:**
- Create: `handler/ws_system_graph.go`
- Test: `handler/ws_system_graph_test.go`

**Interfaces:**
- Consumes: `db.UserScopeByID` (from `lib/db.go`, already used identically in `handler/mon_handlers.go`'s `escopoDoUsuario`), `sb.GetUserByAccessToken` (from `lib/supabase.go`, already used in `handler/ws_terminal.go`), the package-level `upgrader`, `corsAllowlist`, `subprotocoloBearer` already defined in `handler/ws_terminal.go` (same package `handler`, no import needed).
- Produces: `SystemGraphHub` (struct), `WsSystemGraphHandler` (http.HandlerFunc) — consumed by Task 5 (router registration).

- [ ] **Step 1: Write the failing test**

```go
// handler/ws_system_graph_test.go
package handler

import (
	"testing"
)

func TestSystemGraphHub_RegisterUnregister(t *testing.T) {
	hub := &SystemGraphHub{clients: make(map[*SafeConn]bool)}
	conn := &SafeConn{} // zero-value conn is fine here: we only exercise the hub's map bookkeeping, not real I/O

	hub.register(conn)
	if !hub.isRegistered(conn) {
		t.Fatal("expected conn to be registered after register()")
	}

	hub.unregister(conn)
	if hub.isRegistered(conn) {
		t.Fatal("expected conn to be unregistered after unregister()")
	}
}

func TestAutorizarSystemGraph_SemToken(t *testing.T) {
	// Sem subprotocolo nenhum, deve recusar antes de qualquer acesso a db/sb.
	req := newTestRequestSemSubprotocolo(t)
	rec := newTestResponseRecorder()
	ok := autorizarSystemGraph(rec, req)
	if ok {
		t.Fatal("esperado false sem token no subprotocolo")
	}
	if rec.Code != 401 {
		t.Fatalf("esperado 401, recebido %d", rec.Code)
	}
}
```

Add these two tiny test helpers at the bottom of the same file (kept local to this test file — they only wrap `net/http/httptest` and are not part of the package's public surface):

```go
func newTestResponseRecorder() *httptest.ResponseRecorder {
	return httptest.NewRecorder()
}

func newTestRequestSemSubprotocolo(t *testing.T) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/ws/system-graph", nil)
	return req
}
```

Add the two extra imports (`net/http`, `net/http/httptest`) to the `import` block at the top of `handler/ws_system_graph_test.go`:

```go
import (
	"net/http"
	"net/http/httptest"
	"testing"
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./handler/... -run TestSystemGraphHub_RegisterUnregister -v`
Expected: FAIL to compile — `SystemGraphHub`, `autorizarSystemGraph` undefined.

- [ ] **Step 3: Write the hub + auth**

```go
// handler/ws_system_graph.go

// ws_system_graph.go — hub de broadcast do grafo ao vivo da arquitetura
// (Live System Graph). Mesma arquitetura de conexão de handler/ws_terminal.go
// (upgrade, CheckOrigin restrito à allowlist, subprotocolo pra token), mas
// broadcast 1-para-N em vez da ponte 1-para-1 do terminal: aqui não há
// "outro lado" pra emparelhar, todo cliente conectado recebe todo evento.
//
// Hoje o hub só emite eventos SIMULADOS (ver simularEventos), no mesmo
// formato JSON que uma instrumentação real usaria depois — trocar mock por
// real é plugar emissores reais e apagar simularEventos, sem tocar no
// frontend (o contrato SystemEvent não muda).

package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	mrand "math/rand/v2"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// systemGraphEvent espelha src/lib/systemGraph/types.ts — manter os dois em sincronia.
type systemGraphEvent struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	EdgeID    string `json:"edge_id"`
	Status    string `json:"status"` // "processing" | "success" | "error"
}

// edgesSimulaveis espelha um subconjunto real de ARCH_EDGES em
// src/lib/systemGraph/architecture.ts — os ids de edge "mais interessantes"
// (fluxos de requisição reais), usados só pelo gerador simulado abaixo.
var edgesSimulaveis = []string{
	"e-dashboard-api-tickets",
	"e-monitoring-api-monitoring",
	"e-infra-api-monitoring",
	"e-admin-api-functions",
	"e-kb-ai-search",
	"e-api-functions-fn",
	"e-api-monitoring-mon",
	"e-api-tickets-ticket",
	"e-fn-lib-db",
	"e-mon-lib-db",
	"e-libdb-postgres",
	"e-ws-terminal-agent",
	"e-svc-create-user-resend",
	"e-svc-email-ticket-db",
	"e-uptime-uptimerobot",
	"e-ai-kb-db",
}

type SystemGraphHub struct {
	mu      sync.Mutex
	clients map[*SafeConn]bool
}

var graphHub = &SystemGraphHub{clients: make(map[*SafeConn]bool)}

func (h *SystemGraphHub) register(c *SafeConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

func (h *SystemGraphHub) unregister(c *SafeConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
}

func (h *SystemGraphHub) isRegistered(c *SafeConn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.clients[c]
}

func (h *SystemGraphHub) broadcast(payload []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
			// Falha de escrita: a leitura desse cliente (em bombearSystemGraph)
			// vai detectar a conexão morta e desregistrar — não fazemos isso
			// aqui pra não desregistrar durante a iteração do map.
			continue
		}
	}
}

// autorizarSystemGraph valida o token do Supabase vindo no subprotocolo e
// confirma que o papel do usuário pode ver o mapa de arquitetura.
//
// Falha fechado: qualquer erro devolve false e a conexão nem chega a ser
// promovida a WebSocket. Não há checagem de empresa/máquina aqui — ao
// contrário do terminal remoto, o grafo representa a arquitetura do próprio
// Orion System, não dado de uma empresa cliente específica.
func autorizarSystemGraph(w http.ResponseWriter, r *http.Request) bool {
	token := ""
	for _, p := range websocket.Subprotocols(r) {
		if p != subprotocoloBearer && strings.TrimSpace(p) != "" {
			token = strings.TrimSpace(p)
		}
	}
	if token == "" {
		http.Error(w, "não autorizado: token ausente", http.StatusUnauthorized)
		return false
	}

	if db == nil || sb == nil {
		http.Error(w, "serviço indisponível", http.StatusServiceUnavailable)
		return false
	}

	user, err := sb.GetUserByAccessToken(r.Context(), token)
	if err != nil {
		http.Error(w, "não autorizado: token inválido ou expirado", http.StatusUnauthorized)
		return false
	}

	escopo, err := db.UserScopeByID(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "não foi possível verificar permissões do usuário", http.StatusForbidden)
		return false
	}

	if !escopo.Global() && escopo.Role != "admin" && escopo.Role != "technician" {
		http.Error(w, "acesso restrito: apenas administradores, desenvolvedores e técnicos podem ver o mapa de arquitetura", http.StatusForbidden)
		return false
	}

	return true
}

func randomEventID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// simularEventos roda em background enquanto houver clientes conectados,
// emitindo um SystemEvent plausível a cada 1-3s em uma edge real do catálogo.
func simularEventos(hub *SystemGraphHub, pararEm <-chan struct{}) {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()

	statusSequence := []string{"processing", "success"}
	for {
		select {
		case <-pararEm:
			return
		case <-ticker.C:
			edgeID := edgesSimulaveis[mrand.IntN(len(edgesSimulaveis))]
			status := statusSequence[mrand.IntN(len(statusSequence))]
			if mrand.IntN(20) == 0 {
				status = "error" // erro ocasional, pra exercitar o estado visual de erro
			}
			evt := systemGraphEvent{
				ID:        randomEventID(),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
				EdgeID:    edgeID,
				Status:    status,
			}
			payload, err := json.Marshal(evt)
			if err != nil {
				continue
			}
			hub.broadcast(payload)
		}
	}
}

// WsSystemGraphHandler liga o navegador ao hub de broadcast do grafo.
func WsSystemGraphHandler(w http.ResponseWriter, r *http.Request) {
	if !autorizarSystemGraph(w, r) {
		return
	}

	conn, err := upgrader.Upgrade(w, r, http.Header{
		"Sec-WebSocket-Protocol": {subprotocoloBearer},
	})
	if err != nil {
		log.Println("system-graph ws upgrade error:", err)
		return
	}
	safeConn := &SafeConn{conn: conn}
	defer safeConn.Close()

	graphHub.register(safeConn)
	defer graphHub.unregister(safeConn)

	pararSimulacao := make(chan struct{})
	defer close(pararSimulacao)
	go simularEventos(graphHub, pararSimulacao)

	// O cliente não manda nada relevante — só lemos pra detectar
	// desconexão (o navegador fecha o TCP) e responder a pings, mesmo
	// padrão de deadline/keepalive do ws_terminal.go.
	_ = safeConn.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	safeConn.conn.SetPongHandler(func(string) error {
		return safeConn.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	})
	for {
		if _, _, err := safeConn.ReadMessage(); err != nil {
			return
		}
		_ = safeConn.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go build ./... && go test ./handler/... -run 'TestSystemGraphHub_RegisterUnregister|TestAutorizarSystemGraph_SemToken' -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add handler/ws_system_graph.go handler/ws_system_graph_test.go
git commit -m "feat(system-graph): add Go WS hub with auth and simulated event generator"
```

---

## Task 5: Register the route

**Files:**
- Modify: `handler/router.go`

**Interfaces:**
- Consumes: `WsSystemGraphHandler` (Task 4).

- [ ] **Step 1: Add the route registration**

In `handler/router.go`, immediately after the existing lines (currently lines 138-139):
```go
	r.Get("/api/ws/terminal", WsTerminalBrowserHandler)
	r.Get("/api/ws/terminal/agent", WsTerminalAgentHandler)
```
add:
```go
	r.Get("/api/ws/system-graph", WsSystemGraphHandler)
```

This stays in the same "outside `RequireCompanyScope`" section as the terminal routes (see the comment above line 126: `ws/terminal*   token no subprotocolo / X-Agent-Key`) — update that comment to also mention `ws/system-graph`, since it now shares the same "auth is manual, not the standard middleware" reasoning:
```go
	//   ws/terminal*, ws/system-graph  token no subprotocolo (WS não aceita header Authorization)
```

- [ ] **Step 2: Verify the whole backend still builds and all existing tests pass**

Run: `go build ./... && go test ./... -v 2>&1 | tail -60`
Expected: PASS, including `TestRotasComAutenticacaoPropriaNaoExigemEscopo` in `handler/tenant_middleware_test.go` — that test doesn't yet know about `/api/ws/system-graph`, so it won't fail, but see Task 16 for adding it there for completeness.

- [ ] **Step 3: Commit**

```bash
git add handler/router.go
git commit -m "feat(system-graph): register /api/ws/system-graph route"
```

---

## Task 6: Frontend WS hook with reconnect

**Files:**
- Create: `src/hooks/useSystemGraphSocket.ts`

**Interfaces:**
- Consumes: `useSystemGraphStore` (Task 3), `supabase` client (`@/integrations/supabase/client`, same import used in `RemoteTerminal.tsx`).
- Produces: `useSystemGraphSocket(): { status: 'connecting' | 'open' | 'closed' }` — called once from `LiveSystemGraph.tsx` (Task 9).

- [ ] **Step 1: Write the hook**

Mirrors `src/components/monitoring/RemoteTerminal.tsx`'s exact WS URL construction and subprotocol auth pattern (lines 85-102 of that file), adding reconnect-with-backoff on close/error (which `RemoteTerminal.tsx` doesn't need, since that connection is user-initiated per session; this one should stay live while the page is open).

```ts
// src/hooks/useSystemGraphSocket.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemGraphStore } from '@/lib/systemGraph/store';
import type { SystemEvent } from '@/lib/systemGraph/types';

type SocketStatus = 'connecting' | 'open' | 'closed';

const MAX_BACKOFF_MS = 15_000;

export function useSystemGraphSocket(): { status: SocketStatus } {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const applyEvent = useSystemGraphStore(s => s.applyEvent);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    const connect = async () => {
      if (stoppedRef.current) return;
      setStatus('connecting');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        // Sem sessão válida ainda (ex.: app recém carregou) — tenta de novo em breve
        // em vez de desistir, já que o AuthProvider pode terminar de resolver a
        // sessão logo em seguida.
        scheduleReconnect();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : window.location.host;
      const wsUrl = `${protocol}//${host}/api/ws/system-graph`;

      const ws = new WebSocket(wsUrl, ['orion-bearer', accessToken]);

      ws.onopen = () => {
        attemptRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as SystemEvent;
          applyEvent(parsed);
        } catch {
          // Payload malformado — ignora este evento, não derruba a conexão.
        }
      };

      ws.onclose = () => {
        setStatus('closed');
        wsRef.current = null;
        if (!stoppedRef.current) scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    const scheduleReconnect = () => {
      const attempt = attemptRef.current++;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      setTimeout(() => {
        if (!stoppedRef.current) connect();
      }, delay);
    };

    connect();

    return () => {
      stoppedRef.current = true;
      wsRef.current?.close();
    };
  }, [applyEvent]);

  return { status };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSystemGraphSocket.ts
git commit -m "feat(system-graph): add WS hook with exponential-backoff reconnect"
```

---

## Task 7: Page shell, route, and nav entry

**Files:**
- Create: `src/pages/LiveSystemGraph.tsx` (minimal shell for now — `GraphView` fills in across Tasks 8-15)
- Modify: `src/App.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx`

**Interfaces:**
- Consumes: `useSystemGraphSocket` (Task 6).
- Produces: the `/grafo-sistema` route, reachable from the nav — later tasks fill in the page body.

- [ ] **Step 1: Write the minimal page**

```tsx
// src/pages/LiveSystemGraph.tsx
import { useSystemGraphSocket } from '@/hooks/useSystemGraphSocket';

export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Grafo em construção (Task 8+).
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `src/App.tsx`**

Add the lazy import alongside the others (after the `WebMonitoring` import, line 35):
```tsx
const LiveSystemGraph = lazy(() => import("./pages/LiveSystemGraph"));
```

Add the route alongside the other `allowedRoles`-restricted routes (after the `/monitoramento-web` route, line 96):
```tsx
              <Route path="/grafo-sistema" element={<AppRoute allowedRoles={['admin', 'developer', 'technician']}><LiveSystemGraph /></AppRoute>} />
```

- [ ] **Step 3: Add the nav entry in `src/components/dashboard/Sidebar.tsx`**

In the same group as `/sistemas` / `/monitoramento-web` / `/ativos` (the array containing the `Activity`/`Layers`/`Cpu`/`Globe` icon items), add:
```tsx
      { icon: Waypoints, label: 'Live System Graph', path: '/grafo-sistema', roles: ['admin', 'developer', 'technician'] },
```

Add `Waypoints` to the `lucide-react` import at the top of the file (it will already be importing several icons from `'lucide-react'` — add `Waypoints` to that existing import list, don't create a second import statement).

- [ ] **Step 4: Verify build and manually check navigation**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Then start the dev server and confirm:
1. Logging in as a user with role `admin`, `developer`, or `technician` shows "Live System Graph" in the sidebar, in the same group as "Sistemas e Alertas".
2. Clicking it navigates to `/grafo-sistema` and shows the connection status flipping from "conectando…" to "ao vivo" within a couple seconds (proves Task 4-6's WS round-trip already works end to end, even before the graph itself is built).
3. No other page/route changed behavior.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LiveSystemGraph.tsx src/App.tsx src/components/dashboard/Sidebar.tsx
git commit -m "feat(system-graph): add page shell, route, and nav entry"
```

---

## Task 8: GraphView — render the catalog with reagraph

**Files:**
- Create: `src/components/systemGraph/GraphView.tsx`
- Modify: `src/pages/LiveSystemGraph.tsx`

**Interfaces:**
- Consumes: `ARCH_NODES`, `ARCH_EDGES`, `NodeKind` (Task 1), `reagraph`'s `GraphCanvas`, `GraphNode`, `GraphEdge`, `GraphCanvasRef` (confirmed real exports of `reagraph@4.22.0` by reading `node_modules/reagraph/dist/types.d.ts` and `GraphCanvas.d.ts` directly).
- Produces: `GraphView` component, forwarding a `ref` of type `GraphCanvasRef` — Task 13 (path highlighting) and Task 15 (particles) need this ref.

- [ ] **Step 1: Write the node/edge mapping and canvas**

`reagraph`'s `GraphNode`/`GraphEdge` types (confirmed in `node_modules/reagraph/dist/types.d.ts`) are `{ id, label?, data?, size?, fill?, icon?, ... }` — our `ArchNode`/`ArchEdge` map onto them directly, carrying the full `ArchNode`/`ArchEdge` as `data` so click handlers (Task 12) get back the original catalog entry, not just the reagraph-internal shape.

```tsx
// src/components/systemGraph/GraphView.tsx
import { forwardRef } from 'react';
import { GraphCanvas, GraphCanvasRef, GraphNode as ReaGraphNode, GraphEdge as ReaGraphEdge } from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, ArchNode, ArchEdge, NodeKind } from '@/lib/systemGraph/architecture';

export const NODE_KIND_COLOR: Record<NodeKind, string> = {
  frontend: '#3b82f6',
  backend: '#8b5cf6',
  database: '#10b981',
  service: '#f59e0b',
  api: '#06b6d4',
  ai: '#ec4899',
};

const reaNodes: ReaGraphNode[] = ARCH_NODES.map((n: ArchNode) => ({
  id: n.id,
  label: n.label,
  fill: NODE_KIND_COLOR[n.kind],
  data: n,
}));

const reaEdges: ReaGraphEdge[] = ARCH_EDGES.map((e: ArchEdge) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  data: e,
}));

interface GraphViewProps {
  selections: string[];
  actives: string[];
  onNodeClick?: (node: ArchNode) => void;
  onCanvasClick?: () => void;
}

export const GraphView = forwardRef<GraphCanvasRef, GraphViewProps>(
  ({ selections, actives, onNodeClick, onCanvasClick }, ref) => {
    return (
      <GraphCanvas
        ref={ref}
        nodes={reaNodes}
        edges={reaEdges}
        layoutType="forceDirected3d"
        cameraMode="orbit"
        selections={selections}
        actives={actives}
        onNodeClick={(node) => onNodeClick?.(node.data as ArchNode)}
        onCanvasClick={() => onCanvasClick?.()}
      />
    );
  }
);
GraphView.displayName = 'GraphView';
```

- [ ] **Step 2: Wire it into the page**

Replace the placeholder `<div>` in `src/pages/LiveSystemGraph.tsx` with `GraphView`, holding `selections`/`actives` as local state for now (Task 13 wires real selection logic; Task 6's `activeEdgeIds` from the store gets merged in Task 10):

```tsx
// src/pages/LiveSystemGraph.tsx
import { useRef, useState } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSystemGraphSocket } from '@/hooks/useSystemGraphSocket';
import { GraphView } from '@/components/systemGraph/GraphView';

export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const [selections, setSelections] = useState<string[]>([]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 relative">
        <GraphView
          ref={graphRef}
          selections={selections}
          actives={[]}
          onCanvasClick={() => setSelections([])}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build and manually check rendering**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Manually open `/grafo-sistema`: expect a 3D force-directed graph with ~45 colored nodes and ~50 edges, draggable/orbitable with the mouse. If `tsc` complains that `reagraph` has no type declarations, check `node_modules/reagraph/package.json`'s `"types"` field — it's a bundled-types package, so this should not happen, but if it does, stop and report rather than adding a blanket `// @ts-ignore`.

- [ ] **Step 4: Commit**

```bash
git add src/components/systemGraph/GraphView.tsx src/pages/LiveSystemGraph.tsx
git commit -m "feat(system-graph): render the architecture catalog with reagraph GraphCanvas"
```

---

## Task 9: Custom node rendering by kind (icons)

**Files:**
- Modify: `src/components/systemGraph/GraphView.tsx`

**Interfaces:**
- Consumes: `NodeRenderer`, `NodeRendererProps` (reagraph, confirmed in `node_modules/reagraph/dist/types.d.ts`).

- [ ] **Step 1: Add a `renderNode` using reagraph's built-in node shape, colored by kind**

`reagraph@4.22.0`'s `renderNode` prop expects a Three.js/R3F `ReactNode` back (it replaces the whole node mesh, not just its color). Building a correct custom 3D node mesh from scratch is riskier than it needs to be for "different node types" — the spec's actual requirement is **visually distinguishable node types**, which the `fill` color set in Task 8 already achieves. Skip `renderNode` for now; instead add a `label` badge per kind so it reads clearly even without color (e.g. colorblind-safe, and readable in the details panel/legend too):

In `src/components/systemGraph/GraphView.tsx`, change the `reaNodes` mapping to also set `subLabel` (a real `GraphElementBaseAttributes` field, confirmed in `types.d.ts`):

```ts
const KIND_LABEL: Record<NodeKind, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  service: 'Service',
  api: 'API',
  ai: 'AI',
};

const reaNodes: ReaGraphNode[] = ARCH_NODES.map((n: ArchNode) => ({
  id: n.id,
  label: n.label,
  subLabel: KIND_LABEL[n.kind],
  fill: NODE_KIND_COLOR[n.kind],
  data: n,
}));
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 3: Manually verify**

Open `/grafo-sistema`, zoom into a couple of nodes, confirm the sub-label (kind) renders under the node label and colors are visibly distinct per kind.

- [ ] **Step 4: Commit**

```bash
git add src/components/systemGraph/GraphView.tsx
git commit -m "feat(system-graph): label nodes with their kind for readability"
```

---

## Task 10: Visual states (idle/processing/success/error) from the store

**Files:**
- Modify: `src/components/systemGraph/GraphView.tsx`
- Modify: `src/pages/LiveSystemGraph.tsx`

**Interfaces:**
- Consumes: `useSystemGraphStore` (Task 3).

- [ ] **Step 1: Blend node status into node fill color**

`NodeStatus` colors, added alongside `NODE_KIND_COLOR` in `GraphView.tsx`:

```ts
const STATUS_OVERRIDE_COLOR: Partial<Record<NodeStatus, string>> = {
  processing: '#fbbf24', // amber pulse
  success: '#22c55e',
  error: '#ef4444',
};
```

(`idle` intentionally has no entry — falls back to the kind color from Task 8.)

Update `GraphViewProps` to accept `nodeStatus: Record<string, NodeStatus>` and recompute `reaNodes`'s `fill` per render instead of at module scope (it was a `const` computed once at import time in Task 8 — that's now wrong, since color must react to live status). Move the `reaNodes` computation inside the component body as a `useMemo`:

```tsx
import { useMemo } from 'react';
import type { NodeStatus } from '@/lib/systemGraph/types';

interface GraphViewProps {
  selections: string[];
  actives: string[];
  nodeStatus: Record<string, NodeStatus>;
  onNodeClick?: (node: ArchNode) => void;
  onCanvasClick?: () => void;
}

export const GraphView = forwardRef<GraphCanvasRef, GraphViewProps>(
  ({ selections, actives, nodeStatus, onNodeClick, onCanvasClick }, ref) => {
    const reaNodes: ReaGraphNode[] = useMemo(() => ARCH_NODES.map((n: ArchNode) => ({
      id: n.id,
      label: n.label,
      subLabel: KIND_LABEL[n.kind],
      fill: STATUS_OVERRIDE_COLOR[nodeStatus[n.id]] ?? NODE_KIND_COLOR[n.kind],
      data: n,
    })), [nodeStatus]);

    return (
      <GraphCanvas
        ref={ref}
        nodes={reaNodes}
        edges={reaEdges}
        layoutType="forceDirected3d"
        cameraMode="orbit"
        selections={selections}
        actives={actives}
        onNodeClick={(node) => onNodeClick?.(node.data as ArchNode)}
        onCanvasClick={() => onCanvasClick?.()}
      />
    );
  }
);
```

(`reaEdges` stays module-level — it never changes.)

- [ ] **Step 2: Wire the store into the page**

In `src/pages/LiveSystemGraph.tsx`, read `nodeStatus` and `activeEdgeIds` from the store and pass them down:

```tsx
import { useSystemGraphStore } from '@/lib/systemGraph/store';
// ...
export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const [selections, setSelections] = useState<string[]>([]);
  const nodeStatus = useSystemGraphStore(s => s.nodeStatus);
  const activeEdgeIds = useSystemGraphStore(s => s.activeEdgeIds);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 relative">
        <GraphView
          ref={graphRef}
          selections={selections}
          actives={activeEdgeIds}
          nodeStatus={nodeStatus}
          onCanvasClick={() => setSelections([])}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build and manually check live updates**

Run: `npx tsc --noEmit && npm run build`

Open `/grafo-sistema` and watch for ~10-20 seconds: nodes along the simulated edges (`edgesSimulaveis` in Task 4's Go file) should flash amber (processing) then settle to green (success) or occasionally red (error), roughly every 1.5s per the Go ticker.

- [ ] **Step 4: Commit**

```bash
git add src/components/systemGraph/GraphView.tsx src/pages/LiveSystemGraph.tsx
git commit -m "feat(system-graph): drive node color from live idle/processing/success/error status"
```

---

## Task 11: Node Details Sheet

**Files:**
- Create: `src/components/systemGraph/NodeDetailsSheet.tsx`
- Modify: `src/pages/LiveSystemGraph.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` (`@/components/ui/sheet`, same components used by `MachineDrawer.tsx`), `ArchNode`, `ArchEdge`, `ARCH_EDGES` (Task 1), `useSystemGraphStore` (Task 3, for that node's recent events).

- [ ] **Step 1: Write the component**

Follows `MachineDrawer.tsx`'s exact `<Sheet open={open} onOpenChange={...}><SheetContent side="right" className="w-full sm:max-w-xl ...">` shape (confirmed by reading that file directly).

```tsx
// src/components/systemGraph/NodeDetailsSheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArchNode, ARCH_EDGES } from '@/lib/systemGraph/architecture';
import { useSystemGraphStore } from '@/lib/systemGraph/store';

interface NodeDetailsSheetProps {
  node: ArchNode | null;
  open: boolean;
  onClose: () => void;
}

export function NodeDetailsSheet({ node, open, onClose }: NodeDetailsSheetProps) {
  const eventLog = useSystemGraphStore(s => s.eventLog);

  const connectedEdges = node
    ? ARCH_EDGES.filter(e => e.source === node.id || e.target === node.id)
    : [];
  const recentEvents = node
    ? eventLog.filter(evt => connectedEdges.some(e => e.id === evt.edge_id)).slice(0, 10)
    : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {node && (
          <>
            <SheetHeader>
              <SheetTitle>{node.label}</SheetTitle>
              <SheetDescription>{node.description}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {node.sourceRef && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Referência no código</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{node.sourceRef}</code>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Conexões ({connectedEdges.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {connectedEdges.map(e => (
                    <Badge key={e.id} variant="outline" className="text-[10px]">
                      {e.source === node.id ? `→ ${e.target}` : `← ${e.source}`}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Eventos recentes
                </p>
                <ScrollArea className="h-40">
                  {recentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum evento recente.</p>
                  ) : (
                    <ul className="space-y-1">
                      {recentEvents.map(evt => (
                        <li key={evt.id} className="text-xs flex justify-between">
                          <span>{evt.edge_id}</span>
                          <span className="text-muted-foreground">{evt.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Wire click-to-open into the page**

```tsx
// src/pages/LiveSystemGraph.tsx — add state + handler + render the sheet
import { NodeDetailsSheet } from '@/components/systemGraph/NodeDetailsSheet';
import type { ArchNode } from '@/lib/systemGraph/architecture';
// ...
  const [detailsNode, setDetailsNode] = useState<ArchNode | null>(null);
// ...
        <GraphView
          ref={graphRef}
          selections={selections}
          actives={activeEdgeIds}
          nodeStatus={nodeStatus}
          onNodeClick={(node) => setDetailsNode(node)}
          onCanvasClick={() => setSelections([])}
        />
      </div>
      <NodeDetailsSheet node={detailsNode} open={!!detailsNode} onClose={() => setDetailsNode(null)} />
```

- [ ] **Step 3: Verify build and manually check**

Run: `npx tsc --noEmit && npm run build`

Open `/grafo-sistema`, click a node, confirm the sheet opens with its description, source ref, connections, and (if it happens to be on an active simulated edge) recent events.

- [ ] **Step 4: Commit**

```bash
git add src/components/systemGraph/NodeDetailsSheet.tsx src/pages/LiveSystemGraph.tsx
git commit -m "feat(system-graph): add node details sheet on click"
```

---

## Task 12: Event Log panel and Legend

**Files:**
- Create: `src/components/systemGraph/EventLogPanel.tsx`
- Create: `src/components/systemGraph/LegendPanel.tsx`
- Modify: `src/pages/LiveSystemGraph.tsx`

**Interfaces:**
- Consumes: `useSystemGraphStore` (eventLog), `ARCH_NODES`/`NODE_KIND_COLOR` (Task 1/8), `ScrollArea` (`@/components/ui/scroll-area`), `date-fns`'s `formatDistanceToNow` + `ptBR` locale (same import already used in `MachineDrawer.tsx`).

- [ ] **Step 1: Write EventLogPanel**

```tsx
// src/components/systemGraph/EventLogPanel.tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSystemGraphStore } from '@/lib/systemGraph/store';

const STATUS_DOT: Record<string, string> = {
  processing: 'bg-amber-400',
  success: 'bg-green-500',
  error: 'bg-red-500',
};

export function EventLogPanel() {
  const eventLog = useSystemGraphStore(s => s.eventLog);

  return (
    <div className="w-72 border-l border-border/40 flex flex-col">
      <div className="px-4 py-3 border-b border-border/40">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Eventos recentes
        </h2>
      </div>
      <ScrollArea className="flex-1">
        {eventLog.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">Aguardando eventos…</p>
        ) : (
          <ul className="divide-y divide-border/20">
            {eventLog.map(evt => (
              <li key={evt.id} className="px-4 py-2 flex items-center gap-2 text-xs">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[evt.status])} />
                <span className="flex-1 truncate">{evt.edge_id}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(evt.timestamp), { locale: ptBR, addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Write LegendPanel**

```tsx
// src/components/systemGraph/LegendPanel.tsx
import { NODE_KIND_COLOR } from './GraphView';
import type { NodeKind } from '@/lib/systemGraph/architecture';

const KIND_LABEL: Record<NodeKind, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  service: 'Service',
  api: 'API',
  ai: 'AI',
};

export function LegendPanel() {
  return (
    <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur border border-border/40 rounded-lg p-3 space-y-1.5">
      {(Object.keys(KIND_LABEL) as NodeKind[]).map(kind => (
        <div key={kind} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_KIND_COLOR[kind] }} />
          {KIND_LABEL[kind]}
        </div>
      ))}
    </div>
  );
}
```

`GraphView.tsx` needs `export` added to `NODE_KIND_COLOR` (Step 1 of Task 8 already defines it as `export const NODE_KIND_COLOR` — no change needed there, just confirming the import above resolves).

- [ ] **Step 3: Wire both into the page layout**

```tsx
// src/pages/LiveSystemGraph.tsx
import { EventLogPanel } from '@/components/systemGraph/EventLogPanel';
import { LegendPanel } from '@/components/systemGraph/LegendPanel';
// ...
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <GraphView
            ref={graphRef}
            selections={selections}
            actives={activeEdgeIds}
            nodeStatus={nodeStatus}
            onNodeClick={(node) => setDetailsNode(node)}
            onCanvasClick={() => setSelections([])}
          />
          <LegendPanel />
        </div>
        <EventLogPanel />
      </div>
      <NodeDetailsSheet node={detailsNode} open={!!detailsNode} onClose={() => setDetailsNode(null)} />
```

(This replaces the previous single `<div className="flex-1 relative">...</div>` block — the `GraphView`/`LegendPanel` pair now nests one level deeper inside a new flex row that also holds `EventLogPanel`.)

- [ ] **Step 4: Verify build and manually check**

Run: `npx tsc --noEmit && npm run build`

Open `/grafo-sistema`: legend visible bottom-left with 6 colored kinds; event log panel on the right fills up as simulated events arrive, newest on top, relative timestamps in Portuguese.

- [ ] **Step 5: Commit**

```bash
git add src/components/systemGraph/EventLogPanel.tsx src/components/systemGraph/LegendPanel.tsx src/pages/LiveSystemGraph.tsx
git commit -m "feat(system-graph): add event log panel and kind legend"
```

---

## Task 13: Two-node path selection and highlight

**Files:**
- Create: `src/components/systemGraph/GraphToolbar.tsx`
- Modify: `src/pages/LiveSystemGraph.tsx`

**Interfaces:**
- Consumes: `useSelection` from `reagraph` (confirmed real export in `node_modules/reagraph/dist/selection/useSelection.d.ts`, specifically its `selectNodePaths(source, target)` method — no need for a separate `graphology-shortest-path` call, reagraph does this internally).

- [ ] **Step 1: Write GraphToolbar (path-selection UX)**

```tsx
// src/components/systemGraph/GraphToolbar.tsx
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface GraphToolbarProps {
  pathSource: string | null;
  pathTarget: string | null;
  onClear: () => void;
}

export function GraphToolbar({ pathSource, pathTarget, onClear }: GraphToolbarProps) {
  if (!pathSource) return null;

  return (
    <div className="absolute top-4 left-4 bg-background/90 backdrop-blur border border-border/40 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
      <span>
        {pathTarget
          ? `Caminho: ${pathSource} → ${pathTarget}`
          : `Origem selecionada: ${pathSource}. Clique em outro nó para destacar o caminho.`}
      </span>
      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClear}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire `useSelection` and two-click path picking into the page**

`useSelection` requires a `RefObject<GraphCanvasRef | null>` (confirmed signature in `useSelection.d.ts`) — reuse the same `graphRef` already passed to `GraphView`.

```tsx
// src/pages/LiveSystemGraph.tsx
import { useSelection } from 'reagraph';
import { ARCH_NODES, ARCH_EDGES } from '@/lib/systemGraph/architecture';
import { GraphToolbar } from '@/components/systemGraph/GraphToolbar';
// ...
export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const nodeStatus = useSystemGraphStore(s => s.nodeStatus);
  const activeEdgeIds = useSystemGraphStore(s => s.activeEdgeIds);
  const [detailsNode, setDetailsNode] = useState<ArchNode | null>(null);
  const [pathSource, setPathSource] = useState<string | null>(null);

  const { selections, actives: pathActives, selectNodePaths, clearSelections } = useSelection({
    ref: graphRef,
    nodes: ARCH_NODES,
    edges: ARCH_EDGES,
    pathSelectionType: 'all',
  });

  const handleNodeClick = (node: ArchNode) => {
    if (!pathSource) {
      setPathSource(node.id);
      return;
    }
    if (node.id === pathSource) {
      setPathSource(null);
      clearSelections();
      return;
    }
    selectNodePaths(pathSource, node.id);
    setDetailsNode(node);
  };

  const clearPath = () => {
    setPathSource(null);
    clearSelections();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <GraphView
            ref={graphRef}
            selections={selections}
            actives={[...activeEdgeIds, ...pathActives]}
            nodeStatus={nodeStatus}
            onNodeClick={handleNodeClick}
            onCanvasClick={clearPath}
          />
          <LegendPanel />
          <GraphToolbar pathSource={pathSource} pathTarget={selections[selections.length - 1] ?? null} onClear={clearPath} />
        </div>
        <EventLogPanel />
      </div>
      <NodeDetailsSheet node={detailsNode} open={!!detailsNode} onClose={() => setDetailsNode(null)} />
    </div>
  );
}
```

Note: clicking a node now both picks it for path-selection AND opens its details sheet (`setDetailsNode(node)` on the second click) — this matches requirement #5 (click opens info) without a separate interaction mode the user has to switch between.

- [ ] **Step 3: Verify build and manually check**

Run: `npx tsc --noEmit && npm run build`

Open `/grafo-sistema`: click node A (toolbar shows "Origem selecionada"), click node B (toolbar shows the path, the path's nodes/edges highlight via `selections`/`actives`, and B's details sheet opens). Click the canvas background or the toolbar's X to clear.

- [ ] **Step 4: Commit**

```bash
git add src/components/systemGraph/GraphToolbar.tsx src/pages/LiveSystemGraph.tsx
git commit -m "feat(system-graph): add two-node path selection via reagraph's selectNodePaths"
```

---

## Task 14: Edge particle animation (custom R3F, same canvas)

**Files:**
- Create: `src/components/systemGraph/EdgeParticles.tsx`
- Modify: `src/components/systemGraph/GraphView.tsx`

**Interfaces:**
- Consumes: `useFrame` (`@react-three/fiber`, already a resolved transitive dependency of `reagraph@4.22.0` — confirmed present at `node_modules/@react-three/fiber` after Task 1's install), `GraphCanvasRef.getGraph()` (returns the underlying `graphology` `Graph` instance, confirmed in `GraphCanvas.d.ts`), `activeEdgeIds` (Task 3's store).

**Important per Global Constraints:** this renders as `children` of the existing `GraphCanvas` (confirmed supported prop), never a second `<Canvas>`.

- [ ] **Step 1: Write EdgeParticles**

Reads live node positions from the graphology graph reagraph itself maintains (`ref.getGraph()`), interpolates a point along each active edge every frame, and renders one small sphere per active edge — bounded by `activeEdgeIds.length` (a handful at a time from the simulated generator), never unbounded.

```tsx
// src/components/systemGraph/EdgeParticles.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { GraphCanvasRef } from 'reagraph';
import type { Mesh } from 'three';
import { ARCH_EDGES } from '@/lib/systemGraph/architecture';

interface EdgeParticlesProps {
  graphRef: React.RefObject<GraphCanvasRef | null>;
  activeEdgeIds: string[];
}

const EDGE_BY_ID = new Map(ARCH_EDGES.map(e => [e.id, e]));
const CYCLE_SECONDS = 1.2;

function Particle({ graphRef, edgeId }: { graphRef: React.RefObject<GraphCanvasRef | null>; edgeId: string }) {
  const meshRef = useRef<Mesh>(null);
  const edge = EDGE_BY_ID.get(edgeId);

  useFrame(({ clock }) => {
    if (!meshRef.current || !edge) return;
    const graph = graphRef.current?.getGraph();
    if (!graph || !graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;

    const from = graph.getNodeAttributes(edge.source);
    const to = graph.getNodeAttributes(edge.target);
    // reagraph's internal layout stores position as x/y/z node attributes
    // (InternalGraphPosition, confirmed in dist/types.d.ts) — verify these
    // three keys exist via a console.log(from) here during manual testing;
    // if reagraph nests them differently, adjust the four lines below to match.
    const t = (clock.getElapsedTime() % CYCLE_SECONDS) / CYCLE_SECONDS;
    meshRef.current.position.set(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
      from.z + (to.z - from.z) * t
    );
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.2, 8, 8]} />
      <meshBasicMaterial color="#fbbf24" />
    </mesh>
  );
}

export function EdgeParticles({ graphRef, activeEdgeIds }: EdgeParticlesProps) {
  return (
    <>
      {activeEdgeIds.map(edgeId => (
        <Particle key={edgeId} graphRef={graphRef} edgeId={edgeId} />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Render it inside `GraphCanvas` as children**

In `src/components/systemGraph/GraphView.tsx`, add `EdgeParticles` as a child of `GraphCanvas` (confirmed `children?: ReactNode` is a real, supported prop — this is the mechanism that avoids a second canvas):

```tsx
import { EdgeParticles } from './EdgeParticles';
// ...
    return (
      <GraphCanvas
        ref={ref}
        nodes={reaNodes}
        edges={reaEdges}
        layoutType="forceDirected3d"
        cameraMode="orbit"
        selections={selections}
        actives={actives}
        onNodeClick={(node) => onNodeClick?.(node.data as ArchNode)}
        onCanvasClick={() => onCanvasClick?.()}
      >
        <EdgeParticles graphRef={ref as React.RefObject<GraphCanvasRef | null>} activeEdgeIds={activeEdgeIds} />
      </GraphCanvas>
    );
```

This requires `GraphView` to receive its own `activeEdgeIds` prop distinct from the `actives` prop (which mixes in path-highlight actives from Task 13 — particles should only travel on edges that are *live-processing*, not on a highlighted-but-idle path edge). Add `activeEdgeIds: string[]` to `GraphViewProps` and pass it separately from `actives` at the call site in `LiveSystemGraph.tsx`:

```tsx
// GraphView call site in src/pages/LiveSystemGraph.tsx
          <GraphView
            ref={graphRef}
            selections={selections}
            actives={[...activeEdgeIds, ...pathActives]}
            activeEdgeIds={activeEdgeIds}
            nodeStatus={nodeStatus}
            onNodeClick={handleNodeClick}
            onCanvasClick={clearPath}
          />
```

- [ ] **Step 3: Verify build and manually check**

Run: `npx tsc --noEmit && npm run build`

Open `/grafo-sistema` and watch for ~15 seconds: small amber spheres should travel along whichever edges are currently `processing` (per the Go simulator), cycling every ~1.2s. If particles don't move or appear at the origin, `console.log(graph.getNodeAttributes(edge.source))` inside `useFrame` to find the real position attribute keys reagraph uses at runtime, and adjust — **do not silently comment out or fake this**; if the attribute keys differ from `x`/`y`/`z`, that's a divergence from what the `.d.ts` implied and should be reported the same way the React 19 and AI-node divergences were reported earlier in this session.

- [ ] **Step 4: Commit**

```bash
git add src/components/systemGraph/EdgeParticles.tsx src/components/systemGraph/GraphView.tsx src/pages/LiveSystemGraph.tsx
git commit -m "feat(system-graph): animate particles along active edges inside the existing canvas"
```

---

## Task 15: Final validation pass

**Files:** none created — verification only.

- [ ] **Step 1: Full frontend validation**

Run:
```bash
npx tsc --noEmit
npm run build
npm test
```
Expected: all three succeed, zero errors.

- [ ] **Step 2: Full backend validation**

Run:
```bash
go build ./...
go vet ./...
go test ./... -v
```
Expected: all succeed, including the pre-existing `TestRotasComAutenticacaoPropriaNaoExigemEscopo` and `TestRotasDeUsuarioExigemEscopo` in `handler/tenant_middleware_test.go`.

- [ ] **Step 3: Add `/api/ws/system-graph` to the existing route-classification test**

`handler/tenant_middleware_test.go`'s `TestRotasComAutenticacaoPropriaNaoExigemEscopo` documents every route that intentionally sits outside `RequireCompanyScope`. Add this route there so a future refactor that accidentally moves it into the scoped group breaks a test immediately, the same safety net that already exists for `/api/ws/terminal`.

Read `handler/tenant_middleware_test.go`'s `casos` table in that test function first — `/api/ws/terminal` and `/api/ws/terminal/agent` are not currently in that specific table (they're covered by being absent from `TestRotasDeUsuarioExigemEscopo`'s list instead, since they use their own auth, not literally "no auth"). Confirm which of the two test tables is the right fit for `/api/ws/system-graph` by re-reading both test functions' doc comments before adding — do not guess; this file's own comments (lines ~98-104 and ~159-165, per the version read earlier this session) explain the distinction precisely.

- [ ] **Step 4: Manual end-to-end walkthrough**

With the Go backend and Vite dev server both running:
1. Log in as a `technician` (or `admin`/`developer`) user.
2. Navigate via the sidebar to "Live System Graph".
3. Confirm connection status reaches "ao vivo" within a few seconds.
4. Confirm nodes cycle through processing (amber) → success (green) / occasional error (red) as simulated events arrive.
5. Confirm amber particles travel along currently-active edges.
6. Click a node — details sheet opens with description, source ref, connections, recent events.
7. Click a second node — path between them highlights; toolbar shows the pair; click the toolbar's X or empty canvas to clear.
8. Confirm the event log panel fills with entries, newest on top, capped visually at a reasonable count.
9. Log in as a `customer`-role user (or use `?testRole=customer` in dev, per `useUserRole.ts`'s existing test-role mechanism) — confirm "Live System Graph" is absent from the sidebar and `/grafo-sistema` is unreachable (same `AppRoute allowedRoles` gate as `/sistemas`).
10. Spot-check 3-4 other existing pages (`/`, `/monitoramento`, `/admin`) still work exactly as before — this feature must be 100% additive.

- [ ] **Step 5: Final commit**

```bash
git add handler/tenant_middleware_test.go
git commit -m "test(system-graph): classify /api/ws/system-graph in the route-scope safety net"
```

---

## Summary of what's deliberately deferred (per the design spec's "Trabalho futuro")

Not part of this plan, by design:
- Real instrumentation of Go handlers/Edge Functions to emit real `SystemEvent`s (the Go simulator in Task 4 stays until that's a separate, later project).
- Generating/syncing the catalog from `graphify-out/graph.json`.
- Upgrading the app to React 19 to track newer `reagraph` releases.
