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
