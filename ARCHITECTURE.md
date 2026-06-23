# Orion System — Arquitetura do Sistema

> Documento técnico descrevendo a arquitetura, fluxos de dados e decisões de design.

---

## Diagrama de Arquitetura

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              CLIENTES                                     │
│                                                                           │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────┐ │
│   │  Navegador   │   │  Navegador   │   │      Orion Agent (Go)        │ │
│   │  (Técnico)   │   │  (Cliente)   │   │    (Windows Service/Tray)    │ │
│   └──────┬───────┘   └──────┬───────┘   └──────────────┬───────────────┘ │
│          │                  │                           │                  │
└──────────┼──────────────────┼───────────────────────────┼──────────────────┘
           │ HTTPS            │ HTTPS                     │ HTTPS
           │                  │                           │
┌──────────▼──────────────────▼───────────────────────────▼──────────────────┐
│                          VERCEL EDGE NETWORK                               │
│                                                                            │
│   ┌─────────────────────────┐    ┌─────────────────────────────────────┐  │
│   │     Frontend (SPA)      │    │     Go Serverless Functions         │  │
│   │                         │    │                                     │  │
│   │  React + Vite + TS      │    │  router.go ─────→ chi router       │  │
│   │  Tailwind + shadcn/ui   │    │  ├── auth_handlers.go              │  │
│   │  React Query            │    │  ├── fn_handlers.go                │  │
│   │                         │    │  └── mon_handlers.go               │  │
│   │  Supabase JS Client     │    │                                     │  │
│   │  (Direct DB access via  │    │  lib/                               │  │
│   │   RLS policies)         │    │  ├── db.go (pgx → PostgreSQL)      │  │
│   │                         │    │  ├── supabase.go (auth validation) │  │
│   │  /index.html → SPA      │    │  ├── monitoring.go (queries)       │  │
│   │  fallback routing       │    │  └── email.go (Resend)             │  │
│   └─────────┬───────────────┘    └──────────┬──────────────────────────┘  │
│             │                               │                             │
│             │ Supabase JS                   │ pgx (direct SQL)            │
│             │ (RLS-protected)               │ (service key / bypass RLS)  │
└─────────────┼───────────────────────────────┼─────────────────────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (BaaS)                                  │
│                                                                          │
│   ┌──────────────────┐   ┌──────────────────┐   ┌────────────────────┐  │
│   │  PostgreSQL 15   │   │  Supabase Auth   │   │  Realtime          │  │
│   │                  │   │  (GoTrue)        │   │  (WebSockets)      │  │
│   │  • 24 tabelas    │   │                  │   │                    │  │
│   │  • 78 migrações  │   │  • JWT tokens    │   │  • ticket updates  │  │
│   │  • RLS policies  │   │  • Magic links   │   │  • notifications   │  │
│   │  • Triggers      │   │  • Password auth │   │  • machine status  │  │
│   │  • Functions     │   │                  │   │                    │  │
│   └──────────────────┘   └──────────────────┘   └────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Padrão de Comunicação

O sistema usa **dois caminhos de dados distintos**:

### Caminho 1: Frontend → Supabase (Direto)
```
React Component
  └→ Custom Hook (useTickets, useMyTickets, etc.)
       └→ supabaseRead.from('table').select(...)    ← Leitura (RLS)
       └→ supabase.from('table').insert(...)         ← Escrita (RLS)
```

**Quando usar:** Operações CRUD padrão em tabelas protegidas por RLS (tickets, comments, profiles, etc.)

### Caminho 2: Frontend → Go API → PostgreSQL
```
React Component
  └→ fetch('/api/monitoring/...')
       └→ Go Handler (chi router)
            └→ lib.DB.Query(...)    ← pgx + connection string
```

**Quando usar:** Operações que precisam de:
- Bypass de RLS (service key)
- Lógica server-side complexa
- Autenticação do Agent (X-Agent-Key header)
- Cron jobs

---

## Stack de Cada Camada

### Frontend

