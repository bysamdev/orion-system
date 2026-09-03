-- =================================================================================
-- Migration: 20260903000000_silencio_tolerado_por_tipo.sql
--
-- Torna o limiar de "máquina offline" proporcional ao intervalo de coleta
-- daquele tipo de máquina, em vez dos 5 minutos fixos usados até aqui.
--
-- Motivo: o intervalo de heartbeat de estação/notebook subiu de 180s pra
-- 300s (ver collectionIntervalSeconds em handler/mon_handlers.go), medida
-- tomada pra caber no teto de egress do plano. Com o limiar fixo em 5
-- minutos, uma estação saudável passaria a ser marcada offline ENTRE dois
-- heartbeats normais: 300s de intervalo mais o jitter de ±10% do agente já
-- encosta nos 5 minutos, e qualquer atraso de rede cruza a linha. Seria um
-- mar de falsos offline no painel, justamente nas máquinas mais numerosas.
--
-- Os valores toleram duas coletas perdidas mais folga:
--   servidor (coleta 60s)  -> 3 minutos
--   demais   (coleta 300s) -> 12 minutos
--
-- Função IMMUTABLE e sem acesso a tabela: pode ser usada em índice e é
-- barata o suficiente pra aparecer dentro de filtros de contagem.
--
-- Rollback: as consultas voltam a comparar com INTERVAL '5 minutes' e esta
-- função pode ser derrubada com DROP FUNCTION public.silencio_tolerado(text).
-- =================================================================================

CREATE OR REPLACE FUNCTION public.silencio_tolerado(p_device_type text)
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
           WHEN p_device_type = 'server' THEN INTERVAL '3 minutes'
           ELSE INTERVAL '12 minutes'
         END;
$$;

COMMENT ON FUNCTION public.silencio_tolerado(text) IS
  'Quanto tempo sem heartbeat até considerar a máquina offline. Proporcional ao intervalo de coleta do tipo (ver collectionIntervalSeconds no backend Go).';

GRANT EXECUTE ON FUNCTION public.silencio_tolerado(text) TO authenticated, service_role;
