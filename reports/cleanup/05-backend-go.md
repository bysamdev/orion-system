# Relatório de Limpeza 05 — Backend Go e Funções Serverless Vercel

**Subagente**: Subagente 5 (Auditor de Handlers, Rotas e Entrypoints Go)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Escopo**: `api/`, `handler/`, `lib/`, `cmd/`, `orion-agent/`, `vercel.json`.  

---

## 1. Mapeamento de Entrypoints Serverless da Vercel (`api/`)

* **`api/router.go`** (12 linhas):
  * **Função**: Ponto de entrada único da Vercel para rotas Go Serverless (`package api`).
  * **Alinhamento com `vercel.json`**: O arquivo `vercel.json` define a regra de rewrite `{ "source": "/api/(.*)", "destination": "/api/router" }`.
  * **Diagnóstico**: **VIVO E CRÍTICO**. Não possui imports no frontend porque é acionado exclusivamente via requisições HTTP da Vercel.

---

## 2. Auditoria do Roteador Chi e Handlers (`handler/`)

O arquivo `handler/router.go` constrói o roteador central com **44 rotas HTTP**:

| Grupo de Rotas | Quantidade | Autenticação / Proteção | Consumidores Confirmados |
| :--- | :---: | :--- | :--- |
| **Auth & Recuperação** | 2 | Token de uso único / Token de máquina + Rate Limit | `src/pages/Auth.tsx`, `src/pages/SetPassword.tsx` |
| **Monitoramento & RMM** | 18 | `X-Agent-Key` / JWT com escopo de tenant | `src/pages/Monitoring.tsx`, `MachineDrawer.tsx`, Orion Agent |
| **Webhooks Externos** | 1 | `X-Webhook-Secret` (Grafana) | Webhook do Grafana Cloud |
| **Crons Serverless** | 2 | `CRON_SECRET` (Vercel Cron) | Agendamentos diários em `vercel.json` |
| **WebSockets Terminal** | 2 | Subprotocol Token | `src/components/monitoring/RemoteTerminal.tsx`, Orion Agent |
| **Links de Rede & Web** | 6 | JWT com escopo de tenant | `src/pages/WebMonitoring.tsx` |
| **Instaladores & Grafana** | 4 | JWT com escopo de tenant | `src/components/patch/AgentInstallerCard.tsx`, `CompanyManagement.tsx` |
| **Funções Administrativas** | 6 | JWT com escopo de tenant | `src/components/admin/UserManagement.tsx`, `NewTicket.tsx` |
| **Tickets / Resolução** | 1 | JWT com escopo de tenant | `src/pages/TicketDetails.tsx` |

### 2.1 Verificação de Código Morto em Handlers
- Todos os handlers declarados em `handler/*.go` estão registrados em `buildRouter()` ou são chamados internamente por outros handlers.
- Não existem arquivos `.go` órfãos dentro de `handler/` ou `lib/`.
- A suíte de testes do Go (`go test ./...`) e a análise estática (`go vet ./...`) executam com 100% de sucesso.
