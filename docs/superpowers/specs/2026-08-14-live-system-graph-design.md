# Live System Graph — Design Spec

**Data:** 2026-08-14
**Status:** Aprovado para planejamento de implementação

## Contexto

O Orion System não tem hoje nenhuma visualização da própria arquitetura. Times novos e o próprio time atual não têm um mapa vivo de como frontend, backend Go, Edge Functions, Postgres, o agente RMM e os serviços externos se conectam e trocam execução.

## Objetivo

Criar uma página `Live System Graph` com um grafo 3D interativo que representa a arquitetura **real** do Orion System (módulos, serviços, banco, APIs, IA) como nós, e as dependências/comunicação entre eles como edges. O grafo deve reagir a eventos em tempo real vindos de um WebSocket, animando o fluxo de execução entre os nós.

## Não-objetivos (fora de escopo nesta iteração)

- Instrumentar os handlers Go / Edge Functions reais para emitir eventos de execução verdadeiros. Nesta iteração o servidor emite eventos **simulados**, mas plausíveis e no mesmo formato que a instrumentação real usaria depois.
- Qualquer alteração de comportamento em páginas, rotas ou APIs existentes. Esta feature é 100% aditiva.
- Descoberta automática de arquitetura (ex.: gerar o grafo a partir de `graphify-out/graph.json`). O catálogo de nós é curado manualmente nesta iteração — ver "Trabalho futuro".
- Representar toda a granularidade de arquivos/símbolos do projeto. O grafo é em nível de módulo/serviço (~35-45 nós), não de arquivo.

## Arquitetura

### Abordagens consideradas

1. **Reagraph como base + camada de eventos fina (escolhida).** `GraphCanvas` do reagraph cuida de layout força-dirigido 3D, câmera (pan/zoom/rotate), seleção e path-finding. Customização de nós/edges via `renderNode` e as props `selections`/`actives` do próprio reagraph. React Three Fiber "puro" só entraria para um elemento muito específico que o `renderNode` não cubra — não para uma cena paralela.
2. **React Three Fiber puro, sem reagraph.** Reimplementar câmera, seleção, layout de força e path-finding na mão. Descartada: mais esforço, mais risco, e contradiz a diretriz original do pedido ("Reagraph como base do grafo").

### Visão geral do fluxo de dados

```
Go backend (novo hub WS /api/ws/system-graph)
        │  gera eventos simulados server-side (formato = contrato final)
        ▼  WebSocket
useSystemGraphSocket() (frontend)
        │  atualiza
        ▼
Zustand store (status por nó, edges ativas, log de eventos)
        │  consumido por
        ▼
GraphCanvas (reagraph) — recolore nós, anima partícula na edge ativa
```

O catálogo de nós/edges (estrutura estática da arquitetura) é dado local versionado, independente do WebSocket. O WebSocket só carrega **eventos de execução** que colorem/animam esse mapa já existente — nunca a estrutura em si.

## Modelo de dados

### Catálogo de arquitetura (estático, curado)

Arquivo `src/lib/systemGraph/architecture.ts`:

```ts
type NodeKind = 'frontend' | 'backend' | 'database' | 'service' | 'api' | 'ai';

interface ArchNode {
  id: string;
  label: string;
  kind: NodeKind;
  description: string;
  sourceRef?: string; // ex: "handler/mon_handlers.go" — rastreabilidade pro código real
}

interface ArchEdge {
  id: string;
  source: string;
  target: string;
  kind: 'http' | 'db' | 'websocket' | 'realtime' | 'invoke';
}
```

Catálogo inicial (~35-45 nós), todos mapeados a artefatos reais do repositório:

- **Frontend**: páginas principais (Index/Tickets, Monitoring, InfrastructureDashboard, Admin, KnowledgeBase, Assets, ClientPortal) e o cliente Supabase.
- **Backend (Go)**: um nó por arquivo em `handler/*.go` (auth, tickets, monitoring, network links, uptime, ws_terminal) e os módulos centrais de `lib/*.go` (db, monitoring, network_links, supabase, email, ratelimit).
- **Database**: Postgres/Supabase, com sub-nós por domínio relevante (tickets, monitoring/machines, profiles/auth) já que é o hub central de dados.
- **Service**: Edge Functions Deno (admin-update-user, create-user-credentials, delete-user-admin, invite-user-resend, email-to-ticket, whatsapp-webhook, check-rate-limit, reset-password-with-token, send-password-changed-alert), o agente RMM (orion-agent), e serviços externos (Resend).
- **API**: agrupamentos de rota (ex.: `/api/monitoring/*`, `/api/functions/*`, `/api/tickets/*`) como nós intermediários entre frontend e handlers, refletindo `handler/router.go`.
- **AI**: Ticket Copilot (`useTicketCopilot.ts`) e sugestões de KB via RAG/pgvector (migração `phase2_pgvector_rag`).

