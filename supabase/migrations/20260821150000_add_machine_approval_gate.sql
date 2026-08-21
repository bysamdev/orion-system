-- Gate de aprovação de máquinas: bloqueia registro automático via
-- heartbeat sem revisão manual. Motivado por 5 máquinas fantasma
-- (DESKTOP-XXXXXXX, WORKGROUP, usuário aleatório) criadas por VMs
-- descartáveis de análise dinâmica (VirusTotal e scanners multi-engine
-- similares) que executaram o orion-agent.exe de verdade.

-- 1. Remove as máquinas fantasma confirmadas (padrão sandbox: hostname
--    default do Windows, sem domínio real, usuário aleatório, offline
--    logo após criação). IDs explícitos, não um DELETE por padrão de
--    regex, pra nunca arriscar apagar uma máquina real por coincidência.
DELETE FROM public.machines WHERE id IN (
  '0cbee619-27b4-4dfc-a8d8-7c5807d659c6', -- DESKTOP-FRVVMQW
  'd7db056c-e4df-49ae-9bbe-0aab2cc8800a', -- DESKTOP-MPTBGHQ
  '37a6f540-1f62-4040-a0b3-4c29af28e6d3', -- DESKTOP-ZKOQVYI
  '798547ce-3e6d-4f56-9f03-fc7c30110c15', -- DESKTOP-DHFGUFF
  '19adbd1d-eaf3-4d48-b3c1-90047f7d61e6'  -- DESKTOP-ET51AJO
);

-- 2. Novo campo de aprovação. Default 'pending' vale só pra INSERTs
--    futuros — o backfill abaixo aprova (grandfather) todas as máquinas
--    já existentes nesta migração, já que são o parque real conhecido.
ALTER TABLE public.machines
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.machines SET approval_status = 'approved';

CREATE INDEX idx_machines_approval_status ON public.machines (approval_status)
  WHERE approval_status = 'pending';

COMMENT ON COLUMN public.machines.approval_status IS
  'pending = aguardando aprovação manual do admin (primeiro heartbeat); approved = liberada; rejected = negada explicitamente (mantida pra auditoria, não reaparece na fila).';
