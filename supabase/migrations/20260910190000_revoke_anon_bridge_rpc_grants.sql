-- =================================================================================
-- Migration: 20260910190000_revoke_anon_bridge_rpc_grants.sql
--
-- PREPARADA PARA REVISÃO — NÃO APLICADA NESTA RODADA. Só aplicar depois de
-- confirmar que o servidor Debian (orion-bridge, monitoring/bridge.mjs) já
-- está rodando com a chave service_role no lugar da anon key — troca manual
-- no .env do servidor, fora do escopo automatizável daqui (ver comentário
-- de CONFIG em bridge.mjs). Aplicar isto ANTES da troca derruba a
-- telemetria em produção: get_all_monitoring_targets e
-- update_telemetry_status ficariam sem nenhum papel autorizado a chamá-las
-- enquanto o bridge ainda usa anon.
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