Edges seguem as dependências reais já mapeadas durante a exploração (ex.: frontend → API → handler → lib → Postgres; handler/ws_terminal.go → orion-agent via WebSocket; email-to-ticket → Postgres).

### Contrato de evento (WebSocket)

```ts
interface SystemEvent {
  id: string;            // uuid do evento
  timestamp: string;     // ISO 8601
  edge_id: string;       // qual edge do catálogo o evento percorre
  status: 'processing' | 'success' | 'error';
}
```

Este é o contrato final — tanto o gerador simulado quanto uma futura instrumentação real emitem exatamente este formato. Trocar mock por real é uma mudança isolada no backend (quem popula o evento), sem tocar no frontend.

## Frontend

- Rota `/grafo-sistema`, lazy-loaded, registrada em `App.tsx` via `AppRoute allowedRoles={['admin','developer','technician']}` — mesmo padrão de `/sistemas`.
- Arquivos: `src/pages/LiveSystemGraph.tsx` + `src/components/systemGraph/{GraphView,NodeDetailsPanel,EventLogPanel,LegendPanel}.tsx`.
- `layoutType="forceDirected3d"`; `cameraMode` configurado para permitir pan/zoom/rotação livre pelo usuário (valor exato da prop a confirmar na API do reagraph durante a implementação — a doc oficial confirma pan e um modo de órbita entre as opções, mas não fechei o literal exato).
- Cada `NodeKind` tem ícone (lucide-react, consistente com o resto do app) e cor via `renderNode` customizado.
- Estados visuais por nó: `idle` (cor neutra), `processing` (pulso), `success` (verde, decai para idle após alguns segundos), `error` (vermelho, permanece até novo evento).
- Clique em nó → abre `Sheet` (mesmo componente usado no `MachineDrawer`) com descrição, `sourceRef`, edges conectadas e últimos eventos daquele nó.
- Destacar caminho entre dois nós: seleciona nó A e nó B; `graphology-shortest-path` (já é dependência transitiva do reagraph) calcula o caminho; destaque visual via `selections`/`actives` do reagraph.
- Painel lateral de eventos (`EventLogPanel`, shadcn `ScrollArea`): últimos ~50 eventos recebidos, mais recente primeiro, ícone de status + timestamp relativo.
- Estado global do grafo (status por nó, edges ativas, buffer de eventos) em um store Zustand dedicado (`useSystemGraphStore`), separado de qualquer estado de outras páginas.

## Backend

- Novo endpoint `GET /api/ws/system-graph` em `handler/`, reaproveitando o padrão de hub de `handler/ws_terminal.go` (upgrade da conexão, registrar/desregistrar clientes, broadcast, `CheckOrigin` restrito à allowlist de CORS).
- Autenticação: **não** é o middleware REST padrão (`RequireCompanyScope`) — WebSocket não permite header `Authorization` no handshake do navegador. Segue o mesmo mecanismo já usado por `/api/ws/terminal`: o token do Supabase Auth viaja no header `Sec-WebSocket-Protocol` (subprotocolo sentinela `orion-bearer` + token como segundo item), nunca em query string (evita vazar em logs de acesso/proxy). Validado via `sb.GetUserByAccessToken`, com checagem de papel (`admin`/`developer`/`technician`) equivalente ao `allowedRoles` da rota do frontend.
- Gerador de eventos simulados: roda no hub, escolhe uma `edge_id` real do catálogo (import do mesmo catálogo, espelhado em Go ou servido como JSON estático) e emite `SystemEvent`s em intervalos pseudo-aleatórios plausíveis.
- Ponto de troca futuro: substituir o gerador simulado por chamadas reais de instrumentação nos handlers — sem qualquer mudança no frontend, já que o contrato de evento não muda.

## Performance

- Catálogo fixo em ~35-45 nós — nunca milhares de elementos React. O único elemento de alta frequência (posição da partícula viajando pela edge) é gerenciado dentro do canvas WebGL do reagraph, não como elementos DOM/React individuais.
- Buffer do painel de eventos limitado a ~50 itens (descarta os mais antigos).

## Testes

- Unitário: parser/validação de `SystemEvent`, cálculo de caminho mais curto entre dois nós do catálogo.
- Go: teste do hub WS (registrar/desregistrar conexões, broadcast) seguindo o padrão já usado para `ws_terminal.go`.
- Verificação manual: página abre, grafo renderiza, eventos simulados chegam e animam, nenhuma rota/página existente muda de comportamento.

## Trabalho futuro (fora de escopo agora)

- Instrumentar handlers/Edge Functions reais para emitir `SystemEvent`s verdadeiros, substituindo o gerador simulado.
- Avaliar gerar/atualizar o catálogo de nós a partir do `graphify-out/graph.json` (agregação de arquivo/símbolo → módulo), como camada opcional de sincronização futura.
- Possível refinamento de granularidade dos nós conforme uso real da ferramenta.
