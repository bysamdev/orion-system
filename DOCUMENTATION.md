# Orion System — Documentação Técnica

> Sistema de gerenciamento de TI, suporte técnico e monitoramento de máquinas.
> Desenvolvido por **BySam** — versão atual: `v2.0`

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Tecnologias Utilizadas](#tecnologias-utilizadas)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Módulos do Sistema](#módulos-do-sistema)
5. [API Endpoints](#api-endpoints)
6. [Banco de Dados](#banco-de-dados)
7. [Orion Agent](#orion-agent)
8. [Deploy e Infraestrutura](#deploy-e-infraestrutura)
9. [Variáveis de Ambiente](#variáveis-de-ambiente)

---

## Visão Geral

O Orion System é uma plataforma de **Help Desk + Monitoramento** projetada para empresas de TI. Combina:

- **System de Tickets** completo (abertura, atribuição, SLA, avaliação)
- **Monitoramento de máquinas** em tempo real via agente Windows
- **Motor de Automação** com regras SE→ENTÃO (roteamento, priorização, respostas automáticas)
- **CMDB (Ativos)** para gestão de hardware e contratos
- **Base de Conhecimento** interna (Wiki)
- **Portal do Cliente** simplificado para abertura de chamados
- **Dashboard de Alertas** para máquinas em estado crítico

---

## Tecnologias Utilizadas

| Camada | Tecnologia | Versão |
|---|---|---|
| **Frontend** | React + TypeScript | 18.3 / 5.8 |
| **Build** | Vite (SWC) | 5.4 |
| **UI** | Tailwind CSS + shadcn/ui + Radix UI | 3.4 |
| **State** | TanStack React Query | 5.83 |
| **Charts** | Recharts | 2.15 |
| **Routing** | React Router DOM | 6.30 |
| **Backend (API)** | Go (Serverless) | 1.21+ |
| **Router** | go-chi/chi | v5 |
| **Banco de Dados** | PostgreSQL (Supabase) | 15+ |
| **Autenticação** | Supabase Auth (GoTrue) | v2 |
| **Email** | Resend API | — |
| **Deploy** | Vercel (Edge + Serverless) | — |
| **Agent** | Go nativo (Windows Service) | 1.21+ |

---

## Estrutura do Projeto

```
orion-system/
├── api/                          # Vercel Go serverless entry point
├── handler/                      # Go HTTP handlers (API)
│   ├── router.go                 # Chi router + CORS + init
│   ├── auth_handlers.go          # Login, machine-login, tokens
│   ├── fn_handlers.go            # Admin, user CRUD, rate limit
│   └── mon_handlers.go           # Monitoramento (heartbeat, commands, alerts)
├── lib/                          # Go libraries compartilhadas
│   ├── config.go                 # Env vars → struct
│   ├── db.go                     # PostgreSQL queries (pgx)
│   ├── monitoring.go             # Queries de monitoramento
│   ├── supabase.go               # Supabase Auth client
│   ├── email.go                  # Resend email client
│   └── helpers.go                # JSON writer, auth validation
├── src/                          # Frontend React
│   ├── pages/                    # 20 páginas do sistema
│   ├── hooks/                    # 19 custom hooks (React Query)
│   ├── components/
│   │   ├── dashboard/            # 19 componentes de dashboard
│   │   ├── admin/                # Admin panels (routing rules, etc)
│   │   ├── ticket/               # Attachments, canned responses
│   │   ├── monitoring/           # Machine cards, dialogs
│   │   ├── settings/             # Profile, security settings
│   │   ├── shared/               # Componentes reutilizáveis
│   │   └── ui/                   # shadcn/ui components
│   ├── contexts/                 # AuthContext
│   └── integrations/supabase/    # Supabase client + types
├── orion-agent/                  # Agente de monitoramento (Go)
│   ├── main.go                   # Entry point + tray
│   ├── service/windows.go        # Serviço Windows + loop principal
│   ├── collector/hardware.go     # Coleta de CPU/RAM/Disco
│   ├── sender/api.go             # HTTP client → backend
│   ├── config/config.go          # YAML config loader
│   ├── token/                    # Token persistente (identidade)
│   ├── tray/                     # System tray (ícone no relógio)
│   ├── shortcut/                 # Desktop shortcut creator
│   └── deploy/gpo_install.ps1    # Script GPO para deploy em massa
├── supabase/migrations/          # 78 migrações SQL
├── vercel.json                   # Rewrites + Cron jobs
└── package.json                  # Dependências npm
```

---

## Módulos do Sistema

### 1. Dashboard (`/`)
Centro de controle com estatísticas: tickets abertos, em andamento, resolvidos hoje, gráfo de tendência, filtros por período e técnico.

### 2. Tickets (`/novo-ticket`, `/ticket/:id`, `/historico`)
- Abertura de chamados com título, descrição, categoria, prioridade e anexos
- Timeline com comentários, notas internas e status
- Sistema SLA com pausas automáticas
- Avaliação do cliente após resolução (`/avaliacao/:id`)
- Respostas prontas (Canned Responses) integradas no editor

### 3. Monitoramento (`/monitoring`)
- Dashboard com cards de máquinas agrupadas
- Métricas em tempo real: CPU, RAM, Disco, IP, Status online/offline
- Execução de comandos remotos (RMM) via CMD
- Histórico de alertas por máquina

### 4. Alertas (`/alertas`)
- Painel centralizado de alertas críticos
- Categorias: Offline (>10min), Disco (>90%), CPU (>85%), Alertas do Sistema
- Auto-refresh a cada 30 segundos

### 5. Motor de Automação (`/automacoes`)
- Regras SE→ENTÃO executadas automaticamente na criação de tickets
- Condições: categoria, prioridade, assunto (contém), empresa, VIP
- Ações: atribuir técnico, round-robin, escalar gestor, definir prioridade, resposta automática
- Histórico de execuções (log audit)
- Gerenciamento de Templates de Resposta Rápida

### 6. Relatórios (`/relatorios`)
- Relatórios filtráveis por período, empresa e técnico
- Métricas: tempo médio de resolução, tickets por categoria, SLA compliance

### 7. Base de Conhecimento (`/knowledge`)
- Wiki interna com artigos categorizados
- Busca por título e conteúdo

### 8. Ativos / CMDB (`/assets`)
- Inventário de hardware e software
- Vinculação de ativos a empresas e contratos

### 9. Portal do Cliente (`/portal`)
- Interface simplificada para clientes
- Abertura de chamados, histórico, base de conhecimento

### 10. Admin (`/admin`)
- Gerenciamento de usuários, empresas, planos
- Faturamento e configurações globais

---

## API Endpoints

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/auth/machine-login` | Login automático por token de máquina |

### Funções Admin
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/functions/admin-update-user` | Atualizar usuário (admin) |
| `POST` | `/api/functions/delete-user-admin` | Excluir usuário |
| `POST` | `/api/functions/create-user-credentials` | Criar credenciais |
| `POST` | `/api/functions/check-rate-limit` | Rate limiting |
| `POST` | `/api/functions/send-password-changed-alert` | Alerta de senha |
| `POST` | `/api/functions/reset-password-with-token` | Reset de senha |

### Monitoramento
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/monitoring/dashboard` | Resumo geral (total machines, online, etc) |
| `GET` | `/api/monitoring/groups` | Listar grupos de máquinas |
| `GET` | `/api/monitoring/groups/{id}/machines` | Máquinas de um grupo |
| `POST` | `/api/monitoring/machines/heartbeat` | Heartbeat do agente |
| `GET` | `/api/monitoring/machines/{id}` | Detalhes de uma máquina |
| `GET` | `/api/monitoring/machines/{id}/metrics` | Histórico de métricas |
| `GET` | `/api/monitoring/machines/{id}/alerts` | Alertas de uma máquina |
| `POST` | `/api/monitoring/machines/{id}/commands` | Enviar comando remoto |
| `GET` | `/api/monitoring/machines/{id}/commands` | Listar comandos da máquina |
| `GET` | `/api/monitoring/commands/poll` | Agent poll para comandos pendentes |
| `POST` | `/api/monitoring/commands/respond` | Agent responde resultado do comando |
| `GET` | `/api/monitoring/cron/mark-offline` | Cron job: marca máquinas offline |
| `GET` | `/api/monitoring/alerts/critical` | Alertas críticos (para dashboard) |
| `POST` | `/api/monitoring/machines/{id}/update` | Atualizar dados da máquina |
| `POST` | `/api/monitoring/groups` | Criar grupo |
| `POST` | `/api/monitoring/groups/{id}/update` | Atualizar grupo |
| `DELETE` | `/api/monitoring/groups/{id}` | Excluir grupo |

---

## Banco de Dados

O Supabase PostgreSQL contém **78 migrações** que definem:

### Tabelas Principais
| Tabela | Propósito |
|---|---|
| `profiles` | Usuários do sistema |
| `companies` | Empresas clientes (com `is_vip`) |
| `tickets` | Chamados de suporte |
| `ticket_updates` | Timeline de comentários/status |
| `ticket_attachments` | Arquivos anexados |
| `ticket_ratings` | Avaliações de chamados |
| `categories` | Categorias de chamados |
| `canned_responses` | Respostas prontas |
| `routing_rules` | Regras de automação |
| `automation_logs` | Histórico de execuções do motor |
| `machines` | Máquinas monitoradas |
| `machine_metrics` | Histórico de métricas |
| `machine_alerts` | Alertas de máquinas |
| `machine_commands` | Comandos remotos (RMM) |
| `machine_groups` | Agrupamento de máquinas |
| `assets` | CMDB / inventário |
| `contracts` | Contratos de suporte |
| `sla_configs` | Configurações SLA por prioridade |
| `knowledge_base_articles` | Artigos da Wiki |
| `notifications` | Notificações do sistema |
| `user_roles` | Roles (admin, developer, technician, user) |
| `audit_log` | Log de auditoria |

### Triggers Automáticos
- `tr_auto_route_ticket` (BEFORE INSERT) — Aplica regras de roteamento ao criar ticket
- `tr_auto_response_ticket` (AFTER INSERT) — Envia resposta automática se houver regra
- `tr_ticket_sla_deadlines` — Calcula deadlines SLA automaticamente

---

## Orion Agent

O agente é um executável Go para **Windows** que roda como serviço ou em modo interativo (com system tray).

### Instalação
```powershell
# Copiar para o destino
Copy-Item orion-agent.exe "C:\Program Files\OrionAgent\"
Copy-Item agent.yaml "C:\Program Files\OrionAgent\"

# Instalar como serviço Windows
orion-agent.exe install

# Iniciar
sc start OrionAgent
```

### Configuração (`agent.yaml`)
```yaml
api_url: https://orion.seudominio.com
agent_key: SUA_CHAVE_AQUI
interval_seconds: 30
log_file: agent.log
```

### Funcionalidades
| Feature | Descrição |
|---|---|
| **Heartbeat** | Envia CPU, RAM, Disco, IP, Hostname a cada N segundos |
| **Token** | Identidade única auto-gerada na primeira execução |
| **System Tray** | Menu com: Abrir Portal, Abrir Chamado, Sair |
| **Desktop Shortcut** | Cria atalho "Suporte Orion" no Desktop do usuário |
| **RMM** | Executa comandos remotos enviados pelo painel |
| **Serviço Windows** | Roda em background como `OrionAgent` |

### Deploy em Massa (GPO)
Use o script `deploy/gpo_install.ps1` para distribuir via política de grupo:
1. Coloque `orion-agent.exe` + `agent.yaml` em um share de rede
2. Configure o script como Computer Startup Script na GPO
3. Todas as máquinas do domínio instalam automaticamente

---

## Deploy e Infraestrutura

| Componente | Plataforma |
|---|---|
| Frontend (React) | Vercel (SPA) |
| Backend (Go API) | Vercel Serverless Functions |
| Banco de Dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Email | Resend |
| Cron Jobs | Vercel Crons |
| Agent | Instalação local (Windows) |

### Vercel Config (`vercel.json`)
- `/api/*` → Go serverless function (`/api/router`)
- `/*` → SPA fallback (`/index.html`)
- Cron: `/api/monitoring/cron/mark-offline` — executa 1x/dia

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (Supabase) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima (RLS) |
| `SUPABASE_SERVICE_KEY` | Chave admin (bypass RLS) |
| `AGENT_KEY` | Chave de autenticação do agente |
| `RESEND_API_KEY` | Chave da API Resend (email) |
| `RESEND_FROM` | Email remetente (From) |
| `CRON_SECRET` | Secret para autenticação de cron jobs |

---

## Roles de Usuário

| Role | Acesso |
|---|---|
| `admin` | Tudo: admin, relatórios, monitoramento, automação |
| `developer` | Igual ao admin + debug tools |
| `technician` | Tickets, monitoramento, alertas, CMDB |
| `user` (cliente) | Portal do cliente, abertura de chamados, base de conhecimento |
