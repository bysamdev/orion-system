-- Fase 5 da auditoria: índices de apoio para tabelas que crescem.

-- ORN-PERF-04: todo heartbeat procura os comandos pendentes da máquina e
-- expira os antigos. Um índice só das linhas pendentes fica pequeno (a
-- maioria dos comandos já terminou) e serve às duas consultas.
CREATE INDEX IF NOT EXISTS idx_machine_commands_pendentes
  ON public.machine_commands (machine_id, created_at)
  WHERE status = 'pending';

-- ORN-PERF-07: chaves estrangeiras sem índice nas tabelas que crescem com o
-- uso. Sem ele, apagar um usuário varre a tabela inteira para conferir a FK.
-- routing_rules e configuracoes_sistema ficam de fora: têm poucas linhas e
-- não vão crescer.
CREATE INDEX IF NOT EXISTS idx_ticket_ratings_user_id
  ON public.ticket_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_remote_terminal_sessions_opened_by
  ON public.remote_terminal_sessions (opened_by);
