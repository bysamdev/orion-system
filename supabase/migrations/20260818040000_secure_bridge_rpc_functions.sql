-- Migration: Secure the Orion Telemetry Bridge RPC functions
--
-- get_all_monitoring_targets() e update_telemetry_status() foram criadas
-- direto no banco (fora de qualquer migration versionada) para o daemon
-- orion-bridge (servidor Debian dedicado) e ficaram com EXECUTE liberado
-- para PUBLIC — qualquer portador da anon key pública (embutida no bundle
-- do frontend, trivialmente extraível) conseguia:
--   1. get_all_monitoring_targets(): ler endpoints/links/máquinas de TODAS
--      as empresas, não só a própria (a função não filtra por tenant).
--   2. update_telemetry_status(): escrever status/latência falsos em
--      QUALQUER linha de QUALQUER empresa, sem autenticação nenhuma além
--      da anon key pública.
--
-- Esta migration fecha isso com um segredo compartilhado que só o
-- orion-bridge conhece (via variável de ambiente, nunca embutido no
-- frontend) — sem trocar a autenticação do bridge (que continua usando a
-- anon key, é só o que o Supabase client dele já fala), sem quebrar a
-- integração que já está rodando em produção.

-- 1. Tabela interna do segredo. RLS habilitada SEM nenhuma política: nenhum
-- papel comum (anon/authenticated) enxerga uma linha sequer, mesmo com
-- SELECT via API — só o dono da tabela (postgres, via função
-- SECURITY DEFINER) contorna RLS por padrão no Postgres.
CREATE TABLE IF NOT EXISTS public.bridge_secrets (
    name text PRIMARY KEY,
    secret text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bridge_secrets ENABLE ROW LEVEL SECURITY;

-- Nenhuma GRANT para anon/authenticated: a tabela fica inacessível para
-- esses papéis mesmo antes de entrar em jogo a ausência de políticas RLS.
REVOKE ALL ON public.bridge_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO public.bridge_secrets (name, secret)
VALUES ('orion_bridge', 'c763084a31b36a59c1db3fc2b4d4c8a8feb8017c521ee56f2f0a593b8b341e9f')
ON CONFLICT (name) DO NOTHING;

-- 2. get_all_monitoring_targets agora exige o segredo do bridge.
CREATE OR REPLACE FUNCTION public.get_all_monitoring_targets(p_secret text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_endpoints jsonb;
    v_links jsonb;
    v_machines jsonb;
BEGIN
    IF p_secret IS NULL OR p_secret NOT IN (SELECT secret FROM public.bridge_secrets WHERE name = 'orion_bridge') THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'url_or_ip', url_or_ip,
        'company_id', company_id,
        'status', status
    )), '[]'::jsonb)
    INTO v_endpoints
    FROM public.monitored_endpoints;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'ip_or_hostname', ip_or_hostname,
        'link_type', link_type,
        'company_id', company_id,
        'status', status
    )), '[]'::jsonb)
    INTO v_links
    FROM public.network_links;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'hostname', hostname,
        'local_ip', local_ip,
        'company_id', company_id,
        'status', status
    )), '[]'::jsonb)
    INTO v_machines
    FROM public.machines;

    RETURN jsonb_build_object(
        'endpoints', v_endpoints,
        'links', v_links,
        'machines', v_machines
    );
END;
$function$;

-- 3. update_telemetry_status idem.
CREATE OR REPLACE FUNCTION public.update_telemetry_status(
    p_endpoint_results jsonb DEFAULT '[]'::jsonb,
    p_link_results jsonb DEFAULT '[]'::jsonb,
    p_secret text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    item jsonb;
    updated_endpoints int := 0;
    updated_links int := 0;
BEGIN
    IF p_secret IS NULL OR p_secret NOT IN (SELECT secret FROM public.bridge_secrets WHERE name = 'orion_bridge') THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;

    IF p_endpoint_results IS NOT NULL AND jsonb_array_length(p_endpoint_results) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_endpoint_results)
        LOOP
            UPDATE public.monitored_endpoints
            SET status = item->>'status',
                last_check = COALESCE((item->>'last_check')::timestamptz, now())
            WHERE id = (item->>'id')::uuid
               OR url_or_ip = (item->>'url_or_ip');
            updated_endpoints := updated_endpoints + 1;
        END LOOP;
    END IF;

    IF p_link_results IS NOT NULL AND jsonb_array_length(p_link_results) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_link_results)
        LOOP
            UPDATE public.network_links
            SET status = item->>'status',
                last_ping_ms = (item->>'last_ping_ms')::int,
                last_checked_at = COALESCE((item->>'last_checked_at')::timestamptz, now()),
                updated_at = now()
            WHERE id = (item->>'id')::uuid
               OR ip_or_hostname = (item->>'ip_or_hostname');
            updated_links := updated_links + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'updated_endpoints', updated_endpoints,
        'updated_links', updated_links
    );
END;
$function$;

-- 4. Grants explícitos: revoga de PUBLIC (fecha o buraco original) e
-- concede só para anon/authenticated — que é quem o bridge e o restante do
-- app já usam para chegar nessas RPCs via PostgREST. O segredo dentro da
-- função é a autorização de verdade agora; o grant aqui só preserva o
-- caminho de chamada existente.
REVOKE ALL ON FUNCTION public.get_all_monitoring_targets(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_telemetry_status(jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_monitoring_targets(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_telemetry_status(jsonb, jsonb, text) TO anon, authenticated;
