import type { ArchNode, ArchEdge, NodeKind } from './types';

export const KIND_COLORS: Record<NodeKind, string> = {
  frontend: '#3b82f6', // Blue
  backend: '#8b5cf6',  // Purple
  database: '#10b981', // Emerald green
  service: '#f59e0b',  // Amber
  api: '#06b6d4',      // Cyan
  ai: '#ec4899',       // Pink
};

export const KIND_LABELS: Record<NodeKind, string> = {
  frontend: 'Frontend (React/Vite)',
  backend: 'Backend (Go Chi)',
  database: 'Database (Postgres)',
  service: 'Service / Edge Func',
  api: 'API Endpoint',
  ai: 'AI Copilot / RAG',
};

export const ARCH_NODES: ArchNode[] = [
  // ─── Frontend ─────────────────────────────────────────────────────────────
  { id: 'app-shell', label: 'App Shell', kind: 'frontend', description: 'Layout raiz, autenticação, sidebar e roteador SPA React 18.', sourceRef: 'src/App.tsx' },
  { id: 'page-dashboard', label: 'Dashboard de Tickets', kind: 'frontend', description: 'Visão geral de chamados, métricas de atendimento e filtros.', sourceRef: 'src/pages/Index.tsx' },
  { id: 'page-ticket-details', label: 'Detalhes do Ticket', kind: 'frontend', description: 'Thread de mensagens, histórico de status e anexos.', sourceRef: 'src/pages/TicketDetails.tsx' },
  { id: 'page-new-ticket', label: 'Abertura de Ticket', kind: 'frontend', description: 'Formulário com sugestões de KB, upload e colagem de imagens.', sourceRef: 'src/pages/NewTicket.tsx' },
  { id: 'page-monitoring', label: 'Painel de Monitoramento', kind: 'frontend', description: 'Status em tempo real de máquinas, métricas de CPU/RAM/Disco e alertas.', sourceRef: 'src/pages/Monitoring.tsx' },
  { id: 'page-assets', label: 'Ativos (CMDB)', kind: 'frontend', description: 'Inventário de hardware, hostname, MAC e softwares instalados.', sourceRef: 'src/pages/Assets.tsx' },
  { id: 'page-admin', label: 'Painel Admin', kind: 'frontend', description: 'Gerenciamento de usuários, empresas e permissões globais.', sourceRef: 'src/pages/Admin.tsx' },
  { id: 'page-knowledge-base', label: 'Base de Conhecimento', kind: 'frontend', description: 'Artigos técnicos, tutoriais de autoatendimento e busca semântica.', sourceRef: 'src/pages/KnowledgeBase.tsx' },
  { id: 'page-client-portal', label: 'Portal do Cliente', kind: 'frontend', description: 'Interface simplificada para abertura e consulta de tickets por clientes.', sourceRef: 'src/pages/ClientPortal.tsx' },
  { id: 'page-automations', label: 'Automações', kind: 'frontend', description: 'Configuração de regras e gatilhos automatizados de TI.', sourceRef: 'src/pages/Automacoes.tsx' },

  // ─── Backend Handlers (Go) ────────────────────────────────────────────────
  { id: 'hnd-router', label: 'Chi Router', kind: 'backend', description: 'Roteamento HTTP principal, middleware de escopo e CORS.', sourceRef: 'handler/router.go' },
  { id: 'hnd-auth', label: 'Auth Handlers', kind: 'backend', description: 'Login de máquinas Windows, reset de senhas e validação de tokens.', sourceRef: 'handler/auth.go' },
  { id: 'hnd-tickets', label: 'Ticket Handlers', kind: 'backend', description: 'CRUD de chamados, comentários e regras de negócios.', sourceRef: 'handler/tickets.go' },
  { id: 'hnd-monitoring', label: 'Monitoring Handlers', kind: 'backend', description: 'Recepção de telemetria, heartbeats e avaliação de thresholds de alertas.', sourceRef: 'handler/monitoring.go' },
  { id: 'hnd-functions', label: 'Function Handlers', kind: 'backend', description: 'Proxies para chamadas administrativas e integração de e-mails.', sourceRef: 'handler/functions.go' },
  { id: 'hnd-links', label: 'Network Links Handlers', kind: 'backend', description: 'Verificação periódica de links de rede e VPNs.', sourceRef: 'handler/network_links.go' },
  { id: 'hnd-ws-terminal', label: 'WS Remote Terminal', kind: 'backend', description: 'Pty WebSocket interativo para terminal remoto de máquinas.', sourceRef: 'handler/ws_terminal.go' },
  { id: 'hnd-uptime', label: 'Uptime Handlers', kind: 'backend', description: 'Integração e webhook do UptimeRobot para status de serviços.', sourceRef: 'handler/uptime.go' },

  // ─── Backend Core Libraries (Go) ──────────────────────────────────────────
  { id: 'lib-db', label: 'lib/db.go', kind: 'backend', description: 'Pool de conexões Postgres, queries SQL puras e isolamento multi-tenant.', sourceRef: 'lib/db.go' },
  { id: 'lib-supabase', label: 'lib/supabase.go', kind: 'backend', description: 'Cliente Supabase Go para validação de JWT Auth e Storage.', sourceRef: 'lib/supabase.go' },
  { id: 'lib-email', label: 'lib/email.go', kind: 'backend', description: 'Disparo de e-mails transacionais via Resend API.', sourceRef: 'lib/email.go' },
  { id: 'lib-ratelimit', label: 'lib/ratelimit.go', kind: 'backend', description: 'Rate limiter em memória para proteção contra brute-force e DoS.', sourceRef: 'lib/ratelimit.go' },

  // ─── API Endpoints (HTTP / WS) ────────────────────────────────────────────
  { id: 'api-monitoring', label: '/api/monitoring/*', kind: 'api', description: 'Endpoints de métricas, máquinas, alertas e dashboards.', sourceRef: 'handler/monitoring.go' },
  { id: 'api-tickets', label: '/api/tickets/*', kind: 'api', description: 'Endpoints REST de chamados, comentários e prioridades.', sourceRef: 'handler/tickets.go' },
  { id: 'api-functions', label: '/api/functions/*', kind: 'api', description: 'Endpoints de gerenciamento e chamadas administrativas.', sourceRef: 'handler/functions.go' },
  { id: 'api-ws-terminal', label: '/api/ws/terminal', kind: 'api', description: 'WebSocket bidirecional para streaming de terminal PTY.', sourceRef: 'handler/ws_terminal.go' },

  // ─── Database Tables & Extensions (PostgreSQL) ────────────────────────────
  { id: 'db-tickets', label: 'tickets / comments', kind: 'database', description: 'Tabelas centrais de chamados, histórico, anexos e SLAs.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql' },
  { id: 'db-machines', label: 'machines / alerts', kind: 'database', description: 'Tabelas de computadores inventariados, telemetria e alertas críticos.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql' },
  { id: 'db-companies', label: 'companies / profiles', kind: 'database', description: 'Controle de multi-tenancy, usuários, contratos e papéis de acesso.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql' },
  { id: 'db-kb-articles', label: 'kb_articles (pgvector)', kind: 'database', description: 'Base de conhecimento com embeddings vetoriais para busca semântica.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql' },
  { id: 'db-audit-logs', label: 'audit_logs', kind: 'database', description: 'Log imutável de auditoria para ações sensíveis de TI.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql' },
  { id: 'db-supabase-postgres', label: 'Supabase Postgres', kind: 'database', description: 'Instância gerenciada de banco de dados relacional.', sourceRef: 'supabase/' },

  // ─── Services & Edge Functions ────────────────────────────────────────────
  { id: 'svc-supabase-auth', label: 'Supabase Auth', kind: 'service', description: 'Serviço de autenticação JWT, sessões e RBAC.', sourceRef: 'lib/supabase.go' },
  { id: 'svc-resend', label: 'Resend Email API', kind: 'service', description: 'Gateway para envio de notificações por e-mail.', sourceRef: 'lib/email.go' },
  { id: 'svc-uptimerobot', label: 'UptimeRobot API', kind: 'service', description: 'Monitoramento externo de disponibilidade de servidores.', sourceRef: 'handler/uptime.go' },
  { id: 'svc-admin-update-user', label: 'admin-update-user', kind: 'service', description: 'Edge function de atualização administrativa de usuários.', sourceRef: 'supabase/functions/admin-update-user/' },
  { id: 'svc-delete-user-admin', label: 'delete-user-admin', kind: 'service', description: 'Edge function para exclusão segura de usuários.', sourceRef: 'supabase/functions/delete-user-admin/' },
  { id: 'svc-create-user-credentials', label: 'create-user-credentials', kind: 'service', description: 'Geração e provisionamento de credenciais.', sourceRef: 'supabase/functions/create-user-credentials/' },
  { id: 'svc-send-password-changed', label: 'send-password-changed-alert', kind: 'service', description: 'Notificação de alerta de troca de senha.', sourceRef: 'supabase/functions/send-password-changed-alert/' },
  { id: 'svc-reset-password-with-token', label: 'reset-password-with-token', kind: 'service', description: 'Redefinição de senha com token de uso único.', sourceRef: 'supabase/functions/reset-password-with-token/' },
  { id: 'svc-invite-user-resend', label: 'invite-user-resend', kind: 'service', description: 'Disparo de convites para novos usuários.', sourceRef: 'supabase/functions/invite-user-resend/' },
  { id: 'svc-email-to-ticket', label: 'email-to-ticket', kind: 'service', description: 'Parser automático que converte e-mails recebidos em chamados.', sourceRef: 'supabase/functions/email-to-ticket/' },

  // ─── AI / Copilot (RAG) ───────────────────────────────────────────────────
  { id: 'ai-copilot', label: 'Ticket Copilot', kind: 'ai', description: 'Assistente de IA para triagem rápida e respostas de suporte.', sourceRef: 'src/components/ticket/TicketCopilot.tsx' },
  { id: 'ai-kb-search', label: 'Busca de KB Semântica', kind: 'ai', description: 'Recuperação aumentada por busca vetorial sobre artigos técnicos.', sourceRef: 'src/hooks/useKBSuggestions.ts' },
  { id: 'ai-sla-predictor', label: 'Preditor de SLA & Risco', kind: 'ai', description: 'Análise preditiva de atraso e priorização inteligente de tickets.', sourceRef: 'src/lib/ai/slaPredictor.ts' },
];

