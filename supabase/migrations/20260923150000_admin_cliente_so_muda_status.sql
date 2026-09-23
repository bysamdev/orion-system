-- ORN-SEC-23: a lista branca de colunas só valia para o dono do chamado. Um
-- admin de empresa cliente editando o chamado de um colega recebia o NEW
-- inteiro: podia trocar user_id, company_id, prioridade, SLA, responsável.
--
-- Agora a lista branca vale para qualquer pessoa de fora da equipe interna.

CREATE OR REPLACE FUNCTION public.enforce_customer_ticket_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Sem sessão de usuário: cron, service_role ou o pool privilegiado do
  -- backend Go. Estes caminhos já têm autorização própria.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Equipe interna mantém poder de repriorizar, reatribuir e ajustar SLA.
  IF public.is_equipe_interna((SELECT auth.uid())) THEN
    RETURN NEW;
  END IF;

  -- Lista branca: parte de OLD e aplica por cima só o que o cliente pode mudar.
  RETURN jsonb_populate_record(
    OLD,
    jsonb_build_object('status', NEW.status, 'updated_at', NEW.updated_at)
  );
END;
$$;
