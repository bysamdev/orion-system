-- get_decrypted_remote_password(uuid) e get_encryption_key() estavam com
-- EXECUTE liberado para anon/authenticated e SEM nenhuma checagem de
-- autorização dentro do corpo — qualquer portador da anon key pública
-- (embutida no bundle do frontend) conseguia descriptografar a senha de
-- acesso remoto de QUALQUER chamado, de qualquer empresa. Nada no frontend
-- chama esta RPC hoje (grep confirmou), então a correção é segura.

-- get_encryption_key: nunca precisa ser chamada diretamente por anon/authenticated
-- — é uma dependência interna de get_decrypted_remote_password (SECURITY DEFINER
-- roda como o dono da função, então continua funcionando mesmo sem esses grants).
REVOKE EXECUTE ON FUNCTION public.get_encryption_key() FROM anon, authenticated;

-- get_decrypted_remote_password: adiciona a mesma checagem de autorização
-- (empresa do chamador == empresa do chamado, com papel admin/technician, ou
-- usuário master) já usada em todas as outras políticas RLS deste sistema —
-- mesmo padrão de has_role/get_user_company_id/is_master_company_user.
CREATE OR REPLACE FUNCTION public.get_decrypted_remote_password(p_ticket_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    decrypted TEXT;
    caller_uid uuid := auth.uid();
BEGIN
    IF caller_uid IS NULL THEN
        RETURN NULL;
    END IF;

    IF NOT (
        public.is_master_company_user(caller_uid)
        OR (
            public.get_ticket_company_id(p_ticket_id) = public.get_user_company_id(caller_uid)
            AND (public.has_role(caller_uid, 'admin'::app_role) OR public.has_role(caller_uid, 'technician'::app_role))
        )
    ) THEN
        RETURN NULL;
    END IF;

    SELECT pgp_sym_decrypt(decode(remote_password, 'base64'), public.get_encryption_key()) INTO decrypted
    FROM public.tickets
    WHERE id = p_ticket_id AND remote_password IS NOT NULL;

    RETURN decrypted;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_decrypted_remote_password(uuid) FROM anon;
