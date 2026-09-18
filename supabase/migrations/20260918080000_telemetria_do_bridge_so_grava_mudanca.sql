-- =============================================================================
-- update_telemetry_status passa a gravar só o que mudou
-- =============================================================================
--
-- O orion-bridge chama esta RPC a cada 15 s com o status de TODOS os sites e
-- links, mudados ou não. Cada chamada virava um UPDATE por linha: 834 mil
-- updates em monitored_endpoints para 6 linhas, o maior escritor do banco
-- medido na auditoria de monitoramento de 18/09/2026 (P2,
-- docs/auditoria-monitoramento-2026-09-18.md).
--
-- Agora a linha só é regravada quando:
--   * o status mudou, ou
--   * a última confirmação tem mais de 5 minutos.
--
-- A latência do link fica de fora da condição de propósito: ela varia a cada
-- ping, e com ela ali o link seria regravado em todo ciclo, anulando o corte.
-- Ela é renovada junto com a prova de vida, a cada 5 minutos.
--
-- A segunda condição mantém last_check / last_checked_at como prova de vida:
-- enquanto o bridge estiver rodando, eles nunca ficam mais velhos que ~5 min.
-- O painel usa isso para avisar quando o dado parou de chegar (servidor de
-- monitoramento desligado), em vez de continuar exibindo "online" congelado.
--
-- A assinatura e o retorno não mudam: o bridge não precisa ser reimplantado.
-- Os contadores do retorno passam a contar só as linhas de fato gravadas.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_telemetry_status(
  p_endpoint_results jsonb DEFAULT '[]'::jsonb,
  p_link_results jsonb DEFAULT '[]'::jsonb,
  p_secret text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item jsonb;
    linhas int;
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
            WHERE (id = (item->>'id')::uuid OR url_or_ip = (item->>'url_or_ip'))
              AND (status IS DISTINCT FROM item->>'status'
                   OR last_check IS NULL
                   OR last_check < now() - interval '5 minutes');
            GET DIAGNOSTICS linhas = ROW_COUNT;
            updated_endpoints := updated_endpoints + linhas;
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
            WHERE (id = (item->>'id')::uuid OR ip_or_hostname = (item->>'ip_or_hostname'))
              AND (status IS DISTINCT FROM item->>'status'
                   OR last_checked_at IS NULL
                   OR last_checked_at < now() - interval '5 minutes');
            GET DIAGNOSTICS linhas = ROW_COUNT;
            updated_links := updated_links + linhas;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'updated_endpoints', updated_endpoints,
        'updated_links', updated_links
    );
END;
$function$;
