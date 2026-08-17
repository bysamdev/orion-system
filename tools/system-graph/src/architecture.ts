import type { ArchNode, ArchEdge, NodeKind } from './types';

export const KIND_COLORS: Record<NodeKind, string> = {
  frontend: '#38bdf8', // Vibrant Sky Blue
  backend: '#a855f7',  // Electric Purple
  database: '#10b981', // Neon Emerald
  service: '#f59e0b',  // Amber Gold
  api: '#06b6d4',      // Bright Cyan
  ai: '#f43f5e',       // Laser Pink
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
  // ─── Frontend (React 18 + Vite) ──────────────────────────────────────────
  { id: 'app-shell', label: 'App Shell', kind: 'frontend', description: 'Layout raiz, autenticação, sidebar e roteador SPA React 18.', sourceRef: 'src/App.tsx', tech: 'React 18 + React Router v7', layer: 'Camada de Apresentação' },
  { id: 'page-dashboard', label: 'Dashboard de Tickets', kind: 'frontend', description: 'Visão geral de chamados, métricas de atendimento e filtros dinâmicos.', sourceRef: 'src/pages/Index.tsx', tech: 'TanStack Query + Tailwind', layer: 'Camada de Apresentação' },
  { id: 'page-ticket-details', label: 'Detalhes do Ticket', kind: 'frontend', description: 'Thread de mensagens, histórico de status e anexos em tempo real.', sourceRef: 'src/pages/TicketDetails.tsx', tech: 'Supabase Realtime + Radix UI', layer: 'Camada de Apresentação' },
  { id: 'page-new-ticket', label: 'Abertura de Ticket', kind: 'frontend', description: 'Formulário com sugestões de KB, upload e colagem de imagens por Ctrl+V.', sourceRef: 'src/pages/NewTicket.tsx', tech: 'React Hook Form + Zod', layer: 'Camada de Apresentação' },
  { id: 'page-monitoring', label: 'Painel de Monitoramento', kind: 'frontend', description: 'Status em tempo real de máquinas, métricas de CPU/RAM/Disco e alertas.', sourceRef: 'src/pages/Monitoring.tsx', tech: 'Recharts + WebSockets', layer: 'Camada de Apresentação' },
  { id: 'page-assets', label: 'Ativos (CMDB)', kind: 'frontend', description: 'Inventário de hardware, hostname, MAC e softwares instalados.', sourceRef: 'src/pages/Assets.tsx', tech: 'TanStack Table + Vitest', layer: 'Camada de Apresentação' },
  { id: 'page-admin', label: 'Painel Admin', kind: 'frontend', description: 'Gerenciamento de usuários, empresas e permissões globais.', sourceRef: 'src/pages/Admin.tsx', tech: 'Shadcn UI + RBAC', layer: 'Camada de Apresentação' },
  { id: 'page-knowledge-base', label: 'Base de Conhecimento', kind: 'frontend', description: 'Artigos técnicos, tutoriais de autoatendimento e busca semântica.', sourceRef: 'src/pages/KnowledgeBase.tsx', tech: 'pgvector + Markdown', layer: 'Camada de Apresentação' },
  { id: 'page-client-portal', label: 'Portal do Cliente', kind: 'frontend', description: 'Interface simplificada para abertura e consulta de tickets por clientes.', sourceRef: 'src/pages/ClientPortal.tsx', tech: 'Responsive Tailwind SPA', layer: 'Camada de Apresentação' },
  { id: 'page-automations', label: 'Automações', kind: 'frontend', description: 'Configuração de regras e gatilhos automatizados de TI.', sourceRef: 'src/pages/Automacoes.tsx', tech: 'JSON Schema + Event Rules', layer: 'Camada de Apresentação' },

  // ─── Backend Handlers (Go) ────────────────────────────────────────────────
  { id: 'hnd-router', label: 'Chi Router', kind: 'backend', description: 'Roteamento HTTP principal, middleware de escopo multi-tenant e CORS.', sourceRef: 'handler/router.go', tech: 'Go 1.22 + go-chi/v5', layer: 'Gateway & Roteamento' },
  { id: 'hnd-auth', label: 'Auth Handlers', kind: 'backend', description: 'Login de máquinas Windows, reset de senhas e validação de tokens.', sourceRef: 'handler/auth.go', tech: 'JWT + SHA256 Tokens', layer: 'Camada de Aplicação (Go)' },
  { id: 'hnd-tickets', label: 'Ticket Handlers', kind: 'backend', description: 'CRUD de chamados, comentários e regras de negócios.', sourceRef: 'handler/tickets.go', tech: 'Go SQL + Prepared Stmts', layer: 'Camada de Aplicação (Go)' },
  { id: 'hnd-monitoring', label: 'Monitoring Handlers', kind: 'backend', description: 'Recepção de telemetria, heartbeats e avaliação de thresholds de alertas.', sourceRef: 'handler/monitoring.go', tech: 'Async Batch Ingestion', layer: 'Camada de Aplicação (Go)' },
  { id: 'hnd-functions', label: 'Function Handlers', kind: 'backend', description: 'Proxies para chamadas administrativas e integração de e-mails.', sourceRef: 'handler/functions.go', tech: 'HTTP Client Pooling', layer: 'Camada de Aplicação (Go)' },
  { id: 'hnd-links', label: 'Network Links Handlers', kind: 'backend', description: 'Verificação periódica de links de rede e VPNs.', sourceRef: 'handler/network_links.go', tech: 'ICMP / TCP Probing', layer: 'Camada de Aplicação (Go)' },
  { id: 'hnd-ws-terminal', label: 'WS Remote Terminal', kind: 'backend', description: 'Pty WebSocket interativo para terminal remoto de máquinas.', sourceRef: 'handler/ws_terminal.go', tech: 'Gorilla WebSocket + PTY', layer: 'Camada de Aplicação (Go)' },
  { id: 'hnd-uptime', label: 'Uptime Handlers', kind: 'backend', description: 'Integração e webhook do UptimeRobot para status de serviços.', sourceRef: 'handler/uptime.go', tech: 'Webhook Receiver', layer: 'Camada de Aplicação (Go)' },

  // ─── Backend Core Libraries (Go) ──────────────────────────────────────────
  { id: 'lib-db', label: 'lib/db.go (SQL Pool)', kind: 'backend', description: 'Pool de conexões Postgres, queries SQL puras e isolamento multi-tenant.', sourceRef: 'lib/db.go', tech: 'pgx / database/sql', layer: 'Acesso a Dados' },
  { id: 'lib-supabase', label: 'lib/supabase.go', kind: 'backend', description: 'Cliente Supabase Go para validação de JWT Auth e Storage.', sourceRef: 'lib/supabase.go', tech: 'Go Supabase Client', layer: 'Acesso a Dados' },
  { id: 'lib-email', label: 'lib/email.go', kind: 'backend', description: 'Disparo de e-mails transacionais via Resend API.', sourceRef: 'lib/email.go', tech: 'Resend SDK Go', layer: 'Integrações Externas' },
  { id: 'lib-ratelimit', label: 'lib/ratelimit.go', kind: 'backend', description: 'Rate limiter em memória para proteção contra brute-force e DoS.', sourceRef: 'lib/ratelimit.go', tech: 'Token Bucket Alg.', layer: 'Segurança & Resiliência' },

  // ─── API Endpoints (HTTP / WS) ────────────────────────────────────────────
  { id: 'api-monitoring', label: '/api/monitoring/*', kind: 'api', description: 'Endpoints de métricas, máquinas, alertas e dashboards.', sourceRef: 'handler/monitoring.go', tech: 'REST JSON API', layer: 'API Gateway' },
  { id: 'api-tickets', label: '/api/tickets/*', kind: 'api', description: 'Endpoints REST de chamados, comentários e prioridades.', sourceRef: 'handler/tickets.go', tech: 'REST JSON API', layer: 'API Gateway' },
  { id: 'api-functions', label: '/api/functions/*', kind: 'api', description: 'Endpoints de gerenciamento e chamadas administrativas.', sourceRef: 'handler/functions.go', tech: 'REST JSON API', layer: 'API Gateway' },
  { id: 'api-ws-terminal', label: '/api/ws/terminal', kind: 'api', description: 'WebSocket bidirecional para streaming de terminal PTY.', sourceRef: 'handler/ws_terminal.go', tech: 'WSS Subprotocol', layer: 'API Gateway' },

  // ─── Database Tables & Extensions (PostgreSQL) ────────────────────────────
  { id: 'db-tickets', label: 'tickets / comments', kind: 'database', description: 'Tabelas centrais de chamados, histórico, anexos e SLAs.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql', tech: 'Postgres RLS + Indexes', layer: 'Persistência & Banco' },
  { id: 'db-machines', label: 'machines / alerts', kind: 'database', description: 'Tabelas de computadores inventariados, telemetria e alertas críticos.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql', tech: 'Time-series telemetry', layer: 'Persistência & Banco' },
  { id: 'db-companies', label: 'companies / profiles', kind: 'database', description: 'Controle de multi-tenancy, usuários, contratos e papéis de acesso.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql', tech: 'Tenant Isolation Schema', layer: 'Persistência & Banco' },
  { id: 'db-kb-articles', label: 'kb_articles (pgvector)', kind: 'database', description: 'Base de conhecimento com embeddings vetoriais para busca semântica.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql', tech: 'pgvector IVFFlat index', layer: 'Persistência & Banco' },
  { id: 'db-audit-logs', label: 'audit_logs', kind: 'database', description: 'Log imutável de auditoria para ações sensíveis de TI.', sourceRef: 'supabase/migrations/20260813000000_phase2_merge_and_custom_fields.sql', tech: 'Append-only Audit Log', layer: 'Persistência & Banco' },
  { id: 'db-supabase-postgres', label: 'Supabase Postgres 17', kind: 'database', description: 'Instância gerenciada de banco de dados relacional de alta disponibilidade.', sourceRef: 'supabase/', tech: 'PostgreSQL 17.6', layer: 'Infraestrutura Gerenciada' },

  // ─── Services & Edge Functions ────────────────────────────────────────────
  { id: 'svc-supabase-auth', label: 'Supabase Auth (GoTrue)', kind: 'service', description: 'Serviço de autenticação JWT, sessões e RBAC com token refresh.', sourceRef: 'lib/supabase.go', tech: 'OAuth2 / JWT RS256', layer: 'Serviços em Nuvem' },
  { id: 'svc-resend', label: 'Resend Email API', kind: 'service', description: 'Gateway para envio de notificações por e-mail com alta entregabilidade.', sourceRef: 'lib/email.go', tech: 'Resend REST API v1', layer: 'Serviços em Nuvem' },
  { id: 'svc-uptimerobot', label: 'UptimeRobot API', kind: 'service', description: 'Monitoramento externo de disponibilidade de servidores e DNS.', sourceRef: 'handler/uptime.go', tech: 'External Synthetic Checks', layer: 'Serviços em Nuvem' },
  { id: 'svc-admin-update-user', label: 'admin-update-user', kind: 'service', description: 'Edge function de atualização administrativa de usuários.', sourceRef: 'supabase/functions/admin-update-user/', tech: 'Deno TypeScript Edge', layer: 'Edge Functions' },
  { id: 'svc-delete-user-admin', label: 'delete-user-admin', kind: 'service', description: 'Edge function para exclusão segura de usuários e seus vínculos.', sourceRef: 'supabase/functions/delete-user-admin/', tech: 'Deno TypeScript Edge', layer: 'Edge Functions' },
  { id: 'svc-create-user-credentials', label: 'create-user-credentials', kind: 'service', description: 'Geração e provisionamento seguro de credenciais de novos técnicos.', sourceRef: 'supabase/functions/create-user-credentials/', tech: 'Deno TypeScript Edge', layer: 'Edge Functions' },
  { id: 'svc-send-password-changed', label: 'send-password-changed-alert', kind: 'service', description: 'Notificação de segurança imediata após alteração de senha.', sourceRef: 'supabase/functions/send-password-changed-alert/', tech: 'Deno TypeScript Edge', layer: 'Edge Functions' },
  { id: 'svc-reset-password-with-token', label: 'reset-password-with-token', kind: 'service', description: 'Redefinição de senha com token criptográfico de uso único.', sourceRef: 'supabase/functions/reset-password-with-token/', tech: 'Deno TypeScript Edge', layer: 'Edge Functions' },
  { id: 'svc-invite-user-resend', label: 'invite-user-resend', kind: 'service', description: 'Disparo de convites por e-mail para novos usuários entrarem na empresa.', sourceRef: 'supabase/functions/invite-user-resend/', tech: 'Deno TypeScript Edge', layer: 'Edge Functions' },
  { id: 'svc-email-to-ticket', label: 'email-to-ticket', kind: 'service', description: 'Parser inteligente que converte e-mails recebidos em chamados.', sourceRef: 'supabase/functions/email-to-ticket/', tech: 'Deno Webhook Parser', layer: 'Edge Functions' },

  // ─── AI / Copilot (RAG) ───────────────────────────────────────────────────
  { id: 'ai-copilot', label: 'Ticket Copilot (IA)', kind: 'ai', description: 'Assistente de IA generativa para triagem rápida e respostas de suporte.', sourceRef: 'src/components/ticket/TicketCopilot.tsx', tech: 'OpenAI GPT-4o / Claude', layer: 'Inteligência Artificial' },
  { id: 'ai-kb-search', label: 'Busca Semântica de KB', kind: 'ai', description: 'Recuperação aumentada por busca vetorial (Cosine Similarity) sobre artigos.', sourceRef: 'src/hooks/useKBSuggestions.ts', tech: 'text-embedding-3-small', layer: 'Inteligência Artificial' },
  { id: 'ai-sla-predictor', label: 'Preditor de SLA & Risco', kind: 'ai', description: 'Análise preditiva de probabilidade de atraso e priorização inteligente.', sourceRef: 'src/lib/ai/slaPredictor.ts', tech: 'Heuristic Regression Model', layer: 'Inteligência Artificial' },
];

