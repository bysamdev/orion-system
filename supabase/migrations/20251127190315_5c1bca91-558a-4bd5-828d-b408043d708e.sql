-- Adicionar campos para acesso remoto na tabela tickets
ALTER TABLE public.tickets
ADD COLUMN remote_id text,
ADD COLUMN remote_password text;

-- Comentários para documentação
COMMENT ON COLUMN public.tickets.remote_id IS 'ID do TeamViewer/AnyDesk para acesso remoto';
COMMENT ON COLUMN public.tickets.remote_password IS 'Senha temporária para acesso remoto';