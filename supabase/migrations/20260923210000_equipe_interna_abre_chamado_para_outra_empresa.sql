-- A equipe interna (empresa mãe) passa a poder abrir chamado para outra
-- empresa, escolhida no formulário.
--
-- set_ticket_company_from_user sempre sobrescrevia company_id com a empresa
-- do perfil de quem abria. Agora, se quem abre é da equipe interna e informou
-- uma empresa que existe, ela é mantida. Para todos os outros (cliente, admin
-- de empresa cliente, abertura sem sessão) nada muda: a empresa continua
-- vindo do perfil. A policy de INSERT de tickets já aceitava qualquer empresa
-- para a equipe.

CREATE OR REPLACE FUNCTION public.set_ticket_company_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NOT NULL
     AND NEW.company_id IS NOT NULL
     AND public.is_equipe_interna(v_uid)
     AND EXISTS (SELECT 1 FROM public.companies WHERE id = NEW.company_id) THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
      FROM public.profiles
     WHERE id = v_uid;
  ELSE
    SELECT company_id INTO NEW.company_id
      FROM public.profiles
     WHERE id = NEW.user_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada não pode criar tickets';
  END IF;

  RETURN NEW;
END;
$$;