export const ARCH_EDGES: ArchEdge[] = [
  // Frontend -> App Shell
  { id: 'e-shell-dash', source: 'app-shell', target: 'page-dashboard', protocol: 'React Route' },
  { id: 'e-shell-ticket', source: 'app-shell', target: 'page-ticket-details', protocol: 'React Route' },
  { id: 'e-shell-new-ticket', source: 'app-shell', target: 'page-new-ticket', protocol: 'React Route' },
  { id: 'e-shell-monitoring', source: 'app-shell', target: 'page-monitoring', protocol: 'React Route' },
  { id: 'e-shell-assets', source: 'app-shell', target: 'page-assets', protocol: 'React Route' },
  { id: 'e-shell-admin', source: 'app-shell', target: 'page-admin', protocol: 'React Route' },
  { id: 'e-shell-kb', source: 'app-shell', target: 'page-knowledge-base', protocol: 'React Route' },
  { id: 'e-shell-portal', source: 'app-shell', target: 'page-client-portal', protocol: 'React Route' },
  { id: 'e-shell-automations', source: 'app-shell', target: 'page-automations', protocol: 'React Route' },

  // Frontend -> APIs
  { id: 'e-dash-tickets', source: 'page-dashboard', target: 'api-tickets', protocol: 'HTTPS / JSON' },
  { id: 'e-ticket-api', source: 'page-ticket-details', target: 'api-tickets', protocol: 'HTTPS / JSON' },
  { id: 'e-new-ticket-api', source: 'page-new-ticket', target: 'api-tickets', protocol: 'HTTPS / JSON' },
  { id: 'e-monitoring-api', source: 'page-monitoring', target: 'api-monitoring', protocol: 'HTTPS / JSON' },
  { id: 'e-assets-api', source: 'page-assets', target: 'api-monitoring', protocol: 'HTTPS / JSON' },
  { id: 'e-admin-fn-api', source: 'page-admin', target: 'api-functions', protocol: 'HTTPS / Bearer' },
  { id: 'e-terminal-ws', source: 'page-monitoring', target: 'api-ws-terminal', protocol: 'WSS / PTY' },

  // APIs -> Handlers
  { id: 'e-api-tickets-hnd', source: 'api-tickets', target: 'hnd-tickets', protocol: 'Go Chi Dispatch' },
  { id: 'e-api-mon-hnd', source: 'api-monitoring', target: 'hnd-monitoring', protocol: 'Go Chi Dispatch' },
  { id: 'e-api-fn-hnd', source: 'api-functions', target: 'hnd-functions', protocol: 'Go Chi Dispatch' },
  { id: 'e-api-ws-hnd', source: 'api-ws-terminal', target: 'hnd-ws-terminal', protocol: 'Go Chi Upgrade' },

  // Handlers -> Backend Core
  { id: 'e-hnd-tickets-db', source: 'hnd-tickets', target: 'lib-db', protocol: 'Internal SQL Call' },
  { id: 'e-hnd-mon-db', source: 'hnd-monitoring', target: 'lib-db', protocol: 'Batch SQL Insert' },
  { id: 'e-hnd-fn-db', source: 'hnd-functions', target: 'lib-db', protocol: 'Internal SQL Call' },
  { id: 'e-hnd-links-db', source: 'hnd-links', target: 'lib-db', protocol: 'Internal SQL Call' },
  { id: 'e-hnd-auth-sb', source: 'hnd-auth', target: 'lib-supabase', protocol: 'Go Supabase Auth' },
  { id: 'e-hnd-fn-email', source: 'hnd-functions', target: 'lib-email', protocol: 'Resend Go Client' },
  { id: 'e-hnd-router-rate', source: 'hnd-router', target: 'lib-ratelimit', protocol: 'Memory In-Proc' },
  { id: 'e-hnd-uptime-ext', source: 'hnd-uptime', target: 'svc-uptimerobot', protocol: 'HTTPS REST Webhook' },

  // Backend Core -> Database & Services
  { id: 'e-db-tickets-tbl', source: 'lib-db', target: 'db-tickets', protocol: 'SQL TCP / 5432' },
  { id: 'e-db-machines-tbl', source: 'lib-db', target: 'db-machines', protocol: 'SQL TCP / 5432' },
  { id: 'e-db-companies-tbl', source: 'lib-db', target: 'db-companies', protocol: 'SQL TCP / 5432' },
  { id: 'e-db-audit-tbl', source: 'lib-db', target: 'db-audit-logs', protocol: 'SQL TCP / 5432' },
  { id: 'e-db-pg-instance', source: 'lib-db', target: 'db-supabase-postgres', protocol: 'Postgres Connection Pool' },
  { id: 'e-sb-auth-svc', source: 'lib-supabase', target: 'svc-supabase-auth', protocol: 'HTTPS / GoTrue API' },
  { id: 'e-email-resend-svc', source: 'lib-email', target: 'svc-resend', protocol: 'HTTPS / Resend REST' },

  // Edge Functions -> DB & Email
  { id: 'e-fn-admin-update', source: 'hnd-functions', target: 'svc-admin-update-user', protocol: 'HTTPS Edge Invoke' },
  { id: 'e-fn-delete-user', source: 'hnd-functions', target: 'svc-delete-user-admin', protocol: 'HTTPS Edge Invoke' },
  { id: 'e-fn-create-creds', source: 'hnd-functions', target: 'svc-create-user-credentials', protocol: 'HTTPS Edge Invoke' },
  { id: 'e-fn-pwd-changed', source: 'hnd-functions', target: 'svc-send-password-changed', protocol: 'HTTPS Edge Invoke' },
  { id: 'e-fn-reset-pwd', source: 'hnd-auth', target: 'svc-reset-password-with-token', protocol: 'HTTPS Edge Invoke' },
  { id: 'e-fn-invite', source: 'hnd-functions', target: 'svc-invite-user-resend', protocol: 'HTTPS Edge Invoke' },
  { id: 'e-fn-invite-resend', source: 'svc-invite-user-resend', target: 'svc-resend', protocol: 'HTTPS / Resend REST' },
  { id: 'e-fn-pwd-resend', source: 'svc-send-password-changed', target: 'svc-resend', protocol: 'HTTPS / Resend REST' },
  { id: 'e-email-ticket-parse', source: 'svc-email-to-ticket', target: 'db-tickets', protocol: 'Direct SQL Write' },

  // AI & Knowledge Base
  { id: 'e-ticket-copilot', source: 'page-ticket-details', target: 'ai-copilot', protocol: 'Streaming WebSocket' },
  { id: 'e-copilot-kb', source: 'ai-copilot', target: 'db-kb-articles', protocol: 'pgvector Search' },
  { id: 'e-new-ticket-kb', source: 'page-new-ticket', target: 'ai-kb-search', protocol: 'Realtime Suggest' },
  { id: 'e-kb-search-db', source: 'ai-kb-search', target: 'db-kb-articles', protocol: 'Vector Cosine Search' },
  { id: 'e-dash-sla-ai', source: 'page-dashboard', target: 'ai-sla-predictor', protocol: 'Client Inference' },
  { id: 'e-sla-tickets-db', source: 'ai-sla-predictor', target: 'db-tickets', protocol: 'Historical SLA Query' },
];

export const NODE_BY_ID = new Map(ARCH_NODES.map(n => [n.id, n]));
export const EDGE_BY_ID = new Map(ARCH_EDGES.map(e => [e.id, e]));
