-- =================================================================================
-- Migration: 20260825000600_persistent_rate_limit_counters.sql
-- Descrição: Contador de rate limit persistente no Postgres, pra fechar o
-- gap do limitador em memória (lib/ratelimit.go) em ambiente serverless --
-- instâncias concorrentes da Vercel não compartilham memória entre si, e o
-- limite em memória sozinho protege só UMA instância isolada.
--
-- Janela fixa (não deslizante, ao contrário do limitador em memória):
-- bucket = floor(epoch(now()) / janela) * janela. Simples de fazer atômico
-- num UPSERT único, sem lock explícito. Suficiente pra defesa contra
-- brute-force -- não precisa da precisão de uma janela deslizante aqui.
--
-- Só acessível via conexão direta do backend Go (service role / dono da
-- conexão pg), nunca via PostgREST -- RLS habilitada sem nenhuma policy
-- fecha o acesso de anon/authenticated por padrão, e a função não tem GRANT
-- pra esses papéis.
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
    bucket_key   text NOT NULL,
    window_start timestamptz NOT NULL,
    count        integer NOT NULL DEFAULT 1,
    PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_window_seconds int, p_limit int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start timestamptz;
    v_count int;
BEGIN
    v_window_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

    INSERT INTO public.rate_limit_counters (bucket_key, window_start, count)
    VALUES (p_key, v_window_start, 1)
    ON CONFLICT (bucket_key, window_start)
    DO UPDATE SET count = rate_limit_counters.count + 1
    RETURNING count INTO v_count;

    -- Housekeeping oportunista: descarta janelas velhas da mesma chave em
    -- vez de exigir um cron dedicado só pra isso.
    DELETE FROM public.rate_limit_counters
    WHERE bucket_key = p_key AND window_start < v_window_start;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
