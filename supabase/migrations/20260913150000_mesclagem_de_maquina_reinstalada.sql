-- =============================================================================
-- Migration: 20260913150000_mesclagem_de_maquina_reinstalada.sql
--
-- Reconhecimento do computador físico para não duplicar máquina após formatação
--
-- Problema:
--   A identidade da máquina é o machine_token, aleatório e guardado em
--   C:\ProgramData\OrionAgent. Formatar o Windows apaga o arquivo e regera o
--   MachineGuid (machine_uuid), então a reinstalação do agente entrava como
--   máquina NOVA. Caso real: SAMUEL (offline desde 03/09, agente 1.1.27) e
--   SAM-DESKTOP (criada em 11/09) são o mesmo computador — mesmo MAC da placa
--   de rede integrada, 3c:7c:3f:79:79:51.
--
--   machine_uuid sozinho não serve como chave: as VMs de teste DESKTOP-* deste
--   banco compartilham o mesmo machine_uuid com MACs diferentes (imagem clonada).
--
-- O que muda:
--   - machines.hardware_uuid: UUID do SMBIOS (firmware da placa-mãe);
--   - machines.board_mac: MAC da placa de rede integrada (barramento PCI),
--     estável mesmo quando a máquina alterna entre cabo e Wi-Fi;
--   - public.machine_identity_merges: registro de cada reaproveitamento, para
--     auditoria.
--   A regra de mesclagem vive no backend (lib/machine_identity.go): mesma
--   empresa, registro antigo sem check-in há pelo menos 15 minutos, um único
--   candidato. Os índices abaixo sustentam essa busca.
--
-- NÃO ALTERA DADOS EXISTENTES. SAMUEL e SAM-DESKTOP continuam separados; a
-- regra vale a partir da próxima reinstalação.
-- =============================================================================

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS hardware_uuid text,
  ADD COLUMN IF NOT EXISTS board_mac text;

COMMENT ON COLUMN public.machines.hardware_uuid IS
  'UUID do SMBIOS (Win32_ComputerSystemProduct). Sobrevive à formatação; usado para reconhecer reinstalação.';
COMMENT ON COLUMN public.machines.board_mac IS
  'MAC da placa de rede integrada (PCI), normalizado em minúsculas. Sobrevive à formatação; usado para reconhecer reinstalação.';

CREATE INDEX IF NOT EXISTS idx_machines_company_hardware_uuid
  ON public.machines (company_id, hardware_uuid) WHERE hardware_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_machines_company_board_mac
  ON public.machines (company_id, board_mac) WHERE board_mac IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_machines_company_mac_address
  ON public.machines (company_id, lower(mac_address)) WHERE mac_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.machine_identity_merges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id        uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  merged_at         timestamptz NOT NULL DEFAULT now(),
  criterio          text NOT NULL CHECK (criterio IN ('hardware_uuid', 'mac_placa_mae', 'mac')),
  hostname_anterior text,
  hostname_novo     text
);

CREATE INDEX IF NOT EXISTS idx_machine_identity_merges_machine
  ON public.machine_identity_merges (machine_id, merged_at DESC);

-- Só o backend (pool privilegiado) escreve e lê esta tabela. RLS ligado sem
-- policy + REVOKE: nenhum acesso via PostgREST.
ALTER TABLE public.machine_identity_merges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.machine_identity_merges FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.machine_identity_merges IS
  'Cada vez que uma identidade nova de agente reaproveitou o registro de uma instalação anterior do mesmo computador (formatação/reinstalação).';
