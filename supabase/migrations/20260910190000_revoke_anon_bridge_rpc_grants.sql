-- =================================================================================
-- Migration: 20260910190000_revoke_anon_bridge_rpc_grants.sql
--
-- APLICADA EM 2026-09-11, depois de confirmar em runtime que o servidor
-- Debian (orion-bridge, monitoring/bridge.mjs) já roda com a chave
-- service_role: o log de start do container passou a imprimir
-- "SUPABASE_KEY é service_role". Essa ordem importa — aplicar isto antes da
-- troca derrubaria a telemetria, já que get_all_monitoring_targets e
-- update_telemetry_status ficariam sem nenhum papel autorizado a chamá-las
-- enquanto o bridge ainda usasse anon.
--
-- Achado correcao-autorizacao-p0.md item 1.5: as duas RPCs são SECURITY
-- DEFINER com EXECUTE concedido a anon/authenticated
-- (20260818040001_secure_bridge_rpc_functions.sql) — o único portão real
-- hoje é o segredo compartilhado (bridge_secrets) checado dentro do corpo
-- da função, não o GRANT. Isso deixa as duas RPCs expostas a qualquer
-- portador da anon key pública (nem precisa ser cliente deste app — a anon
-- key de um projeto Supabase é pública por design) pra tentativas de
-- adivinhar o segredo ou simplesmente gerar carga de requisição
-- (billing/egress), mesmo sem nunca acertar o segredo.
--
-- service_role contorna RLS e SECURITY DEFINER por padrão — não precisa de
-- GRANT explícito nestas funções pra continuar funcionando, então revogar
-- de anon/authenticated não exige nenhuma GRANT nova pro bridge. O segredo
-- em bridge_secrets continua no lugar como defesa em profundidade.
-- =================================================================================

REVOKE EXECUTE ON FUNCTION public.get_all_monitoring_targets(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_telemetry_status(jsonb, jsonb, text) FROM anon, authenticated;