```
                  React 18
                     │
         ┌───────────┼───────────┐
         │           │           │
    React Router   React      shadcn/ui
    (pages)        Query       (Radix)
                   (state)        │
                     │        Tailwind CSS
              Supabase JS        │
              (data access)   Recharts
```

**Padrão de componentes:**
- **Pages** (`src/pages/`) — Componentes de rota, lazy-loaded
- **Hooks** (`src/hooks/`) — Encapsulam React Query (fetch + cache + refetch)
- **Components** — Composição modular (dashboard, ticket, admin, monitoring)
- **UI** (`src/components/ui/`) — Primitivos shadcn/ui (botões, dialogs, tables)

### Backend (Go API)

```
Vercel Serverless
       │
  handler.Handler()        ← Entry point único
       │
  chi.Router               ← Roteamento HTTP
       │
  ┌────┼────┐
  │    │    │
auth  fn   mon             ← Handler files por domínio
  │    │    │
  └────┼────┘
       │
  lib package
  ├── DB (pgx)             ← PostgreSQL direto
  ├── SupabaseClient        ← Auth validation
  ├── ResendClient          ← Email
  └── Config                ← Environment vars
```

**Padrão singleton (warm-start):**
```go
var once sync.Once
func init() {
    once.Do(func() {
        cfg = lib.LoadConfig()
        db  = lib.NewDB(cfg.DatabaseURL)
        sb  = lib.NewSupabaseClient(...)
    })
}
```
Conexões são inicializadas **uma vez** e reutilizadas entre invocações (Vercel warm starts).

### Agent (Go — Windows)

```
main.go
  │
  ├── service.Svc.run()     ← Loop principal
  │     │
  │     ├── collector.Collect()   ← CPU, RAM, Disco, IP, Hostname
  │     ├── sender.Send()         ← POST /api/monitoring/machines/heartbeat
  │     └── sender.PollCommands() ← GET /api/monitoring/commands/poll
  │
  ├── tray.TrayManager      ← System tray (relógio)
  │     ├── Abrir Portal
  │     ├── Abrir Chamado
  │     └── Sair
  │
  └── token.LoadToken()      ← Identidade persistente (machine_token.dat)
```

---

## Fluxos Principais

### Fluxo 1: Criação de Ticket (com Automação)

```
Usuário clica "Novo Ticket"
       │
       ▼
Frontend: POST ticket → Supabase (RLS)
       │
       ▼
PostgreSQL: INSERT INTO tickets
       │
       ├── BEFORE INSERT: fn_auto_route_ticket()
       │     ├── Busca routing_rules (company_id, is_active)
       │     ├── Avalia condição (category/priority/is_vip/title)
       │     ├── Aplica ação (assign_tech / set_priority / round_robin)
       │     └── INSERT INTO automation_logs
       │
       └── AFTER INSERT: fn_auto_response_ticket()
             ├── Busca regras tipo 'auto_response'
             ├── Busca conteúdo da canned_response
             └── INSERT INTO ticket_updates (resposta automática)
```

### Fluxo 2: Heartbeat do Agente

```
Orion Agent (Windows)
       │
       ├── collector.Collect() → {hostname, ip, cpu, ram, disk, ...}
       │
       ├── token.LoadToken() → machine_token (ou gera novo)
       │
       └── sender.Send() → POST /api/monitoring/machines/heartbeat
              │              Headers: X-Agent-Key, Content-Type
              │
              ▼
       Go Handler: monitoringHeartbeat()
              │
              ├── Valida X-Agent-Key
              ├── UPSERT machine (by machine_token)
              ├── INSERT machine_metrics
              ├── Verifica thresholds → INSERT machine_alerts
              └── Retorna {machine_id}
```

### Fluxo 3: Comando Remoto (RMM)