export const ARCH_EDGES: ArchEdge[] = [
  // Frontend -> App Shell
  { id: 'e-shell-dash', source: 'app-shell', target: 'page-dashboard' },
  { id: 'e-shell-ticket', source: 'app-shell', target: 'page-ticket-details' },
  { id: 'e-shell-new-ticket', source: 'app-shell', target: 'page-new-ticket' },
  { id: 'e-shell-monitoring', source: 'app-shell', target: 'page-monitoring' },
  { id: 'e-shell-assets', source: 'app-shell', target: 'page-assets' },
  { id: 'e-shell-admin', source: 'app-shell', target: 'page-admin' },
  { id: 'e-shell-kb', source: 'app-shell', target: 'page-knowledge-base' },
  { id: 'e-shell-portal', source: 'app-shell', target: 'page-client-portal' },
  { id: 'e-shell-automations', source: 'app-shell', target: 'page-automations' },

  // Frontend -> APIs
  { id: 'e-dash-tickets', source: 'page-dashboard', target: 'api-tickets' },
  { id: 'e-ticket-api', source: 'page-ticket-details', target: 'api-tickets' },
  { id: 'e-new-ticket-api', source: 'page-new-ticket', target: 'api-tickets' },
  { id: 'e-monitoring-api', source: 'page-monitoring', target: 'api-monitoring' },
  { id: 'e-assets-api', source: 'page-assets', target: 'api-monitoring' },
  { id: 'e-admin-fn-api', source: 'page-admin', target: 'api-functions' },
  { id: 'e-terminal-ws', source: 'page-monitoring', target: 'api-ws-terminal' },

  // APIs -> Handlers
  { id: 'e-api-tickets-hnd', source: 'api-tickets', target: 'hnd-tickets' },
  { id: 'e-api-mon-hnd', source: 'api-monitoring', target: 'hnd-monitoring' },
  { id: 'e-api-fn-hnd', source: 'api-functions', target: 'hnd-functions' },
  { id: 'e-api-ws-hnd', source: 'api-ws-terminal', target: 'hnd-ws-terminal' },

  // Handlers -> Backend Core
  { id: 'e-hnd-tickets-db', source: 'hnd-tickets', target: 'lib-db' },
  { id: 'e-hnd-mon-db', source: 'hnd-monitoring', target: 'lib-db' },
  { id: 'e-hnd-fn-db', source: 'hnd-functions', target: 'lib-db' },
  { id: 'e-hnd-links-db', source: 'hnd-links', target: 'lib-db' },
  { id: 'e-hnd-auth-sb', source: 'hnd-auth', target: 'lib-supabase' },
  { id: 'e-hnd-fn-email', source: 'hnd-functions', target: 'lib-email' },
  { id: 'e-hnd-router-rate', source: 'hnd-router', target: 'lib-ratelimit' },
  { id: 'e-hnd-uptime-ext', source: 'hnd-uptime', target: 'svc-uptimerobot' },

  // Backend Core -> Database & Services
  { id: 'e-db-tickets-tbl', source: 'lib-db', target: 'db-tickets' },
  { id: 'e-db-machines-tbl', source: 'lib-db', target: 'db-machines' },
  { id: 'e-db-companies-tbl', source: 'lib-db', target: 'db-companies' },
  { id: 'e-db-audit-tbl', source: 'lib-db', target: 'db-audit-logs' },
  { id: 'e-db-pg-instance', source: 'lib-db', target: 'db-supabase-postgres' },
  { id: 'e-sb-auth-svc', source: 'lib-supabase', target: 'svc-supabase-auth' },
  { id: 'e-email-resend-svc', source: 'lib-email', target: 'svc-resend' },

  // Edge Functions -> DB & Email
  { id: 'e-fn-admin-update', source: 'hnd-functions', target: 'svc-admin-update-user' },
  { id: 'e-fn-delete-user', source: 'hnd-functions', target: 'svc-delete-user-admin' },
  { id: 'e-fn-create-creds', source: 'hnd-functions', target: 'svc-create-user-credentials' },
  { id: 'e-fn-pwd-changed', source: 'hnd-functions', target: 'svc-send-password-changed' },
  { id: 'e-fn-reset-pwd', source: 'hnd-auth', target: 'svc-reset-password-with-token' },
  { id: 'e-fn-invite', source: 'hnd-functions', target: 'svc-invite-user-resend' },
  { id: 'e-fn-invite-resend', source: 'svc-invite-user-resend', target: 'svc-resend' },
  { id: 'e-fn-pwd-resend', source: 'svc-send-password-changed', target: 'svc-resend' },
  { id: 'e-email-ticket-parse', source: 'svc-email-to-ticket', target: 'db-tickets' },

  // AI & Knowledge Base
  { id: 'e-ticket-copilot', source: 'page-ticket-details', target: 'ai-copilot' },
  { id: 'e-copilot-kb', source: 'ai-copilot', target: 'db-kb-articles' },
  { id: 'e-new-ticket-kb', source: 'page-new-ticket', target: 'ai-kb-search' },
  { id: 'e-kb-search-db', source: 'ai-kb-search', target: 'db-kb-articles' },
  { id: 'e-dash-sla-ai', source: 'page-dashboard', target: 'ai-sla-predictor' },
  { id: 'e-sla-tickets-db', source: 'ai-sla-predictor', target: 'db-tickets' },
];

export const NODE_BY_ID = new Map(ARCH_NODES.map(n => [n.id, n]));
export const EDGE_BY_ID = new Map(ARCH_EDGES.map(e => [e.id, e]));
