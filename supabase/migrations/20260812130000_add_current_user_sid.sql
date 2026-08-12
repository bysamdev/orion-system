-- Adiciona current_user_sid: SID do usuário Windows logado no momento do
-- heartbeat, em complemento a current_user (nome, já existente).
--
-- Por quê (item A.13 do plano do Orion Agent): nomes de usuário colidem
-- entre domínios diferentes e não são estáveis (uma conta renomeada mantém
-- o mesmo SID). O SID é a identidade real e inequívoca do Windows/AD.
--
-- Uso estritamente informativo/inventário — NUNCA como credencial de
-- autenticação. Essa distinção já está documentada em
-- orion-agent/SECURITY-AUTO-PROVISIONING.md §4.2/§4.4: current_user (e agora
-- current_user_sid) só alimentam nome de exibição e agrupamento; nenhuma
-- decisão de autorização depende deles.
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS current_user_sid TEXT;

COMMENT ON COLUMN public.machines.current_user_sid IS
  'SID do usuário Windows/AD logado no momento do último heartbeat. Dado informativo de inventário — nunca usado para autenticação/autorização.';