```
Técnico no Painel                         Agente na Máquina
       │                                          │
       ▼                                          │
POST /api/.../commands                             │
 body: {command: "ipconfig"}                       │
       │                                          │
       ▼                                          │
INSERT INTO machine_commands                       │
 status: 'pending'                                 │
       │                                          │
       │                    ┌──────────────────────┘
       │                    │ Poll (30s interval)
       │                    ▼
       │            GET /api/monitoring/commands/poll
       │                    │
       │                    ▼
       │            cmd.exe /C "ipconfig"
       │                    │
       │                    ▼
       │            POST /api/monitoring/commands/respond
       │             body: {output: "...", status: "completed"}
       │                    │
       ▼                    ▼
UPDATE machine_commands
 status: 'completed', output: '...'
       │
       ▼
Técnico vê resultado no painel
```

---

## Segurança

| Camada | Mecanismo |
|---|---|
| **RLS (Row Level Security)** | Todas as tabelas Supabase possuem políticas RLS. Usuários só veem dados da sua empresa. |
| **JWT Auth** | Supabase Auth gera JWTs validados no frontend e no Go backend. |
| **Agent Key** | Header `X-Agent-Key` autentica o agente (shared secret). |
| **Machine Token** | Cada máquina gera um UUID único na primeira conexão. Impede impersonação. |
| **CORS** | Go middleware valida Origin e permite apenas o domínio configurado. |
| **CRON_SECRET** | Protege endpoints de cron jobs contra acesso externo. |
| **RLS + Service Key** | Go API usa service key para operações admin (bypass RLS). |

---

## Decisões de Arquitetura

### 1. Frontend direto no Supabase (read-client)
**Decisão:** O frontend acessa o Supabase diretamente para leituras.
**Motivo:** Elimina latência do Go serverless para operações simples. RLS garante segurança.

### 2. Go Serverless (não Edge Functions)
**Decisão:** Usar Go serverless no Vercel em vez de Supabase Edge Functions (Deno).
**Motivo:** Melhor controle, acesso a pgx nativo, e deploy unificado no Vercel.

### 3. Agent como Serviço Windows
**Decisão:** Agente Go compilado como `.exe` que roda como serviço.
**Motivo:** Execução em background sem depender de sessão do usuário. Compatível com GPO para deploy em massa.

### 4. Singleton com sync.Once
**Decisão:** Conexões DB/Supabase inicializadas uma vez via `sync.Once`.
**Motivo:** Vercel reutiliza instâncias (warm start). Evita abrir conexão a cada request.

### 5. Dual-trigger para automação
**Decisão:** Duas triggers separadas (BEFORE e AFTER INSERT).
**Motivo:** BEFORE altera `NEW.*` (prioridade, assigned_to). AFTER insere em `ticket_updates` (precisa do ticket ID confirmado).

### 6. Campos Customizados via JSONB (Future-Proofing)
**Decisão:** Adicionada coluna `metadata` (JSONB) indexada (GIN) na tabela `tickets`.
**Motivo:** Permite que APIs e integrações salvem campos customizados específicos por empresa (ex: MAC Address, Código de Patrimônio) sem exigir a construção imediata de uma UI complexa de gerenciamento dinâmico. Isso garante a flexibilidade para integrações avançadas no MVP sem acréscimo de dívida técnica ou esforço de frontend.

---

## Decisões de Produto — Log

### Campos Customizados por Empresa — REJEITADO (MVP)
**Data:** 23/06/2026
**Decisão:** Não implementar engine de formulários dinâmicos no MVP.
**Mitigação:** Coluna `metadata` JSONB adicionada na tabela `tickets` para suportar uso futuro via API sem necessidade de migration.
**Alternativa adotada:** Templates de Descrição pré-preenchidos por categoria.
**Revisar quando:** A base de clientes ativos crescer significativamente ou um cliente específico exigir como condição de fechamento de contrato.

---

## Escalabilidade

| Componente | Observações |
|---|---|
| **Frontend** | SPA estática — escala infinitamente via CDN |
| **Go API** | Serverless — escala automaticamente por request |
| **PostgreSQL** | Supabase managed — upgrade de plan conforme necessário |
| **Agent** | Independente por máquina — sem gargalo central |
| **Cron** | Vercel cron — 1x/dia para mark-offline (baixo custo) |
