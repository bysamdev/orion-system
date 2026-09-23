-- Fase 5 da auditoria: índices duplicados, atalho de resposta pronta e
-- permissões de funções.

-- ORN-DB-03: nove índices repetiam exatamente as colunas de uma constraint
-- UNIQUE (ou de um índice único) da mesma tabela. Cada escrita atualizava os
-- dois; no heartbeat das máquinas isso dobrava o trabalho. Fica a constraint.
DROP INDEX IF EXISTS public.idx_canned_responses_shortcut;
DROP INDEX IF EXISTS public.idx_companies_name;
DROP INDEX IF EXISTS public.idx_contract_billing_cycles_contract;
DROP INDEX IF EXISTS public.idx_invite_tokens_token;
DROP INDEX IF EXISTS public.idx_machine_hardware_machine_id;
DROP INDEX IF EXISTS public.idx_machines_machine_token;
DROP INDEX IF EXISTS public.idx_profiles_email;
DROP INDEX IF EXISTS public.idx_ticket_ratings_ticket_id;
DROP INDEX IF EXISTS public.idx_tickets_ticket_number;

-- ORN-DB-01: com as respostas prontas globais (company_id nulo), a
-- constraint UNIQUE (company_id, shortcut) deixou de impedir atalhos
-- repetidos, porque NULL nunca é igual a NULL. NULLS NOT DISTINCT trata os
-- nulos como iguais. Em 23/09/2026 não há atalho repetido.
ALTER TABLE public.canned_responses DROP CONSTRAINT IF EXISTS canned_responses_company_id_shortcut_key;
ALTER TABLE public.canned_responses
  ADD CONSTRAINT canned_responses_company_id_shortcut_key UNIQUE NULLS NOT DISTINCT (company_id, shortcut);

-- ORN-DB-04 (SEC-18): o cálculo de prazo recebe qualquer empresa por
-- parâmetro e é uso interno dos gatilhos e de definir_sla_ativo, que rodam
-- como dono da função. Ninguém de fora precisa chamá-lo.
REVOKE ALL ON FUNCTION public.calcular_prazo_sla(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.politica_sla_da_empresa(uuid) FROM PUBLIC, anon, authenticated;

-- count_company_active_agents é usada pelo painel (useActiveAgentsCount) e
-- aceitava qualquer empresa. Agora só conta para a própria empresa ou para a
-- equipe interna; para os outros devolve 0, sem erro, que é o que a tela já
-- trata como "sem técnicos".
CREATE OR REPLACE FUNCTION public.count_company_active_agents(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  total_agents integer;
BEGIN
  IF NOT (public.is_equipe_interna(auth.uid())
          OR p_company_id = public.get_user_company_id(auth.uid())) THEN
    RETURN 0;
  END IF;

  SELECT COUNT(DISTINCT p.id) INTO total_agents
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.company_id = p_company_id
    AND ur.role IN ('technician', 'admin');

  RETURN total_agents;
END;
$$;
REVOKE ALL ON FUNCTION public.count_company_active_agents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_company_active_agents(uuid) TO authenticated;

-- ORN-DB-05: funções SECURITY DEFINER executáveis por anon. As de gatilho e
-- sla_ativo não são chamadas por ninguém de fora (o PostgreSQL não confere
-- EXECUTE quando o gatilho dispara). Os helpers usados dentro de policies
-- (has_role, get_user_company_id, is_equipe_interna, is_master_company_user,
-- get_ticket_company_id, ticket_belongs_to_user_company,
-- eh_usuario_de_maquina) ficam como estão: várias policies valem para PUBLIC
-- e, sem EXECUTE, uma consulta anônima daria erro em vez de voltar vazia.
REVOKE ALL ON FUNCTION public.dispara_email_de_avaliacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tr_automacoes_pos_abertura() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sla_ativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sla_ativo() TO authenticated;
