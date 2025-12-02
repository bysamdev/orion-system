-- Criar tabela para tokens de convite temporários
CREATE TABLE public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por token
CREATE INDEX idx_invite_tokens_token ON public.invite_tokens(token);

-- Índice para busca por email
CREATE INDEX idx_invite_tokens_email ON public.invite_tokens(email);

-- Habilitar RLS
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Permitir leitura pública para validação de token
CREATE POLICY "Anyone can validate tokens"
ON public.invite_tokens
FOR SELECT
TO public
USING (expires_at > now());

-- Política: Apenas admins e developers podem criar tokens
CREATE POLICY "Admins can create tokens"
ON public.invite_tokens
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'developer'::app_role)
);

-- Política: Sistema pode deletar tokens usados/expirados
CREATE POLICY "Service role can delete tokens"
ON public.invite_tokens
FOR DELETE
TO authenticated
USING (true);

-- Função para limpar tokens expirados (pode ser chamada por cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invite_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM invite_tokens
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;