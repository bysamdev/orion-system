-- =================================================================================
-- Migration: 20260911180000_visao_msp_exige_papel_de_equipe.sql
--
-- Vazamento entre empresas encontrado em 2026-09-11, ao investigar o achado P2
-- de desempenho de RLS (a investigação virou outra coisa).
--
-- is_master_company_user() concedia visão MSP a QUALQUER usuário de uma
-- empresa marcada is_master, sem olhar o papel. Como três das quatro empresas
-- estavam marcadas assim, todo usuário existente era tratado como equipe. E o
-- predicado aparece como "OR is_master_company_user(...)" em 85 políticas,
-- então curto-circuitava o escopo por empresa em todas elas.
--
-- Medido antes de corrigir, não deduzido: um usuário com papel 'customer' da
-- empresa "Orion System" enxergava as 19 máquinas e as 19 linhas de
-- machine_hardware de todas as empresas, incluindo as 17 da "iBReady".
-- Chamados não vazavam, porque as políticas de tickets usam user_id.
--
-- A correção é no papel, não nos dados. Mover as contas de teste para fora
-- resolveria só aquelas duas contas; exigir papel de equipe protege também
-- qualquer conta de cliente criada depois numa empresa master — que é o
-- cenário real quando entrar cliente de verdade.
--
-- Efeito medido, usuário a usuário (máquinas visíveis antes -> depois):
--
--   Samuel Terres    admin,developer  bysamdev       19 -> 19
--   Guilherme Born   admin            iBReady        19 -> 19
--   Tecnico          technician       Orion System   19 -> 19
--   samuel (SAMUEL)  customer         Orion System   19 ->  2
--   usuario          customer         Orion System   19 ->  2
--
-- 'developer' segue com visão global independente de empresa, como antes.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.is_master_company_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  -- developer: visão global, independente da empresa (inalterado).
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'developer'::app_role
  )
  -- empresa master: agora exige também papel de equipe. Antes bastava a
  -- empresa, o que dava visão MSP a usuários 'customer'.
  OR EXISTS (
    SELECT 1
    FROM profiles p
    JOIN companies c  ON c.id = p.company_id
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id
      AND c.is_master = true
      AND ur.role IN ('admin'::app_role, 'technician'::app_role, 'developer'::app_role)
  );
$function$;

-- Alinha a flag ao modelo declarado: as empresas com equipe são "Orion System"
-- e "iBReady". Hoje isto é inócuo para o único usuário de bysamdev, que é
-- developer e tem visão global pelo papel — mas deixa o dado coerente para
-- quando alguém sem esse papel for criado ali.
UPDATE public.companies SET is_master = false WHERE name = 'bysamdev';
