-- =============================================================================
-- Presença grossa: o Supabase deixa de saber quem está online agora
-- =============================================================================
--
-- Fase 3 da separação do monitoramento (card "Separar o monitoramento em
-- serviço próprio"). Quem sabe o status fino de cada máquina (online, alerta,
-- offline) passa a ser o Orion Monitor, no servidor de monitoramento. A API
-- calcula o status a partir dele (statusDoEstado, handler/monitor_leitura.go).
--
-- No Supabase, o cadastro da máquina só é regravado quando algo dele muda ou
-- quando last_seen passa de 30 minutos (UpsertMachine com PresencaGrossa).
-- Antes, cada heartbeat regravava a linha só para avançar last_seen.
--
-- Com last_seen renovado de 30 em 30 minutos, a tolerância antiga (12 min
-- para estação, 3 para servidor) faria marcar_maquinas_offline() derrubar
-- toda máquina entre uma renovação e outra, e o heartbeat seguinte a
-- regravaria de volta: escrita dobrada à toa. 45 minutos cobrem uma janela de
-- renovação com folga.
--
-- O que passa a significar status/last_seen no Supabase: "a máquina deu
-- sinal nos últimos 45 minutos". É a reserva usada quando o Monitor não
-- responde, e o critério dos poucos pontos que ainda leem só do Supabase
-- (alertas críticos de offline há mais de 1 hora).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.silencio_tolerado(p_device_type text)
RETURNS interval
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $function$
  SELECT INTERVAL '45 minutes';
$function$;

COMMENT ON FUNCTION public.silencio_tolerado(text) IS
  'Presença grossa (fase 3 do monitoramento): o status fino vem do Orion Monitor. '
  'O parâmetro fica para não quebrar quem chama.';
