-- Regressão real, achada ao vivo: encrypt_remote_password_trigger_fn e
-- get_decrypted_remote_password tiveram search_path resetado pra
-- 'public, pg_temp' em algum momento fora do controle de versão deste
-- repo (nenhuma migration rastreada aqui fez essa troca) — mas pgp_sym_encrypt/
-- pgp_sym_decrypt (pgcrypto) vivem no schema `extensions` neste projeto
-- Supabase, não em `public`. Sem `extensions` no search_path, TODA criação
-- de chamado com remote_password não-nulo falha com
-- "function pgp_sym_encrypt(text, text) does not exist" — exatamente o erro
-- reportado pelo usuário ao tentar abrir um chamado.
--
-- Já tinha sido corrigido uma vez (migration 20260813130002_lock_down_encryption_functions.sql,
-- comentário explícito sobre o motivo), mas 20260818060000_fix_remote_password_decrypt_authz.sql
-- recriou get_decrypted_remote_password pra adicionar checagem de tenancy
-- (SEC real, mantida aqui) e sem querer voltou o search_path pro padrão
-- 'public, pg_temp'. Esta migration restaura 'extensions' nas duas funções,
-- preservando a checagem de autorização já existente em
-- get_decrypted_remote_password.

CREATE OR REPLACE FUNCTION public.encrypt_remote_password_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    IF NEW.remote_password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.remote_password IS DISTINCT FROM OLD.remote_password) THEN
        NEW.remote_password := encode(pgp_sym_encrypt(NEW.remote_password, public.get_encryption_key()), 'base64');
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_remote_password(p_ticket_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
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
