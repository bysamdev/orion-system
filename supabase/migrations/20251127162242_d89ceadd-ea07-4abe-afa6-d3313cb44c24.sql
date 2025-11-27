-- Habilitar REPLICA IDENTITY FULL para capturar dados completos nas atualizações
ALTER TABLE public.audit_log REPLICA IDENTITY FULL;

-- Adicionar tabela audit_log à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;