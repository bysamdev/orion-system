-- =============================================================================
-- Chamado criado sem sessão volta a nascer (e-mail e alerta automático)
-- =============================================================================
--
-- O PROBLEMA
--
-- set_ticket_company_from_user é BEFORE INSERT em tickets e sempre derivava a
-- empresa de `profiles WHERE id = auth.uid()`, ignorando o company_id que o
-- chamador informou. Quando não há sessão, auth.uid() é NULL, a busca não
-- acha nada e o trigger derruba o INSERT com "Usuário sem empresa associada
-- não pode criar tickets".
--
-- Dois caminhos legítimos criam chamado sem sessão, e os dois estavam mortos:
--
--   * supabase/functions/email-to-ticket — roda com service_role, cujo JWT não
--     tem `sub`, então auth.uid() é NULL. Toda abertura por e-mail morria
--     aqui. Este canal já estava quebrado antes por outro motivo (a categoria
--     inválida, corrigida em dc8becf); o erro da categoria mascarava este, que
--     é a camada de baixo.
--
--   * lib/monitoring.go AbrirChamadoAlertaServidor — insere pelo pool pgx do
--     backend Go, que também não carrega request.jwt.claims. Nenhum chamado
--     automático de alerta de servidor conseguia ser aberto.
--
-- Medido em 17/09/2026: INSERT em tickets sem sessão era recusado, e nenhum
-- chamado na base tinha vindo por e-mail.
--
-- A CORREÇÃO
--
-- O caminho autenticado fica exatamente como estava — inclusive o efeito de a
-- empresa vir de quem está logado, não do company_id informado.
--
-- Sem sessão, a empresa passa a ser derivada do profile do DONO da linha
-- (NEW.user_id). Derivar, e não confiar no company_id recebido, é o ponto: o
-- caminho sem sessão continua sem conseguir escolher uma empresa arbitrária,
-- que é o que a regra original protegia. Um chamado cujo dono não tem empresa
-- segue sendo recusado.
--
-- NÃO ALTERA DADOS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_ticket_company_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    -- Caminho de sempre: a empresa é a de quem está autenticado.
    SELECT company_id INTO NEW.company_id
      FROM profiles
     WHERE id = (SELECT auth.uid());
  ELSE
    -- Sem sessão: service_role (email-to-ticket) ou o pool do backend Go
    -- (chamado automático de alerta). A empresa vem do profile do dono da
    -- linha, nunca do company_id que veio no INSERT.
    SELECT company_id INTO NEW.company_id
      FROM profiles
     WHERE id = NEW.user_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada não pode criar tickets';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_ticket_company_from_user() IS
  'Deriva tickets.company_id: do profile de auth.uid() quando há sessão, do '
  'profile de NEW.user_id quando não há (service_role e backend Go). Nunca '
  'aceita o company_id informado pelo chamador.';
