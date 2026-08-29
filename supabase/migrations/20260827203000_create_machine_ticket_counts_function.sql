-- machine_ticket_counts() — contagem real de chamados por máquina pro
-- Inventário (src/hooks/useDeviceInventory.ts), que consulta o Supabase
-- DIRETO do navegador (não passa pelo backend Go). A contagem client-side
-- anterior casava t.asset_id || t.metadata.machine_id contra machines.id —
-- nenhum dos dois é preenchido em chamado aberto pelo agente, então sempre
-- dava 0.
--
-- Mesma lógica de lib.MachineGhostEmail (handler Go): toda máquina sempre
-- autentica "Abrir Chamado" pelo mesmo usuário-fantasma
-- (machine-<12 primeiros chars do token>@orion.internal) — o vínculo
-- machine → tickets.user_id já existe, só faltava uma consulta que usasse
-- isso também no caminho direto-do-navegador.
--
-- SECURITY DEFINER pra poder ler auth.users (PostgREST/RLS não dá acesso
-- direto a esse schema pro role authenticated). Escopado por empresa do
-- CHAMADOR (mesmo padrão de get_user_company_id/is_master_company_user já
-- usado em todo o resto do sistema) — sem isso, qualquer usuário logado
-- descobriria contagem de chamados de máquinas de OUTRAS empresas.
CREATE OR REPLACE FUNCTION public.machine_ticket_counts()
RETURNS TABLE(machine_id uuid, tickets_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, count(t.id)
  FROM public.machines m
  LEFT JOIN auth.users u ON u.email = 'machine-' || lower(substring(m.machine_token, 1, 12)) || '@orion.internal'
  LEFT JOIN public.tickets t ON t.user_id = u.id
  WHERE m.approval_status = 'approved'
    AND (
      public.is_master_company_user(auth.uid())
      OR m.company_id = public.get_user_company_id(auth.uid())
    )
  GROUP BY m.id;
$$;

-- Mesmo cuidado já documentado em merge_user_data: funções SECURITY
-- DEFINER ficam automaticamente expostas via PostgREST RPC pra
-- anon/authenticated ao serem criadas — revoga de anon explicitamente,
-- deixa só pra quem já está autenticado (a checagem de empresa acima cobre
-- o resto).
REVOKE EXECUTE ON FUNCTION public.machine_ticket_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.machine_ticket_counts() TO authenticated;
